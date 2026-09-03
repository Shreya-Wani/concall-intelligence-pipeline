import axios from 'axios';

async function fetchNseCompanyAnnouncements(symbol: string) {
  console.log(`\n🔍 Fetching NSE corporate announcements for ${symbol}...`);
  const client = axios.create({
    baseURL: 'https://www.nseindia.com',
    timeout: 10000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://www.nseindia.com/companies-listing/corporate-filings-announcements',
    },
  });

  try {
    // 1. Initial cookie handshake
    const mainRes = await client.get('/');
    const cookies = mainRes.headers['set-cookie'];
    const cookieHeader = cookies ? cookies.map((c) => c.split(';')[0]).join('; ') : '';

    // 2. Fetch company specific corporate announcements
    const annRes = await client.get(`/api/corporate-announcements?index=equities&symbol=${symbol}`, {
      headers: {
        Cookie: cookieHeader,
      },
    });

    const items = annRes.data || [];
    console.log(`Received ${items.length} announcements for ${symbol}.`);

    for (const item of items) {
      const desc = item.desc || item.an_dt || '';
      const att = item.attachment || item.attchmntFile || '';
      console.log(`- [${item.an_dt}] "${desc.slice(0, 80)}" Att: ${att}`);
      if (att) {
        console.log(`  PDF: https://nsearchives.nseindia.com/corporate/${att}`);
      }
    }
  } catch (err: any) {
    console.warn(`Error fetching NSE for ${symbol}:`, err.message);
  }
}

async function run() {
  await fetchNseCompanyAnnouncements('TCS');
  await fetchNseCompanyAnnouncements('TATAMOTORS');
  await fetchNseCompanyAnnouncements('SUNPHARMA');
}

run();
