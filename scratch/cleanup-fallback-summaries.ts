import fs from 'fs';
import path from 'path';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../apps/backend/src/db';
import { filings, summaries } from '../apps/backend/src/db/schema';

async function cleanupFallbackSummaries() {
  console.log('🧹 Cleaning up invalid ungrounded fallback summary data...');

  // 1. Delete all summary records from PostgreSQL summaries table
  const allSummaries = await db.select({ id: summaries.id, transcriptId: summaries.transcriptId }).from(summaries);
  console.log(`Found ${allSummaries.length} summary records in PostgreSQL database.`);

  if (allSummaries.length > 0) {
    await db.delete(summaries);
    console.log(`✅ Deleted ${allSummaries.length} summary records from PostgreSQL.`);
  }

  // 2. Revert filing statuses from COMPLETED back to EXTRACTED
  const completedFilings = await db
    .select({ id: filings.id })
    .from(filings)
    .where(eq(filings.status, 'COMPLETED'));

  console.log(`Found ${completedFilings.length} filings with status = COMPLETED.`);

  for (const f of completedFilings) {
    await db.update(filings).set({ status: 'EXTRACTED' }).where(eq(filings.id, f.id));
    console.log(`  ✓ Reverted filing ${f.id} status to EXTRACTED`);
  }

  // 3. Remove ungrounded summary artifacts from data/summaries/
  const summariesDir = path.resolve(__dirname, '../data/summaries');
  if (fs.existsSync(summariesDir)) {
    const files = fs.readdirSync(summariesDir);
    for (const file of files) {
      const filePath = path.join(summariesDir, file);
      fs.unlinkSync(filePath);
      console.log(`  ✓ Deleted artifact: ${file}`);
    }
  }

  console.log('✅ Cleanup completed successfully.');
}

cleanupFallbackSummaries().then(() => process.exit(0)).catch((err) => {
  console.error('Cleanup error:', err);
  process.exit(1);
});
