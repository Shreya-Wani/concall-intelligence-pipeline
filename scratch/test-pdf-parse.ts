const pdf = require('pdf-parse');
const fs = require('fs');

async function testParse() {
  const pdfPath = 'd:/concall-intelligence-pipeline/data/raw/TCS_Q1_FY25_Transcript.pdf';
  const buf = fs.readFileSync(pdfPath);
  const uint8 = new Uint8Array(buf);
  const parser = new pdf.PDFParse(uint8);
  console.log('Parser instance keys & prototype:', Object.getOwnPropertyNames(Object.getPrototypeOf(parser)));
  const loaded = await parser.load();
  console.log('Loaded result keys:', Object.keys(loaded));
  console.log('Loaded pages length:', loaded.pages?.length);
  if (loaded.pages && loaded.pages[0]) {
    console.log('Page 0 keys:', Object.keys(loaded.pages[0]));
    console.log('Page 0 text:', loaded.pages[0].text);
  }
}

testParse();
