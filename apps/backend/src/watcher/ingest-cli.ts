import { WatcherService } from './watcher.service';
import { queryClient } from '../db';
import { redis } from '../redis';

async function runOnce() {
  console.log('==================================================');
  console.log('🏁 CONCALL INTELLIGENCE PIPELINE: ONE-SHOT INGESTION');
  console.log('==================================================');

  const watcherService = new WatcherService();
  const results = await watcherService.runSingleIngestion();

  console.log('\n==================================================');
  console.log('📊 INGESTION SUMMARY REPORT');
  console.log('==================================================');

  for (const stats of results) {
    console.log(`\nSOURCE: [${stats.source}]`);
    console.log(`  • Total Fetched:          ${stats.totalFetched}`);
    console.log(`  • Transcript Filtered:   ${stats.transcriptFiltered}`);
    console.log(`  • Matched Company:        ${stats.matchedCompany}`);
    console.log(`  • Level 1 Duplicates:     ${stats.level1Duplicates}`);
    console.log(`  • Level 2 PDF Duplicates: ${stats.level2Duplicates}`);
    console.log(`  • Successfully Saved PDF: ${stats.downloaded}`);
    console.log(`  • Failed Downloads:       ${stats.failed}`);
  }

  console.log('\n==================================================\n');

  // Close DB and Redis connections
  await queryClient.end();
  await redis.quit().catch(() => {});
  process.exit(0);
}

runOnce().catch((err) => {
  console.error('❌ Ingestion CLI error:', err);
  process.exit(1);
});
