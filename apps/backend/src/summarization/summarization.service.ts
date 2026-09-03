import { eq } from 'drizzle-orm';
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
      }
      console.log(`[MAP] Map phase completed for ${mapResults.length} chunks.`);

      // Determine quarter string (default Q1 FY26 or from filing date)
      const year = filing.filingDate ? new Date(filing.filingDate).getFullYear() : 2026;
      const quarterStr = `Q1 FY${String(year).slice(-2)}`;

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
      const [insertedSummary] = await db
        .insert(summaries)
        .values({
          transcriptId: transcript.id,
          model: reduceResult.model,
          promptVersion: reduceResult.promptVersion,
          summaryJson: reduceResult.summaryJson,
          summaryMarkdown: reduceResult.summaryMarkdown,
        })
        .onConflictDoUpdate({
          target: summaries.transcriptId,
          set: {
            model: reduceResult.model,
            promptVersion: reduceResult.promptVersion,
            summaryJson: reduceResult.summaryJson,
            summaryMarkdown: reduceResult.summaryMarkdown,
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
