import { queryClient } from '../db';
import { redis } from '../redis';
import { ExtractionService } from './extraction.service';

async function main() {
  console.log('==================================================');
  console.log('🏁 CONCALL INTELLIGENCE PIPELINE: PDF EXTRACTION');
  console.log('==================================================');

  // Parse optional --filing <filingId> argument
  const args = process.argv.slice(2);
  let filingIdFilter: string | undefined;

  const filingIdx = args.indexOf('--filing');
  if (filingIdx !== -1 && args[filingIdx + 1]) {
    filingIdFilter = args[filingIdx + 1];
    console.log(`[CLI] Filtering extraction for filing ID: ${filingIdFilter}`);
  }

  const extractionService = new ExtractionService();
  const stats = await extractionService.extractAllDownloaded(filingIdFilter);

  console.log('\n==================================================');
  console.log('📊 EXTRACTION SUMMARY REPORT');
  console.log('==================================================');
  console.log(`  • Total Filings Eligible: ${stats.totalProcessed}`);
  console.log(`  • Successfully Extracted: ${stats.extractedSuccess}`);
  console.log(`  • OCR Required (Failed):  ${stats.ocrRequiredFailed}`);
  console.log(`  • Technical Failures:     ${stats.failedTechnical}`);
  console.log('==================================================\n');

  await queryClient.end();
  await redis.quit().catch(() => {});
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Extraction CLI error:', err);
  process.exit(1);
});
