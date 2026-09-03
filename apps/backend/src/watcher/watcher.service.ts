import { eq } from 'drizzle-orm';
import { db } from '../db';
import { companies, filings } from '../db/schema';
import { BseClient } from './bse.client';
import { parseBseAnnouncement } from './bse.parser';
import { findFilingByPdfHash, isLevel1Duplicate } from './dedup';
import { downloadPdfStream, generateDeterministicFilename } from './downloader';
import { isTranscriptFiling, matchSeededCompany } from './filters';
import { NseClient } from './nse.client';
import { parseNseAnnouncement } from './nse.parser';
import { IngestStats, NormalizedFiling, FilingSource } from './types';

export class WatcherService {
  private nseClient: NseClient;
  private bseClient: BseClient;

  constructor() {
    this.nseClient = new NseClient();
    this.bseClient = new BseClient();
  }

  public async runSingleIngestion(): Promise<IngestStats[]> {
    console.log('🚀 Starting corporate announcement ingestion cycle...');
    const nseStats = await this.ingestNse();
    const bseStats = await this.ingestBse();
    console.log('✅ Ingestion cycle completed.');
    return [nseStats, bseStats];
  }

  public async ingestNse(): Promise<IngestStats> {
    const stats: IngestStats = {
      source: 'NSE',
      totalFetched: 0,
      matchedCompany: 0,
      transcriptFiltered: 0,
      level1Duplicates: 0,
      level2Duplicates: 0,
      downloaded: 0,
      failed: 0,
    };

    try {
      console.log('📡 Polling NSE corporate announcements...');
      const rawAnnouncements = await this.nseClient.fetchAnnouncements();
      stats.totalFetched = rawAnnouncements.length;
      console.log(`[WATCHER] NSE returned ${rawAnnouncements.length} announcements.`);

      for (const raw of rawAnnouncements) {
        try {
          const filing = parseNseAnnouncement(raw);
          if (filing) {
            await this.processFiling(filing, stats);
          }
        } catch (err: any) {
          stats.failed++;
          console.error('[WATCHER] Error processing individual NSE filing:', err.message);
        }
      }
    } catch (err: any) {
      console.error('[WATCHER] NSE polling encountered an error (isolated):', err.message);
    }

    return stats;
  }

  public async ingestBse(): Promise<IngestStats> {
    const stats: IngestStats = {
      source: 'BSE',
      totalFetched: 0,
      matchedCompany: 0,
      transcriptFiltered: 0,
      level1Duplicates: 0,
      level2Duplicates: 0,
      downloaded: 0,
      failed: 0,
    };

    try {
      console.log('📡 Polling BSE corporate announcements...');
      const rawAnnouncements = await this.bseClient.fetchAnnouncements();
      stats.totalFetched = rawAnnouncements.length;
      console.log(`[WATCHER] BSE returned ${rawAnnouncements.length} announcements.`);

      for (const raw of rawAnnouncements) {
        try {
          const filing = parseBseAnnouncement(raw);
          if (filing) {
            await this.processFiling(filing, stats);
          }
        } catch (err: any) {
          stats.failed++;
          console.error('[WATCHER] Error processing individual BSE filing:', err.message);
        }
      }
    } catch (err: any) {
      console.error('[WATCHER] BSE polling encountered an error (isolated):', err.message);
    }

    return stats;
  }

  private async processFiling(filing: NormalizedFiling, stats: IngestStats): Promise<void> {
    // 1. Level 1 Deduplication (source + sourceAnnouncementId)
    const isL1Dup = await isLevel1Duplicate(filing.source, filing.sourceAnnouncementId);
    if (isL1Dup) {
      stats.level1Duplicates++;
      console.log(`[DEDUP] Skipping Level 1 duplicate (${filing.source} ID: ${filing.sourceAnnouncementId})`);
      return;
    }

    // 2. Transcript Relevance Filtering
    if (!isTranscriptFiling(filing.subject, filing.eventType)) {
      console.log(`[FILTER] Skipped non-transcript filing: "${filing.subject?.slice(0, 60)}"`);
      return;
    }
    stats.transcriptFiltered++;
    console.log(`[FILTER] Concall transcript detected: "${filing.subject?.slice(0, 70)}"`);

    // 3. Company Matching
    const matchedCompany = matchSeededCompany({
      nseSymbol: filing.nseSymbol,
      bseCode: filing.bseCode,
      isin: filing.isin,
      companyName: filing.companyName,
    });

    if (!matchedCompany) {
      console.log(`[MATCH] Unmatched company skipped: "${filing.companyName}"`);
      return;
    }
    stats.matchedCompany++;
    console.log(`[MATCH] Matched to seeded company: ${matchedCompany.name} (${matchedCompany.nseSymbol})`);

    // Query Company ID from PostgreSQL
    const companyRecord = await db
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.nseSymbol, matchedCompany.nseSymbol))
      .limit(1);

    if (companyRecord.length === 0) {
      console.warn(`[DB] Seeded company record not found in PostgreSQL DB for ${matchedCompany.nseSymbol}`);
      return;
    }

    const companyId = companyRecord[0].id;

    // 4. Persistence: Insert filing with status = 'DISCOVERED'
    const [insertedFiling] = await db
      .insert(filings)
      .values({
        companyId,
        source: filing.source,
        sourceAnnouncementId: filing.sourceAnnouncementId,
        filingDate: filing.filingDate,
        eventType: filing.eventType || 'Corporate Announcement',
        subject: filing.subject,
        sourceUrl: filing.sourceUrl,
        pdfUrl: filing.pdfUrl,
        status: 'DISCOVERED',
      })
      .returning({ id: filings.id });

    console.log(`[DB] Inserted filing ${insertedFiling.id} with status DISCOVERED`);

    if (!filing.pdfUrl) {
      console.log(`[DOWNLOAD] No PDF URL present for filing ${insertedFiling.id}`);
      return;
    }

    // 5. Status Transition -> DOWNLOADING
    await db.update(filings).set({ status: 'DOWNLOADING' }).where(eq(filings.id, insertedFiling.id));

    try {
      const targetFilename = generateDeterministicFilename(
        filing.source,
        matchedCompany.nseSymbol,
        filing.filingDate,
        filing.sourceAnnouncementId
      );

      // Download PDF and compute SHA-256 hash
      const downloadRes = await downloadPdfStream(filing.pdfUrl, targetFilename);

      // 6. Level 2 Deduplication Check (PDF SHA-256 Hash)
      const existingPdfMatch = await findFilingByPdfHash(downloadRes.pdfHash);
      if (existingPdfMatch && existingPdfMatch.id !== insertedFiling.id) {
        stats.level2Duplicates++;
        console.log(`[DEDUP] Level 2 duplicate PDF SHA-256 match found (${downloadRes.pdfHash.slice(0, 10)}...). Preserving filing record.`);
      }

      // 7. Status Transition -> DOWNLOADED
      await db
        .update(filings)
        .set({
          status: 'DOWNLOADED',
          pdfUrl: downloadRes.localPath,
          pdfHash: downloadRes.pdfHash,
        })
        .where(eq(filings.id, insertedFiling.id));

      stats.downloaded++;
      console.log(`[DB] Filing ${insertedFiling.id} status updated to DOWNLOADED`);
    } catch (err: any) {
      stats.failed++;
      console.error(`[DOWNLOAD] Failed downloading filing ${insertedFiling.id}:`, err.message);
      await db.update(filings).set({ status: 'FAILED' }).where(eq(filings.id, insertedFiling.id));
    }
  }
}
