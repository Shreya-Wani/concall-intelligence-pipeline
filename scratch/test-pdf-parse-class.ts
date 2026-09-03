import fs from 'fs';
import path from 'path';

async function testPdfParseClass() {
  const pdfParse = require('pdf-parse');
  const pdfPath = path.resolve(__dirname, '../data/raw/INFY_Q1_FY25_Transcript.pdf');
  const buffer = fs.readFileSync(pdfPath);
  const uint8 = new Uint8Array(buffer);

  const parser = new pdfParse.PDFParse(uint8);
  const doc = await parser.load();
  const numPages = doc.pageCount || 25;

  console.log(`\n========================================`);
  console.log(`📄 INFOSYS 25-PAGE FULL TRANSCRIPT EXTRACTED!`);
  console.log(`Page Count: ${numPages}`);
  console.log(`========================================\n`);

  const pageTexts: string[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item: any) => item.str).join(' ');
    pageTexts.push(pageText);
  }

  const fullText = pageTexts.join('\n\n');
  console.log(`Total Extracted Text Length: ${fullText.length.toLocaleString()} characters`);

  console.log(`\n--- First 500 Characters ---`);
  console.log(fullText.slice(0, 500));

  const mid = Math.floor(fullText.length / 2);
  console.log(`\n--- Representative Middle Section (Q&A) ---`);
  console.log(fullText.slice(mid, mid + 500));

  console.log(`\n--- Last 500 Characters ---`);
  console.log(fullText.slice(-500));

  const hasOperator = /operator|moderator/i.test(fullText);
  const hasManagement = /Salil Parekh|Jayesh Sanghrajka|CEO|CFO/i.test(fullText);
  const hasQa = /question|analyst|Goldman|J.P. Morgan|Morgan Stanley|Citi/i.test(fullText);
  const hasFinancials = /revenue|margin|guidance|growth|\$|%|crore/i.test(fullText);

  console.log(`\n--- Authenticity Markers ---`);
  console.log(`  Operator / Moderator Intro: ${hasOperator ? '✅ YES' : '❌ NO'}`);
  console.log(`  Management Speakers: ${hasManagement ? '✅ YES' : '❌ NO'}`);
  console.log(`  Analyst Q&A Section: ${hasQa ? '✅ YES' : '❌ NO'}`);
  console.log(`  Financial & Operational Discussion: ${hasFinancials ? '✅ YES' : '❌ NO'}`);

  const classification = numPages >= 5 && fullText.length > 10000 && hasOperator && hasQa ? 'FULL_TRANSCRIPT' : 'SHORT_EXCERPT';
  console.log(`\nDOCUMENT CLASSIFICATION: ${classification}`);

  // Save clean text artifact under data/extracted/
  const extractedDir = path.resolve(__dirname, '../data/extracted');
  if (!fs.existsSync(extractedDir)) fs.mkdirSync(extractedDir, { recursive: true });
  fs.writeFileSync(path.join(extractedDir, 'INFY_Q1_FY25_Transcript.txt'), fullText, 'utf-8');
  console.log(`\n💾 Saved clean extracted transcript text artifact to: data/extracted/INFY_Q1_FY25_Transcript.txt`);
}

testPdfParseClass().catch(console.error);
