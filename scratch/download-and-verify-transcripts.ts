import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const rawDir = path.resolve(__dirname, '../data/raw');
if (!fs.existsSync(rawDir)) fs.mkdirSync(rawDir, { recursive: true });

const targets = [
  {
    company: 'Infosys Limited',
    nseSymbol: 'INFY',
    bseCode: '500209',
    quarter: 'Q1 FY25',
    callDate: '2024-07-18',
    filename: 'INFY_Q1_FY25_Transcript.pdf',
    urls: [
      'https://www.infosys.com/investors/reports-filings/quarterly-results/2024-2025/q1/documents/transcripts/earningscall.pdf',
      'https://www.infosys.com/investors/reports-filings/quarterly-results/2024-2025/q1/documents/q1-25-transcript.pdf',
    ],
  },
  {
    company: 'Tata Motors Limited',
    nseSymbol: 'TATAMOTORS',
    bseCode: '500570',
    quarter: 'Q1 FY25',
    callDate: '2024-08-01',
    filename: 'TATAMOTORS_Q1_FY25_Transcript.pdf',
    urls: [
      'https://www.tatamotors.com/wp-content/uploads/2024/08/tatamotors-q1-fy25-earnings-call-transcript.pdf',
    ],
  },
  {
    company: 'Sun Pharmaceutical Industries Limited',
    nseSymbol: 'SUNPHARMA',
    bseCode: '524715',
    quarter: 'Q1 FY25',
    callDate: '2024-08-03',
    filename: 'SUNPHARMA_Q1_FY25_Transcript.pdf',
    urls: [
      'https://sunpharma.com/wp-content/uploads/2024/08/Sun-Pharma-Q1FY25-Earnings-Call-Transcript.pdf',
    ],
  },
];

async function downloadAndVerify() {
  console.log('📥 Attempting direct HTTP download for Genuine Full Transcripts...\n');

  for (const t of targets) {
    console.log(`Target: [${t.nseSymbol}] ${t.company} (${t.quarter})`);
    const outPath = path.join(rawDir, t.filename);
    let success = false;

    for (const url of t.urls) {
      console.log(`  Downloading from: ${url}`);
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
            'Accept': 'application/pdf,application/xhtml+xml,text/html;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
          },
        });

        if (!response.ok) {
          console.log(`  HTTP Failed: ${response.status} ${response.statusText}`);
          continue;
        }

        const arrayBuf = await response.arrayBuffer();
        const buf = Buffer.from(arrayBuf);
        const magic = buf.subarray(0, 4).toString();
        const byteSize = buf.length;
        const sha256 = crypto.createHash('sha256').update(buf).digest('hex');

        if (magic === '%PDF' && byteSize > 30000) {
          fs.writeFileSync(outPath, buf);
          console.log(`  ✅ DOWNLOAD SUCCESS: Saved ${byteSize.toLocaleString()} bytes (SHA-256: ${sha256.slice(0, 16)}...)`);
          console.log(`  File location: ${outPath}`);
          success = true;
          break;
        } else {
          console.log(`  Received non-PDF or small payload (Magic: "${magic}", Size: ${byteSize})`);
        }
      } catch (err: any) {
        console.log(`  Download error (${url}): ${err.message}`);
      }
    }

    if (!success) {
      console.log(`  ⚠️ Direct download failed for ${t.company}. Access requires browser session / cookie authorization.\n`);
    }
  }
}

downloadAndVerify();
