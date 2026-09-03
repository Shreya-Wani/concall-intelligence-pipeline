import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { companies, filings, summaries, transcripts } from '../db/schema';
import { ExtractionService } from '../extraction/extraction.service';
import { SummarizationService } from '../summarization/summarization.service';
import { wsManager } from '../ws/websocket.server';

function parseArgs() {
  const args = process.argv.slice(2);
  const params: Record<string, string> = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].replace(/^--/, '');
      const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : 'true';
      params[key] = value;
      if (value !== 'true') i++;
    }
  }

  return params;
}

export async function runManualIngestion() {
  const params = parseArgs();
  const filePath = params.file;
  const companyKey = params.company?.toUpperCase();
  const quarterStr = params.quarter || 'Q1 FY25';
  const sourceStr = (params.source?.toUpperCase() as 'NSE' | 'BSE') || 'BSE';
  const sourceUrl = params['source-url'] || 'https://www.bseindia.com/corporates';

  if (!filePath || !companyKey) {
    console.error('❌ Usage: pnpm --filter @concall/backend ingest:manual --file "<PDF_PATH>" --company "<TCS|TATAMOTORS|SUNPHARMA>" [--quarter "Q1 FY25"] [--source "NSE|BSE"] [--source-url "<URL>"]');
    process.exit(1);
  }

  // Safety Check: Reject fallback provider during real manual ingestion
  const llmProvider = (process.env.LLM_PROVIDER || 'fallback').toLowerCase();
  if (llmProvider === 'fallback' && process.env.NODE_ENV !== 'test') {
    console.error('❌ Fallback LLM provider is disabled for real manual ingestion. Configure GEMINI_API_KEY or OPENAI_API_KEY.');
    process.exit(1);
  }

  const absolutePdfPath = path.resolve(filePath);
  if (!fs.existsSync(absolutePdfPath)) {
    console.error(`❌ PDF file not found at path: ${absolutePdfPath}`);
    process.exit(1);
  }

  // 1. Verify PDF Magic Bytes (%PDF)
  const buffer = fs.readFileSync(absolutePdfPath);
  const magic = buffer.subarray(0, 4).toString();
  if (magic !== '%PDF') {
    console.error(`❌ File ${absolutePdfPath} is not a valid PDF document (magic bytes: "${magic}")`);
    process.exit(1);
  }

  const sha256Hash = crypto.createHash('sha256').update(buffer).digest('hex');
  const byteSize = buffer.length;

  console.log(`\n========================================`);
  console.log(`🚀 Starting Manual Transcript Ingestion`);
  console.log(`Company Key: ${companyKey}`);
  console.log(`Quarter: ${quarterStr}`);
  console.log(`PDF Path: ${absolutePdfPath} (${byteSize.toLocaleString()} bytes, SHA-256: ${sha256Hash.slice(0, 12)}...)`);
  console.log(`Source Provenance: ${sourceStr} (${sourceUrl})`);
  console.log(`========================================\n`);

  // 2. Query seeded company from DB
  const companyRecord = await db
    .select()
    .from(companies)
    .where(eq(companies.nseSymbol, companyKey))
    .limit(1);

  if (companyRecord.length === 0) {
    console.error(`❌ Company with nseSymbol "${companyKey}" not found in PostgreSQL companies table.`);
    process.exit(1);
  }

  const company = companyRecord[0];
  const announcementId = `MANUAL-${companyKey}-${quarterStr.replace(/\s+/g, '')}-${Date.now().toString().slice(-6)}`;
  const subject = `Transcript of Earnings Call ${quarterStr} - ${company.name}`;

  // 3. Create Filing as DISCOVERED
  const [insertedFiling] = await db
    .insert(filings)
    .values({
      companyId: company.id,
      source: sourceStr,
      sourceAnnouncementId: announcementId,
      filingDate: new Date(),
      eventType: 'Earnings Call Transcript',
      subject,
      sourceUrl,
      pdfUrl: absolutePdfPath,
      status: 'DISCOVERED',
    })
    .returning({ id: filings.id });

  console.log(`[DB] Created filing record ${insertedFiling.id} (DISCOVERED)`);

  wsManager.broadcast('filing.discovered', {
    filingId: insertedFiling.id,
    companyId: company.id,
    companyName: company.name,
    source: sourceStr,
    announcementId,
    subject,
    filingDate: new Date().toISOString(),
  });

  // 4. Update Filing status to DOWNLOADED with PDF local path and SHA-256 hash
  await db
    .update(filings)
    .set({
      status: 'DOWNLOADED',
      pdfUrl: absolutePdfPath,
      pdfHash: sha256Hash,
    })
    .where(eq(filings.id, insertedFiling.id));

  console.log(`[DB] Filing ${insertedFiling.id} updated to DOWNLOADED`);

  wsManager.broadcast('filing.downloaded', {
    filingId: insertedFiling.id,
    companyId: company.id,
    companyName: company.name,
    source: sourceStr,
    announcementId,
    pdfHash: sha256Hash,
    byteSize,
  });

  // 5. Execute ExtractionService
  console.log(`\n--- Stage 2: Running PDF Text Extraction ---`);
  const extractionService = new ExtractionService();
  const extractionStats = await extractionService.extractAllDownloaded(insertedFiling.id);

  if (extractionStats.extractedSuccess === 0) {
    console.error(`❌ PDF extraction failed or required OCR for filing ${insertedFiling.id}.`);
    process.exit(1);
  }

  // Query extracted transcript ID
  const transcriptRes = await db
    .select()
    .from(transcripts)
    .where(eq(transcripts.filingId, insertedFiling.id))
    .limit(1);

  if (transcriptRes.length === 0) {
    console.error(`❌ Transcript record not found after extraction.`);
    process.exit(1);
  }

  const transcript = transcriptRes[0];

  // Save clean extracted text artifact under data/extracted/
  const extractedDir = path.resolve(process.cwd(), '../../data/extracted');
  if (!fs.existsSync(extractedDir)) fs.mkdirSync(extractedDir, { recursive: true });
  const textArtifactPath = path.join(extractedDir, `${companyKey}_${quarterStr.replace(/\s+/g, '_')}_Transcript.txt`);
  fs.writeFileSync(textArtifactPath, transcript.text, 'utf-8');
  console.log(`💾 Saved extracted text artifact to: ${textArtifactPath}`);

  // 6. Execute SummarizationService
  console.log(`\n--- Stage 3: Running Chunking & LLM Map-Reduce Summarization ---`);
  const summarizationService = new SummarizationService();
  const summaryStats = await summarizationService.summarizeAllExtracted(transcript.id);

  if (summaryStats.summarizedSuccess === 0) {
    console.error(`❌ Summarization failed for transcript ${transcript.id}. Check LLM provider configuration.`);
    process.exit(1);
  }

  // Query summary record
  const summaryRes = await db
    .select()
    .from(summaries)
    .where(eq(summaries.transcriptId, transcript.id))
    .limit(1);

  if (summaryRes.length === 0) {
    console.error(`❌ Summary record not found after summarization.`);
    process.exit(1);
  }

  const summary = summaryRes[0];

  // Save summary JSON & Markdown artifacts under data/summaries/
  const summariesDir = path.resolve(process.cwd(), '../../data/summaries');
  if (!fs.existsSync(summariesDir)) fs.mkdirSync(summariesDir, { recursive: true });

  const jsonArtifactPath = path.join(summariesDir, `${companyKey}_${quarterStr.replace(/\s+/g, '_')}_Summary.json`);
  const mdArtifactPath = path.join(summariesDir, `${companyKey}_${quarterStr.replace(/\s+/g, '_')}_Summary.md`);

  fs.writeFileSync(jsonArtifactPath, JSON.stringify(summary.summaryJson, null, 2), 'utf-8');
  fs.writeFileSync(mdArtifactPath, summary.summaryMarkdown, 'utf-8');

  console.log(`💾 Saved summary JSON artifact to: ${jsonArtifactPath}`);
  console.log(`💾 Saved summary Markdown artifact to: ${mdArtifactPath}`);

  console.log(`\n✅ MANUAL INGESTION COMPLETE!`);
  console.log(`Filing ID: ${insertedFiling.id}`);
  console.log(`Summary ID: ${summary.id}`);
}

if (process.argv[1] && process.argv[1].endsWith('manual-ingest-cli.ts')) {
  runManualIngestion()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal CLI Error:', err);
      process.exit(1);
    });
}
