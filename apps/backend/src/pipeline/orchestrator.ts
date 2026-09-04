import { eq, inArray } from 'drizzle-orm';
import { db } from '../db';
import { filings } from '../db/schema';
import { ExtractionService } from '../extraction/extraction.service';
import { SummarizationService } from '../summarization/summarization.service';
import { WatcherService } from '../watcher/watcher.service';
import { env } from '../config/env';
import { bus } from './bus';

const STUCK_STATUSES = ['DOWNLOADING', 'EXTRACTING', 'SUMMARIZING'] as const;

/**
 * PipelineOrchestrator chains the three pipeline stages:
 *   Watch & Ingest → Extract → Summarize
 *
 * It runs entirely in-process (same Node.js instance as the API server),
 * so the bus → WS bridge can forward events to connected browsers.
 */
export class PipelineOrchestrator {
  private watcher: WatcherService;
  private extractor: ExtractionService;
  private summarizer: SummarizationService;

  private nseTimer: NodeJS.Timeout | null = null;
  private bseTimer: NodeJS.Timeout | null = null;
  private running = false;

  // Serial queue: ensures only one filing is in extraction/summarization at a time
  // (avoids parallel LLM calls hammering the free-tier rate limit)
  private queue: string[] = [];
  private processing = false;

  constructor() {
    this.watcher = new WatcherService();
    this.extractor = new ExtractionService();
    this.summarizer = new SummarizationService();
  }

  /** Start polling both exchanges and resume any stuck filings from previous runs. */
  public async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    console.log('[ORCHESTRATOR] Starting pipeline orchestrator...');

    // Resume filings stuck mid-run from a previous crash
    await this.recoverStuckFilings();

    // Subscribe: when watcher marks a filing DOWNLOADED, queue it
    bus.on('filing.downloaded', ({ filingId }) => {
      this.enqueue(filingId);
    });

    // Poll NSE
    const pollNse = async () => {
      try {
        await this.watcher.ingestNse();
      } catch (err: any) {
        console.error('[ORCHESTRATOR] NSE poll error:', err.message);
      }
      bus.emit('watcher.heartbeat', {
        source: 'NSE',
        checkedAt: new Date().toISOString(),
        nextCheckMs: env.NSE_POLL_INTERVAL_MS,
      });
      this.nseTimer = setTimeout(pollNse, env.NSE_POLL_INTERVAL_MS);
    };

    // Poll BSE
    const pollBse = async () => {
      try {
        await this.watcher.ingestBse();
      } catch (err: any) {
        console.error('[ORCHESTRATOR] BSE poll error:', err.message);
      }
      bus.emit('watcher.heartbeat', {
        source: 'BSE',
        checkedAt: new Date().toISOString(),
        nextCheckMs: env.BSE_POLL_INTERVAL_MS,
      });
      this.bseTimer = setTimeout(pollBse, env.BSE_POLL_INTERVAL_MS);
    };

    // Stagger start slightly so NSE/BSE don't fire at the exact same millisecond
    this.nseTimer = setTimeout(pollNse, 0);
    this.bseTimer = setTimeout(pollBse, 5000);

    console.log('[ORCHESTRATOR] Pipeline orchestrator started.');
  }

  public stop(): void {
    this.running = false;
    if (this.nseTimer) { clearTimeout(this.nseTimer); this.nseTimer = null; }
    if (this.bseTimer) { clearTimeout(this.bseTimer); this.bseTimer = null; }
    bus.off('filing.downloaded', ({ filingId }: { filingId: string }) => this.enqueue(filingId));
    console.log('[ORCHESTRATOR] Pipeline orchestrator stopped.');
  }

  private enqueue(filingId: string): void {
    if (!this.queue.includes(filingId)) {
      this.queue.push(filingId);
      console.log(`[ORCHESTRATOR] Enqueued filing ${filingId} (queue depth: ${this.queue.length})`);
    }
    this.drainQueue();
  }

  private async drainQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const filingId = this.queue.shift()!;
      await this.processOneFiling(filingId);
    }

    this.processing = false;
  }

  private async processOneFiling(filingId: string): Promise<void> {
    console.log(`[ORCHESTRATOR] Processing filing ${filingId}...`);
    try {
      // Stage 2: Extract
      const extractStats = await this.extractor.extractAllDownloaded(filingId);
      if (extractStats.extractedSuccess === 0) {
        console.warn(`[ORCHESTRATOR] Extraction produced no result for filing ${filingId}.`);
        return;
      }

      // Stage 3: Summarize
      await this.summarizer.summarizeAllExtracted(filingId);
    } catch (err: any) {
      console.error(`[ORCHESTRATOR] Error processing filing ${filingId}:`, err.message);
      bus.emit('pipeline.error', {
        stage: 'summarization',
        filingId,
        errorMessage: err.message,
      });
    }
  }

  /**
   * On boot, find filings stuck in mid-transition states from a previous crash
   * and re-queue them so nothing is lost.
   */
  private async recoverStuckFilings(): Promise<void> {
    try {
      const stuckFilings = await db
        .select({ id: filings.id, status: filings.status })
        .from(filings)
        .where(inArray(filings.status, [...STUCK_STATUSES]));

      if (stuckFilings.length === 0) return;

      console.log(`[ORCHESTRATOR] Recovering ${stuckFilings.length} stuck filing(s)...`);

      for (const f of stuckFilings) {
        // Reset to the last safe state so the next stage can pick it up
        if (f.status === 'DOWNLOADING') {
          await db.update(filings).set({ status: 'DISCOVERED' }).where(eq(filings.id, f.id));
        } else if (f.status === 'EXTRACTING') {
          await db.update(filings).set({ status: 'DOWNLOADED' }).where(eq(filings.id, f.id));
          this.enqueue(f.id);
        } else if (f.status === 'SUMMARIZING') {
          await db.update(filings).set({ status: 'EXTRACTED' }).where(eq(filings.id, f.id));
          this.enqueue(f.id);
        }
      }
    } catch (err: any) {
      console.warn('[ORCHESTRATOR] Could not recover stuck filings:', err.message);
    }
  }
}

export const orchestrator = new PipelineOrchestrator();
