import axios, { AxiosInstance } from 'axios';
import http from 'http';
import https from 'https';
import { env } from '../config/env';
import { SEEDED_COMPANIES } from './filters';
import { RawBseAnnouncement } from './bse.parser';

export class BseClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      timeout: env.HTTP_TIMEOUT_MS,
      httpAgent: new http.Agent({ insecureHTTPParser: true } as http.AgentOptions),
      httpsAgent: new https.Agent({ insecureHTTPParser: true } as https.AgentOptions),
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin': 'https://www.bseindia.com',
        'Referer': 'https://www.bseindia.com/corporates/ann',
      },
    });
  }

  public async fetchAnnouncements(): Promise<RawBseAnnouncement[]> {
    const results: RawBseAnnouncement[] = [];

    // Query BSE for each seeded company scrip code
    for (const company of SEEDED_COMPANIES) {
      let retries = 0;
      while (retries <= env.HTTP_MAX_RETRIES) {
        try {
          console.log(`[BSE] Fetching announcements for ${company.name} (${company.bseCode})...`);
          const url = `https://api.bseindia.com/BseIndiaAPI/api/AnnData/w?scrip_code=${company.bseCode}&strType=C&pageno=1&strCategory=-1&strTopic=-1&strSearch=P&strFromDate=&strToDate=`;
          const res = await this.client.get(url);

          let data = res.data;
          if (typeof data === 'string' && data.startsWith('{')) {
            try {
              data = JSON.parse(data);
            } catch (_) {}
          }

          if (data && Array.isArray(data.Table)) {
            results.push(...data.Table);
          }
          break;
        } catch (err: any) {
          retries++;
          if (retries > env.HTTP_MAX_RETRIES) {
            console.warn(`[BSE] Could not fetch announcements for scrip ${company.bseCode}:`, err.message);
            break;
          }
          const delay = Math.min(
            env.HTTP_INITIAL_RETRY_DELAY_MS * Math.pow(2, retries) + Math.random() * 200,
            env.HTTP_MAX_RETRY_DELAY_MS
          );
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }

    return results;
  }
}
