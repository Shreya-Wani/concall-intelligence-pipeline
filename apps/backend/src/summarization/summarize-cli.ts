import { queryClient } from '../db';
import { redis } from '../redis';
import { SummarizationService } from './summarization.service';

async function main() {
  console.log('==================================================');
  console.log('🏁 CONCALL INTELLIGENCE PIPELINE: SUMMARIZATION');
  console.log('==================================================');

  // Parse optional --transcript <transcriptId> argument
  const args = process.argv.slice(2);
  let transcriptIdFilter: string | undefined;

  const idx = args.indexOf('--transcript');
  if (idx !== -1 && args[idx + 1]) {
    transcriptIdFilter = args[idx + 1];
    console.log(`[CLI] Filtering summarization for transcript ID: ${transcriptIdFilter}`);
  }

  const summarizationService = new SummarizationService();
  const stats = await summarizationService.summarizeAllExtracted(transcriptIdFilter);

  console.log('\n==================================================');
  console.log('📊 SUMMARIZATION SUMMARY REPORT');
  console.log('==================================================');
  console.log(`  • Total Transcripts Eligible: ${stats.totalEligible}`);
  console.log(`  • Successfully Summarized:   ${stats.summarizedSuccess}`);
  console.log(`  • Failed Summarizations:     ${stats.failedCount}`);
  console.log('==================================================\n');

  await queryClient.end();
  await redis.quit().catch(() => {});
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Summarize CLI error:', err);
  process.exit(1);
});
