import fs from 'fs';
import path from 'path';

async function extractInfyWithPdfJs() {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const pdfPath = path.resolve(__dirname, '../data/raw/INFY_Q1_FY25_Transcript.pdf');
  const data = new Uint8Array(fs.readFileSync(pdfPath));

  const loadingTask = pdfjsLib.getDocument({ data });
  const doc = await loadingTask.promise;

  console.log(`\n========================================`);
  console.log(`📄 INFOSYS PDFJS EXTRACTION RESULT`);
  console.log(`Total Pages: ${doc.numPages}`);
  console.log(`========================================\n`);

  const pageTexts: string[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map((item: any) => item.str);
    const pageText = strings.join(' ');
    pageTexts.push(pageText);
    if (i <= 3 || i === doc.numPages) {
      console.log(`--- Page ${i} (${pageText.length} chars) ---`);
      console.log(pageText.slice(0, 300));
      console.log('');
    }
  }

  const fullText = pageTexts.join('\n\n');
  console.log(`Full extracted text length: ${fullText.length.toLocaleString()} characters`);

  const hasOperator = /operator|moderator/i.test(fullText);
  const hasManagement = /Salil Parekh|Jayesh Sanghrajka|CEO|CFO/i.test(fullText);
  const hasQa = /question|analyst|Goldman|J.P. Morgan|Morgan Stanley|Citi/i.test(fullText);
  const hasFinancials = /revenue|margin|guidance|growth|\$|%|crore/i.test(fullText);

  console.log(`\n--- Authenticity Check ---`);
  console.log(`  Operator Intro: ${hasOperator ? '✅ YES' : '❌ NO'}`);
  console.log(`  Management Speakers: ${hasManagement ? '✅ YES' : '❌ NO'}`);
  console.log(`  Analyst Q&A Section: ${hasQa ? '✅ YES' : '❌ NO'}`);
  console.log(`  Financial Discussion: ${hasFinancials ? '✅ YES' : '❌ NO'}`);

  const classification = doc.numPages >= 5 && fullText.length > 10000 && hasOperator && hasQa ? 'FULL_TRANSCRIPT' : 'SHORT_EXCERPT';
  console.log(`\nCLASSIFICATION: ${classification}`);

  // Save clean extracted text
  const extractedDir = path.resolve(__dirname, '../data/extracted');
  if (!fs.existsSync(extractedDir)) fs.mkdirSync(extractedDir, { recursive: true });
  fs.writeFileSync(path.join(extractedDir, 'INFY_Q1_FY25_Transcript.txt'), fullText, 'utf-8');
  console.log(`💾 Saved clean text artifact to data/extracted/INFY_Q1_FY25_Transcript.txt`);
}

extractInfyWithPdfJs().catch(console.error);
