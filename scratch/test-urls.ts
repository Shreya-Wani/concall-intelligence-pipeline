import axios from 'axios';
import fs from 'fs';
import path from 'path';

const testUrls = [
  {
    company: 'TCS',
    url: 'https://www.tcs.com/content/dam/tcs/pdf/discover-tcs/investor-relations/transcript/2024-2025/q1/TCS-Q1-FY25-Earnings-Call-Transcript.pdf',
    altUrl: 'https://www.bseindia.com/xml-data/corpfiling/AttachLive/5888e223-45e0-4a84-904e-289cfeb3ce25.pdf',
  },
  {
    company: 'TATAMOTORS',
    url: 'https://www.tatamotors.com/wp-content/uploads/2024/08/tatamotors-q1-fy25-earnings-call-transcript.pdf',
  },
  {
    company: 'SUNPHARMA',
    url: 'https://sunpharma.com/wp-content/uploads/2024/08/Sun-Pharma-Q1FY25-Earnings-Call-Transcript.pdf',
  },
];

async function checkPdfs() {
  for (const item of testUrls) {
    console.log(`\nTesting ${item.company} PDF download from ${item.url}...`);
    try {
      const res = await axios.get(item.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
        responseType: 'arraybuffer',
        timeout: 15000,
      });

      const buffer = Buffer.from(res.data);
      const isPdf = buffer.slice(0, 4).toString() === '%PDF';
      console.log(`[SUCCESS] Downloaded ${buffer.length} bytes. Valid PDF header: ${isPdf}`);
    } catch (err: any) {
      console.warn(`[FAILED] ${item.company} from main URL:`, err.message);
      if (item.altUrl) {
        console.log(`Trying alternative URL for ${item.company}...`);
        try {
          const res = await axios.get(item.altUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            responseType: 'arraybuffer',
            timeout: 15000,
          });
          const buffer = Buffer.from(res.data);
          console.log(`[SUCCESS ALT] Downloaded ${buffer.length} bytes. Valid PDF: ${buffer.slice(0, 4).toString() === '%PDF'}`);
        } catch (e: any) {
          console.warn(`[FAILED ALT] ${item.company}:`, e.message);
        }
      }
    }
  }
}

checkPdfs();
