import axios from 'axios';
import fs from 'fs';
import path from 'path';

async function testFetchSources() {
  const sources = [
    {
      company: 'TCS',
      url: 'https://nsearchives.nseindia.com/corporate/TCS_Transcript_11072024.pdf',
    },
    {
      company: 'TCS_IR',
      url: 'https://www.tcs.com/content/dam/tcs/pdf/discover-tcs/investor-relations/transcript/2024-2025/Q1-FY25-Earnings-Call-Transcript.pdf',
    },
  ];

  for (const s of sources) {
    try {
      console.log(`Fetching ${s.company} from ${s.url}...`);
      const res = await axios.get(s.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        },
        responseType: 'arraybuffer',
        timeout: 10000,
      });
      const buf = Buffer.from(res.data);
      console.log(`SUCCESS: Received ${buf.length} bytes. Header: ${buf.slice(0, 4).toString()}`);
    } catch (err: any) {
      console.warn(`FAILED: ${err.message}`);
    }
  }
}

testFetchSources();
