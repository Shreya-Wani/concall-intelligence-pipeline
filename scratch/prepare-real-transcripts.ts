import axios from 'axios';
import fs from 'fs';
import path from 'path';

const rawDir = path.resolve(__dirname, '../data/raw');
if (!fs.existsSync(rawDir)) {
  fs.mkdirSync(rawDir, { recursive: true });
}

// Genuine concall transcript PDF download sources
const items = [
  {
    company: 'TCS',
    symbol: 'TCS',
    filename: 'TCS_Q1_FY25_Transcript.pdf',
    // Public official disclosure URLs
    urls: [
      'https://www.tcs.com/content/dam/tcs/pdf/discover-tcs/investor-relations/transcript/2024-2025/q1/TCS-Q1-FY25-Earnings-Call-Transcript.pdf',
      'https://nsearchives.nseindia.com/corporate/TCS_Transcript_11072024.pdf',
      'https://www.bseindia.com/xml-data/corpfiling/AttachLive/5888e223-45e0-4a84-904e-289cfeb3ce25.pdf'
    ],
  },
  {
    company: 'Tata Motors',
    symbol: 'TATAMOTORS',
    filename: 'TATAMOTORS_Q1_FY25_Transcript.pdf',
    urls: [
      'https://www.tatamotors.com/wp-content/uploads/2024/08/tatamotors-q1-fy25-earnings-call-transcript.pdf',
      'https://nsearchives.nseindia.com/corporate/TATAMOTORS_Transcript_01082024.pdf',
    ],
  },
  {
    company: 'Sun Pharma',
    symbol: 'SUNPHARMA',
    filename: 'SUNPHARMA_Q1_FY25_Transcript.pdf',
    urls: [
      'https://sunpharma.com/wp-content/uploads/2024/08/Sun-Pharma-Q1FY25-Earnings-Call-Transcript.pdf',
      'https://nsearchives.nseindia.com/corporate/SUNPHARMA_Transcript_03082024.pdf',
    ],
  },
];

async function prepareTranscripts() {
  console.log('📥 Preparing genuine transcript PDFs for TCS, Tata Motors, and Sun Pharma...');

  for (const item of items) {
    const targetPath = path.join(rawDir, item.filename);
    console.log(`\nChecking ${item.company} -> ${targetPath}`);

    if (fs.existsSync(targetPath)) {
      const buf = fs.readFileSync(targetPath);
      if (buf.slice(0, 4).toString() === '%PDF') {
        console.log(`✅ Already present in data/raw/: ${targetPath} (${buf.length} bytes)`);
        continue;
      }
    }

    let success = false;
    for (const url of item.urls) {
      try {
        console.log(`Downloading from ${url}...`);
        const res = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          },
          responseType: 'arraybuffer',
          timeout: 10000,
        });

        const buf = Buffer.from(res.data);
        if (buf.slice(0, 4).toString() === '%PDF') {
          fs.writeFileSync(targetPath, buf);
          console.log(`✅ DOWNLOAD SUCCESS: Saved ${buf.length} bytes to ${targetPath}`);
          success = true;
          break;
        }
      } catch (err: any) {
        console.warn(`Failed downloading from ${url}:`, err.message);
      }
    }

    if (!success) {
      console.warn(`⚠️ Could not fetch direct PDF via HTTP GET for ${item.company}.`);
    }
  }
}

prepareTranscripts();
