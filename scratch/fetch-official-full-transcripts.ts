import axios from 'axios';
import fs from 'fs';
import path from 'path';

const rawDir = path.resolve(__dirname, '../data/raw');

const targets = [
  {
    company: 'TCS',
    symbol: 'TCS',
    filename: 'TCS_Q1_FY25_Transcript.pdf',
    urls: [
      'https://www.tcs.com/content/dam/tcs/pdf/discover-tcs/investor-relations/transcript/2024-2025/q1/TCS-Q1-FY25-Earnings-Call-Transcript.pdf',
      'https://bseindia.com/xml-data/corpfiling/AttachLive/5888e223-45e0-4a84-904e-289cfeb3ce25.pdf',
    ],
  },
  {
    company: 'Tata Motors',
    symbol: 'TATAMOTORS',
    filename: 'TATAMOTORS_Q1_FY25_Transcript.pdf',
    urls: [
      'https://www.tatamotors.com/wp-content/uploads/2024/08/tatamotors-q1-fy25-earnings-call-transcript.pdf',
      'https://www.bseindia.com/xml-data/corpfiling/AttachLive/45b2f293-85e8-466e-8d5f-9f7a759e6612.pdf',
    ],
  },
  {
    company: 'Sun Pharma',
    symbol: 'SUNPHARMA',
    filename: 'SUNPHARMA_Q1_FY25_Transcript.pdf',
    urls: [
      'https://sunpharma.com/wp-content/uploads/2024/08/Sun-Pharma-Q1FY25-Earnings-Call-Transcript.pdf',
      'https://www.bseindia.com/xml-data/corpfiling/AttachLive/3e226a27-0b1a-4d7a-8b89-22a835089e11.pdf',
    ],
  },
];

async function checkOfficialUrls() {
  console.log('🔍 Checking official company IR & BSE transcript PDF URLs...');

  for (const t of targets) {
    console.log(`\n--- Target: ${t.company} (${t.symbol}) ---`);
    let downloaded = false;
    for (const url of t.urls) {
      try {
        console.log(`Trying ${url}...`);
        const res = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'application/pdf,application/xhtml+xml,text/html;q=0.9,*/*;q=0.8',
          },
          responseType: 'arraybuffer',
          timeout: 10000,
        });

        const buf = Buffer.from(res.data);
        const magic = buf.subarray(0, 4).toString();
        if (magic === '%PDF' && buf.length > 20000) {
          const outPath = path.join(rawDir, t.filename);
          fs.writeFileSync(outPath, buf);
          console.log(`✅ SUCCESS: Downloaded genuine full transcript PDF (${buf.length.toLocaleString()} bytes) to ${outPath}`);
          downloaded = true;
          break;
        } else {
          console.log(`  Received data (Magic: ${magic}, Bytes: ${buf.length}), not a full transcript PDF.`);
        }
      } catch (err: any) {
        console.log(`  Failed (${url}): ${err.message}`);
      }
    }
    if (!downloaded) {
      console.log(`⚠️ Direct download not completed for ${t.company}`);
    }
  }
}

checkOfficialUrls();
