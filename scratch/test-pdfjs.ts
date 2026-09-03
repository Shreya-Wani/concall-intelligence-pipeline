import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function testPdfJs() {
  const pdfPath = 'd:/concall-intelligence-pipeline/data/raw/TCS_Q1_FY25_Transcript.pdf';
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const loadingTask = pdfjsLib.getDocument({ data });
  const doc = await loadingTask.promise;

  console.log('Page count:', doc.numPages);
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map((item: any) => item.str);
    console.log(`Page ${i} text (${strings.length} items):`, strings.join(' ').slice(0, 150));
  }
}

testPdfJs().catch(console.error);
