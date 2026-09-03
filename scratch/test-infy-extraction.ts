import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { extractPdfText } from '../apps/backend/src/extraction/pdf-extractor';
import { cleanTranscriptText } from '../apps/backend/src/extraction/text-cleaner';

async function testInfyExtraction() {
  const pdfPath = path.resolve(__dirname, '../data/raw/INFY_Q1_FY25_Transcript.pdf');
  const buffer = fs.readFileSync(pdfPath);
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  const byteSize = buffer.length;

  console.log(`\n========================================`);
  console.log(`📄 INFOSYS Q1 FY25 FULL TRANSCRIPT ANALYSIS`);
  console.log(`PDF Path: ${pdfPath}`);
  console.log(`PDF Byte Size: ${byteSize.toLocaleString()} bytes`);
  console.log(`SHA-256: ${sha256}`);
  console.log(`========================================\n`);

  const rawResult = await extractPdfText(pdfPath);
  console.log(`[PDF Parser] Page Count: ${rawResult.pageCount}`);

  const cleaned = cleanTranscriptText(rawResult.pages);
  console.log(`[Text Cleaner] Extracted Character Count: ${cleaned.characterCount.toLocaleString()}`);

  const text = cleaned.cleanedText;

  // Inspect first 500 characters
  console.log(`\n--- First 500 Characters ---`);
  console.log(text.slice(0, 500));

  // Inspect representative middle section (around character index 15000)
  console.log(`\n--- Representative Middle Section ---`);
  const midStart = Math.floor(text.length / 2);
  console.log(text.slice(midStart, midStart + 500));

  // Inspect last 500 characters
  console.log(`\n--- Last 500 Characters ---`);
  console.log(text.slice(-500));

  // Verify key authenticity markers
  const hasOperator = /operator|moderator/i.test(text);
  const hasManagement = /Salil Parekh|Jayesh Sanghrajka|CEO|CFO/i.test(text);
  const hasQa = /question|analyst|Goldman|J.P. Morgan|Morgan Stanley|Citi/i.test(text);
  const hasFinancials = /revenue|margin|guidance|growth|\$|%|crore/i.test(text);

  console.log(`\n--- Authenticity Markers Check ---`);
  console.log(`  Operator / Moderator Intro: ${hasOperator ? '✅ YES' : '❌ NO'}`);
  console.log(`  Management Speakers (Salil Parekh / Jayesh Sanghrajka): ${hasManagement ? '✅ YES' : '❌ NO'}`);
  console.log(`  Analyst Q&A Section: ${hasQa ? '✅ YES' : '❌ NO'}`);
  console.log(`  Financial & Operational Discussion: ${hasFinancials ? '✅ YES' : '❌ NO'}`);

  const classification = rawResult.pageCount >= 5 && cleaned.characterCount > 10000 && hasOperator && hasQa ? 'FULL_TRANSCRIPT' : 'SHORT_EXCERPT';
  console.log(`\nDocument Classification: ${classification}`);

  // Save clean extracted text artifact under data/extracted/
  const extractedDir = path.resolve(__dirname, '../data/extracted');
  if (!fs.existsSync(extractedDir)) fs.mkdirSync(extractedDir, { recursive: true });
  const textArtifactPath = path.join(extractedDir, 'INFY_Q1_FY25_Transcript.txt');
  fs.writeFileSync(textArtifactPath, text, 'utf-8');
  console.log(`\n💾 Saved clean extracted transcript text artifact to: ${textArtifactPath}`);
}

testInfyExtraction().catch(console.error);
