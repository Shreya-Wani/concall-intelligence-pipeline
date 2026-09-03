import axios from 'axios';
import fs from 'fs';
import path from 'path';

// Known working public official earnings call transcript PDF URLs for seeded companies
const targets = [
  {
    company: 'TCS',
    symbol: 'TCS',
    quarter: 'Q1 FY25',
    url: 'https://www.tcs.com/content/dam/tcs/pdf/discover-tcs/investor-relations/transcript/2024-2025/q1/TCS-Q1-FY25-Earnings-Call-Transcript.pdf',
    altUrls: [
      'https://www.tcs.com/content/dam/tcs/pdf/discover-tcs/investor-relations/transcript/2023-2024/q4/TCS-Q4-FY24-Earnings-Call-Transcript.pdf',
      'https://www.tcs.com/content/dam/tcs/pdf/discover-tcs/investor-relations/transcript/2023-2024/q3/TCS-Q3-FY24-Earnings-Call-Transcript.pdf',
    ],
  },
  {
    company: 'Tata Motors',
    symbol: 'TATAMOTORS',
    quarter: 'Q1 FY25',
    url: 'https://www.tatamotors.com/wp-content/uploads/2024/08/tatamotors-q1-fy25-earnings-call-transcript.pdf',
    altUrls: [
      'https://www.tatamotors.com/wp-content/uploads/2024/05/tatamotors-q4-fy24-earnings-call-transcript.pdf',
      'https://www.tatamotors.com/wp-content/uploads/2024/02/tatamotors-q3-fy24-earnings-call-transcript.pdf',
    ],
  },
  {
    company: 'Sun Pharma',
    symbol: 'SUNPHARMA',
    quarter: 'Q1 FY25',
    url: 'https://sunpharma.com/wp-content/uploads/2024/08/Sun-Pharma-Q1FY25-Earnings-Call-Transcript.pdf',
    altUrls: [
      'https://sunpharma.com/wp-content/uploads/2024/05/Sun-Pharma-Q4FY24-Earnings-Call-Transcript.pdf',
      'https://sunpharma.com/wp-content/uploads/2024/02/Sun-Pharma-Q3FY24-Earnings-Call-Transcript.pdf',
    ],
  },
];

async function testDownload() {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  for (const t of targets) {
    console.log(`\n========================================`);
    console.log(`Testing genuine transcript download for ${t.company} (${t.symbol})...`);
    
    let downloaded = false;
    const urlsToTry = [t.url, ...t.altUrls];

    for (const url of urlsToTry) {
      console.log(`Trying URL: ${url}`);
      try {
        const res = await axios.get(url, { headers, responseType: 'arraybuffer', timeout: 15000 });
        const buf = Buffer.from(res.data);
        const header = buf.slice(0, 4).toString();
        if (header === '%PDF') {
          console.log(`✅ SUCCESS! Downloaded ${buf.length} bytes. Magic bytes %PDF verified.`);
          downloaded = true;
          break;
        } else {
          console.warn(`Response received (${buf.length} bytes) but magic bytes are "${header}" (not PDF).`);
        }
      } catch (err: any) {
        console.warn(`Failed: ${err.message}`);
      }
    }

    if (!downloaded) {
      console.warn(`⚠️ Could not download PDF directly via automated HTTP GET for ${t.company}.`);
    }
  }
}

testDownload();
