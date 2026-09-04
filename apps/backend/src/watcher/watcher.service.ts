import { eq } from 'drizzle-orm';
import { db } from '../db';
import { companies, filings } from '../db/schema';
import { wsManager } from '../ws/websocket.server';
import { BseClient } from './bse.client';
import { parseBseAnnouncement } from './bse.parser';
import { findFilingByPdfHash, isLevel1Duplicate } from './dedup';
import { downloadPdfStream, generateDeterministicFilename } from './downloader';
import { isTranscriptFiling, matchSeededCompany } from './filters';
import { NseClient } from './nse.client';
import { parseNseAnnouncement } from './nse.parser';
import { IngestStats, NormalizedFiling } from './types';

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
      console.error('[WATCHER] NSE polling error:', err.message);
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
      console.error('[WATCHER] BSE polling error:', err.message);
    }

    return stats;
  }

  private async processFiling(filing: NormalizedFiling, stats: IngestStats): Promise<void> {
    const isL1Dup = await isLevel1Duplicate(filing.source, filing.sourceAnnouncementId);
    if (isL1Dup) {
      stats.level1Duplicates++;
      return;
    }

    if (!isTranscriptFiling(filing.subject, filing.eventType)) {
      return;
    }
    stats.transcriptFiltered++;

    const matchedCompany = await matchSeededCompany({
      nseSymbol: filing.nseSymbol,
      bseCode: filing.bseCode,
      isin: filing.isin,
      companyName: filing.companyName,
    });

    if (!matchedCompany) {
      return;
    }
    stats.matchedCompany++;

    const companyRecord = await db
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.name, matchedCompany.name))
      .limit(1);

    if (companyRecord.length === 0) {
      return;
    }

    const companyId = companyRecord[0].id;

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

    if (!filing.pdfUrl) {
      return;
    }

    await db.update(filings).set({ status: 'DOWNLOADING' }).where(eq(filings.id, insertedFiling.id));

    try {
      const targetFilename = generateDeterministicFilename(
        filing.source,
        matchedCompany.nseSymbol || matchedCompany.bseCode || 'COMPANY',
        filing.filingDate,
        filing.sourceAnnouncementId
      );

      const downloadRes = await downloadPdfStream(filing.pdfUrl, targetFilename);

      const existingPdfMatch = await findFilingByPdfHash(downloadRes.pdfHash);
      if (existingPdfMatch && existingPdfMatch.id !== insertedFiling.id) {
        stats.level2Duplicates++;
        console.log(`[DEDUP] Level 2 duplicate PDF SHA-256 match found (${downloadRes.pdfHash.slice(0, 10)}...).`);
      }

      await db
        .update(filings)
        .set({
          status: 'DOWNLOADED',
          pdfUrl: downloadRes.localPath,
          pdfHash: downloadRes.pdfHash,
        })
        .where(eq(filings.id, insertedFiling.id));

      stats.downloaded++;

      wsManager.broadcast('filing.downloaded', {
        filingId: insertedFiling.id,
        companyId,
        companyName: matchedCompany.name,
        source: filing.source,
        announcementId: filing.sourceAnnouncementId,
        pdfHash: downloadRes.pdfHash,
        byteSize: downloadRes.byteSize,
      });
    } catch (err: any) {
      stats.failed++;
      console.error(`[DOWNLOAD] Failed downloading filing ${insertedFiling.id}:`, err.message);
      await db.update(filings).set({ status: 'FAILED' }).where(eq(filings.id, insertedFiling.id));
    }
  }
}
