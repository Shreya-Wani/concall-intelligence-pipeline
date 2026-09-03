import { env } from '../config/env';
import { queryClient } from '../db';
import { redis } from '../redis';
import { WatcherService } from './watcher.service';

class ContinuousWatcher {
  private watcherService: WatcherService;
  private isRunning: boolean = true;
  private nseTimer?: NodeJS.Timeout;
  private bseTimer?: NodeJS.Timeout;

  constructor() {
    this.watcherService = new WatcherService();
  }

  public async start(): Promise<void> {
    console.log('==================================================');
    console.log('📡 CONCALL INTELLIGENCE PIPELINE: CONTINUOUS WATCHER');
    console.log(`• NSE Poll Interval: ${env.NSE_POLL_INTERVAL_MS}ms`);
    console.log(`• BSE Poll Interval: ${env.BSE_POLL_INTERVAL_MS}ms`);
    console.log('==================================================');

    this.setupGracefulShutdown();

    // Initial polling cycles
    await this.pollNse();
    await this.pollBse();

    // Schedule continuous loops
    this.scheduleNse();
    this.scheduleBse();
  }

  private scheduleNse(): void {
    if (!this.isRunning) return;
    this.nseTimer = setTimeout(async () => {
      await this.pollNse();
      this.scheduleNse();
    }, env.NSE_POLL_INTERVAL_MS);
  }

  private scheduleBse(): void {
    if (!this.isRunning) return;
    this.bseTimer = setTimeout(async () => {
      await this.pollBse();
      this.scheduleBse();
    }, env.BSE_POLL_INTERVAL_MS);
  }

  private async pollNse(): Promise<void> {
    if (!this.isRunning) return;
    try {
      console.log(`\n[LOOP] [${new Date().toISOString()}] Polling NSE...`);
      await this.watcherService.ingestNse();
    } catch (err: any) {
      console.error('[LOOP] NSE polling loop error (handled):', err.message);
    }
  }

  private async pollBse(): Promise<void> {
    if (!this.isRunning) return;
    try {
      console.log(`\n[LOOP] [${new Date().toISOString()}] Polling BSE...`);
      await this.watcherService.ingestBse();
    } catch (err: any) {
      console.error('[LOOP] BSE polling loop error (handled):', err.message);
    }
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      console.log(`\n🛑 Received ${signal}. Initiating graceful shutdown...`);
      this.isRunning = false;

      if (this.nseTimer) clearTimeout(this.nseTimer);
      if (this.bseTimer) clearTimeout(this.bseTimer);

      try {
        await queryClient.end();
        await redis.quit().catch(() => {});
        console.log('✅ Connections closed cleanly. Watcher stopped.');
      } catch (err: any) {
        console.error('Error during shutdown:', err.message);
      }
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  }
}

const watcher = new ContinuousWatcher();
watcher.start().catch((err) => {
  console.error('❌ Fatal error in Continuous Watcher:', err);
  process.exit(1);
});
