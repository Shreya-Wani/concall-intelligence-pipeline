import fs from 'fs';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { companies, filings, transcripts } from '../db/schema';
import { wsManager } from '../ws/websocket.server';
import { extractPdfText } from './pdf-extractor';
import { evaluateTranscriptQuality } from './quality-check';
import { cleanTranscriptText } from './text-cleaner';
import { ExtractionMetadata } from './types';

export interface ExtractionStats {
  totalProcessed: number;
  extractedSuccess: number;
  ocrRequiredFailed: number;
  failedTechnical: number;
}

export class ExtractionService {
  public async extractAllDownloaded(filingIdFilter?: string): Promise<ExtractionStats> {
    const stats: ExtractionStats = {
      totalProcessed: 0,
      extractedSuccess: 0,
      ocrRequiredFailed: 0,
      failedTechnical: 0,
    };

    console.log('🚀 Starting PDF transcript extraction cycle...');

    let query = db.select().from(filings).where(eq(filings.status, 'DOWNLOADED'));
    if (filingIdFilter) {
      query = db.select().from(filings).where(eq(filings.id, filingIdFilter));
    }

    const targetFilings = await query;
    stats.totalProcessed = targetFilings.length;
    console.log(`[EXTRACTION] Found ${targetFilings.length} filings eligible for extraction.`);

    for (const filing of targetFilings) {
      try {
        await this.processSingleFiling(filing, stats);
      } catch (err: any) {
        stats.failedTechnical++;
        console.error(`[EXTRACTION] Technical error extracting filing ${filing.id}:`, err.message);
        wsManager.broadcast('pipeline.error', {
          stage: 'extraction',
          filingId: filing.id,
          errorMessage: err.message,
        });
      }
    }

    console.log('✅ PDF extraction cycle completed.');
    return stats;
  }

  private async processSingleFiling(filing: typeof filings.$inferSelect, stats: ExtractionStats): Promise<void> {
    console.log(`\n[EXTRACTION] Processing filing ${filing.id} (${filing.source} ID: ${filing.sourceAnnouncementId})...`);

    // Fetch company name for events
    const companyRes = await db.select({ name: companies.name }).from(companies).where(eq(companies.id, filing.companyId)).limit(1);
    const companyName = companyRes[0]?.name || 'Unknown Company';

    // 1. Status Transition -> EXTRACTING
    await db.update(filings).set({ status: 'EXTRACTING' }).where(eq(filings.id, filing.id));

    // Verify PDF local path
    const pdfPath = filing.pdfUrl;
    if (!pdfPath || !fs.existsSync(pdfPath)) {
      console.error(`[EXTRACTION] Local PDF file not found at path: ${pdfPath}`);
      await db.update(filings).set({ status: 'FAILED' }).where(eq(filings.id, filing.id));
      stats.failedTechnical++;
      wsManager.broadcast('pipeline.error', {
        stage: 'extraction',
        filingId: filing.id,
        companyName,
        errorMessage: 'Local PDF file missing',
      });
      return;
    }

    try {
      // 2. Extract PDF Raw Text
      console.log(`[PDF] Reading pages from ${pdfPath}...`);
      const rawResult = await extractPdfText(pdfPath);
      console.log(`[PDF] Extracted ${rawResult.pageCount} pages.`);

      // 3. Clean Text
      const cleaned = cleanTranscriptText(rawResult.pages);
      console.log(`[CLEAN] Cleaned character count: ${cleaned.characterCount}`);

      // 4. Quality Evaluation
      const quality = evaluateTranscriptQuality(cleaned.cleanedText, rawResult.pageCount, rawResult.pages);
      console.log(`[QUALITY] Score: ${quality.score}, Passed: ${quality.passed}`);

      // 5. Handle Scanned / Image-Only PDF (OCR Required)
      if (quality.isScannedPdf || !quality.passed) {
        stats.ocrRequiredFailed++;
        console.warn(`[EXTRACTION] Filing ${filing.id} requires OCR. Marking status FAILED.`);

        const ocrMetadata: ExtractionMetadata = {
          extractionMethod: 'OCR_REQUIRED',
          pageCount: rawResult.pageCount,
          characterCount: cleaned.characterCount,
          quality,
          extractedAt: new Date().toISOString(),
        };

        // Persist transcript with extraction_method = 'OCR_REQUIRED'
        await db
          .insert(transcripts)
          .values({
            filingId: filing.id,
            text: cleaned.cleanedText || '[SCANNED IMAGE PDF - OCR REQUIRED]',
            characterCount: cleaned.characterCount,
            pageCount: rawResult.pageCount,
            extractionMethod: 'OCR_REQUIRED',
            extractionMetadata: ocrMetadata,
          })
          .onConflictDoUpdate({
            target: transcripts.filingId,
            set: {
              text: cleaned.cleanedText || '[SCANNED IMAGE PDF - OCR REQUIRED]',
              characterCount: cleaned.characterCount,
              pageCount: rawResult.pageCount,
              extractionMethod: 'OCR_REQUIRED',
              extractionMetadata: ocrMetadata,
            },
          });

        // Mark filing status = FAILED
        await db.update(filings).set({ status: 'FAILED' }).where(eq(filings.id, filing.id));

        wsManager.broadcast('pipeline.error', {
          stage: 'extraction',
          filingId: filing.id,
          companyName,
          errorMessage: 'Scanned image PDF detected. Low text density. OCR required.',
        });
        return;
      }

      // 6. Successful Extraction -> Persist to DB & Mark EXTRACTED
      const successMetadata: ExtractionMetadata = {
        extractionMethod: 'pdf_text',
        pageCount: rawResult.pageCount,
        characterCount: cleaned.characterCount,
        quality,
        extractedAt: new Date().toISOString(),
      };

      const [insertedTranscript] = await db
        .insert(transcripts)
        .values({
          filingId: filing.id,
          text: cleaned.cleanedText,
          characterCount: cleaned.characterCount,
          pageCount: rawResult.pageCount,
          extractionMethod: 'pdf_text',
          extractionMetadata: successMetadata,
        })
        .onConflictDoUpdate({
          target: transcripts.filingId,
          set: {
            text: cleaned.cleanedText,
            characterCount: cleaned.characterCount,
            pageCount: rawResult.pageCount,
            extractionMethod: 'pdf_text',
            extractionMetadata: successMetadata,
          },
        })
        .returning({ id: transcripts.id });

      // Status Transition -> EXTRACTED
      await db.update(filings).set({ status: 'EXTRACTED' }).where(eq(filings.id, filing.id));

      stats.extractedSuccess++;
      console.log(`[DB] Transcript stored. Filing ${filing.id} updated to status EXTRACTED.`);

      // Broadcast transcript.extracted AFTER DB persistence
      wsManager.broadcast('transcript.extracted', {
        filingId: filing.id,
        transcriptId: insertedTranscript ? insertedTranscript.id : filing.id,
        companyName,
        pageCount: rawResult.pageCount,
        characterCount: cleaned.characterCount,
        extractionMethod: 'pdf_text',
      });
    } catch (err: any) {
      stats.failedTechnical++;
      console.error(`[EXTRACTION] Error processing filing ${filing.id}:`, err.message);
      await db.update(filings).set({ status: 'FAILED' }).where(eq(filings.id, filing.id));

      wsManager.broadcast('pipeline.error', {
        stage: 'extraction',
        filingId: filing.id,
        companyName,
        errorMessage: err.message,
      });
    }
  }
}
