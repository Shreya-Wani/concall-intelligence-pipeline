import { eq } from 'drizzle-orm';
import { env } from '../config/env';
import { db } from '../db';
import { companies, filings, summaries, transcripts } from '../db/schema';
import { wsManager } from '../ws/websocket.server';
import { LlmClient } from './llm-client';
import { MapReduceEngine } from './map-reduce.engine';
import { chunkTranscript } from './text-chunker';
import { MapChunkResult, SummarizationResult } from './types';

export interface SummarizationStats {
  totalEligible: number;
  summarizedSuccess: number;
  failedCount: number;
}

/**
 * Sanitize a string for storage in a WIN1252-encoded PostgreSQL database.
 *
 * The Groq model (and potentially other LLMs) can emit characters that are
 * valid UTF-8 but outside the Windows-1252 code page — most commonly
 * U+202F NARROW NO-BREAK SPACE.  Since our dev DB was created with
 * client_encoding=WIN1252, postgres-js raises an encoding error when it
 * tries to send those bytes.
 *
 * Strategy:
 *   1. Map common Unicode whitespace variants to plain ASCII space.
 *   2. Replace the ₹ Rupee sign (outside WIN1252) with "Rs ".
 *   3. Drop any remaining codepoint that has no WIN1252 equivalent
 *      (code points > 0x00FF that are not in the WIN1252 extension range).
 */
function sanitizeForWin1252(value: string): string {
  return (
    value
      // Unicode whitespace → plain space
      .replace(/[\u00A0\u202F\u2007\u2060\uFEFF]/g, ' ')
      // Rupee sign (already handled below but keep for clarity)
      .replace(/₹/g, 'Rs ')
      // Smart quotes → ASCII equivalents
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      // Em/en dashes → hyphen
      .replace(/[\u2013\u2014]/g, '-')
      // Ellipsis → three dots
      .replace(/\u2026/g, '...')
      // Bullet / middle dot variants
      .replace(/[\u2022\u2023\u25E6\u2219\u00B7]/g, '*')
      // Drop any remaining non-WIN1252 characters (codepoints outside 0x0000-0x00FF
      // that are not in the explicit WIN1252 extension 0x0080-0x009F mapped range).
      // Simple heuristic: keep only codepoints ≤ 0x00FF (Latin-1 supplement),
      // which WIN1252 supports, plus safe printable ASCII.
      // eslint-disable-next-line no-control-regex
      .replace(/[^\x00-\xFF]/g, '')
  );
}

export class SummarizationService {
  private llmClient: LlmClient;
  private mapReduceEngine: MapReduceEngine;

  constructor() {
    this.llmClient = new LlmClient();
    this.mapReduceEngine = new MapReduceEngine(this.llmClient);
  }

  public async summarizeAllExtracted(transcriptIdFilter?: string): Promise<SummarizationStats> {
    const stats: SummarizationStats = {
      totalEligible: 0,
      summarizedSuccess: 0,
      failedCount: 0,
    };

    console.log('🚀 Starting transcript summarization cycle...');
    console.log(`[SUMMARIZATION] Configured LLM Provider: "${this.llmClient.getProviderName()}"`);

    // Query transcripts where filing status = 'EXTRACTED'
    const records = await db
      .select({
        transcript: transcripts,
        filing: filings,
        company: companies,
      })
      .from(transcripts)
      .innerJoin(filings, eq(transcripts.filingId, filings.id))
      .innerJoin(companies, eq(filings.companyId, companies.id))
      .where(eq(filings.status, 'EXTRACTED'));

    const filteredRecords = transcriptIdFilter
      ? records.filter((r) => r.transcript.id === transcriptIdFilter)
      : records;

    stats.totalEligible = filteredRecords.length;
    console.log(`[SUMMARIZATION] Found ${filteredRecords.length} transcripts eligible for summarization.`);

    if (filteredRecords.length === 0) {
      console.log('ℹ No EXTRACTED transcripts available for live summarization.');
      return stats;
    }

    for (const record of filteredRecords) {
      try {
        await this.processSingleTranscript(record, stats);
      } catch (err: any) {
        stats.failedCount++;
        console.error(`[SUMMARIZATION] Error summarizing transcript ${record.transcript.id}:`, err.message);
        wsManager.broadcast('pipeline.error', {
          stage: 'summarization',
          filingId: record.filing.id,
          companyName: record.company.name,
          errorMessage: err.message,
        });
      }
    }

    console.log('✅ Transcript summarization cycle completed.');
    return stats;
  }

  private async processSingleTranscript(
    record: {
      transcript: typeof transcripts.$inferSelect;
      filing: typeof filings.$inferSelect;
      company: typeof companies.$inferSelect;
    },
    stats: SummarizationStats
  ): Promise<void> {
    const { transcript, filing, company } = record;
    console.log(`\n[SUMMARIZATION] Processing transcript ID ${transcript.id} (${company.name} - ${filing.source} ${filing.sourceAnnouncementId})...`);

    try {
      // 1. Chunk Transcript
      const chunks = chunkTranscript(transcript.text);
      console.log(`[CHUNKING] Split transcript into ${chunks.length} chunks.`);

      // 2. Map Phase (Extract intermediate chunk claims)
      const mapResults: MapChunkResult[] = [];
      for (const chunk of chunks) {
        console.log(`[MAP] Processing chunk #${chunk.chunkIndex + 1}/${chunks.length}...`);
        const mapRes = await this.mapReduceEngine.mapChunk(chunk);
        mapResults.push(mapRes);
        // Pause between chunk calls to comfortably respect Gemini API rate limits
        if (chunks.length > 1) {
          const mapDelay = env.LLM_REQUEST_DELAY_MS || env.GEMINI_MAP_DELAY_MS || 5000;
          await new Promise((r) => setTimeout(r, mapDelay));
        }
      }
      console.log(`[MAP] Map phase completed for ${mapResults.length} chunks.`);

      // Determine quarter string from filing subject or filing date
      let quarterStr = 'Q1 FY25';
      if (filing.subject && /Q[1-4]\s*FY\d{2}/i.test(filing.subject)) {
        const match = filing.subject.match(/Q[1-4]\s*FY\d{2}/i);
        if (match) quarterStr = match[0].toUpperCase();
      } else if (filing.filingDate) {
        const year = new Date(filing.filingDate).getFullYear();
        quarterStr = `Q1 FY${String(year).slice(-2)}`;
      }

      // 3. Reduce Phase (Synthesize into SummaryContentSchema)
      console.log(`[REDUCE] Synthesizing summary for ${company.name}...`);
      const reduceResult: SummarizationResult = await this.mapReduceEngine.reduceSummaries({
        company: company.name,
        quarter: quarterStr,
        nseSymbol: company.nseSymbol,
        bseCode: company.bseCode,
        source: filing.source,
        sourceUrl: filing.sourceUrl,
        mapResults,
      });

      console.log(`[REDUCE] Reduce phase completed. Schema validation PASSED.`);

      // 4. Persist to summaries table
      // Sanitize LLM output for WIN1252-encoded dev database: replace Unicode
      // whitespace variants, smart punctuation, and drop any remaining
      // codepoint that WIN1252 cannot represent (e.g. U+202F narrow no-break space).
      const dbSafeMarkdown = sanitizeForWin1252(reduceResult.summaryMarkdown);
      // Sanitize JSON: stringify → clean non-WIN1252 chars → parse back to object
      // so Drizzle can correctly INSERT into the jsonb column.
      const rawJsonString =
        typeof reduceResult.summaryJson === 'string'
          ? reduceResult.summaryJson
          : JSON.stringify(reduceResult.summaryJson);
      const dbSafeJson: unknown = JSON.parse(sanitizeForWin1252(rawJsonString));

      const [insertedSummary] = await db
        .insert(summaries)
        .values({
          transcriptId: transcript.id,
          model: reduceResult.model,
          promptVersion: reduceResult.promptVersion,
          summaryJson: dbSafeJson,
          summaryMarkdown: dbSafeMarkdown,
        })
        .onConflictDoUpdate({
          target: summaries.transcriptId,
          set: {
            model: reduceResult.model,
            promptVersion: reduceResult.promptVersion,
            summaryJson: dbSafeJson,
            summaryMarkdown: dbSafeMarkdown,
          },
        })
        .returning({ id: summaries.id });

      // 5. Update filing status -> COMPLETED
      await db.update(filings).set({ status: 'COMPLETED' }).where(eq(filings.id, filing.id));

      stats.summarizedSuccess++;
      console.log(`[DB] Summary stored for transcript ${transcript.id}. Filing status updated to COMPLETED.`);

      // Broadcast summary.completed AFTER DB persistence
      wsManager.broadcast('summary.completed', {
        summaryId: insertedSummary ? insertedSummary.id : transcript.id,
        filingId: filing.id,
        companyId: company.id,
        companyName: company.name,
        quarter: quarterStr,
        model: reduceResult.model,
      });
    } catch (err: any) {
      stats.failedCount++;
      console.error(`[SUMMARIZATION] Failed summarizing filing ${filing.id}:`, err.message);
      wsManager.broadcast('pipeline.error', {
        stage: 'summarization',
        filingId: filing.id,
        companyName: company.name,
        errorMessage: err.message,
      });
      throw err;
    }
  }
}
