import axios from 'axios';
import http from 'http';
import https from 'https';

const httpAgent = new http.Agent({ insecureHTTPParser: true });
const httpsAgent = new https.Agent({ insecureHTTPParser: true });

async function findBseTranscripts() {
  const scrips = [
    { name: 'TCS', code: '532540' },
    { name: 'TATAMOTORS', code: '500570' },
    { name: 'SUNPHARMA', code: '524715' },
  ];

  for (const item of scrips) {
    console.log(`\n🔍 Searching BSE historical announcements for ${item.name} (${item.code})...`);
    try {
      const url = `https://api.bseindia.com/BseIndiaAPI/api/AnnCategoryData/w?id=0&scripcode=${item.code}&strCat=Company+Update&strPrevCat=Corporate+Announcement`;
      const res = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Referer': 'https://www.bseindia.com/',
        },
        httpAgent,
        httpsAgent,
        timeout: 10000,
      });

      const annList = res.data?.Table || res.data || [];
      console.log(`Found ${annList.length} filings for ${item.name}.`);

      for (const ann of annList) {
        const subject = ann.NEWSSUB || ann.SLONGNAME || '';
        const attachment = ann.ATTACHMENTNAME || '';
        if (
          subject.toLowerCase().includes('transcript') ||
          subject.toLowerCase().includes('concall') ||
          subject.toLowerCase().includes('earnings')
        ) {
          console.log(`🎯 [TRANSCRIPT MATCH] [${ann.NEWS_DT?.slice(0, 10)}] "${subject.slice(0, 80)}"`);
          if (attachment) {
            console.log(`   PDF URL: https://www.bseindia.com/xml-data/corpfiling/AttachLive/${attachment}`);
          }
        }
      }
    } catch (err: any) {
      console.warn(`Error querying BSE for ${item.name}:`, err.message);
    }
  }
}

findBseTranscripts();
