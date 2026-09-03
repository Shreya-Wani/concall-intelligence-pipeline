import axios, { AxiosInstance } from 'axios';
import { env } from '../config/env';
import { RawNseAnnouncement } from './nse.parser';

export class NseClient {
  private client: AxiosInstance;
  private cookies: string = '';
  private lastSessionFetch: number = 0;

  constructor() {
    this.client = axios.create({
      timeout: env.HTTP_TIMEOUT_MS,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
  }

  private async ensureSession(): Promise<void> {
    const now = Date.now();
    if (this.cookies && now - this.lastSessionFetch < 15 * 60 * 1000) {
      return;
    }

    try {
      console.log('[NSE] Initializing session cookie handshake...');
      const res = await this.client.get('https://www.nseindia.com');
      const setCookies = res.headers['set-cookie'];
      if (setCookies) {
        const arr = Array.isArray(setCookies) ? setCookies : [setCookies];
        this.cookies = arr.map((c) => c.split(';')[0]).join('; ');
        this.lastSessionFetch = Date.now();
        console.log('[NSE] Session cookie handshake successful.');
      }
    } catch (err: any) {
      console.warn('[NSE] Session handshake warning:', err.message);
    }
  }

  public async fetchAnnouncements(): Promise<RawNseAnnouncement[]> {
    await this.ensureSession();

    let retries = 0;
    while (retries <= env.HTTP_MAX_RETRIES) {
      try {
        console.log('[NSE] Fetching equity corporate announcements...');
        const res = await this.client.get('https://www.nseindia.com/api/corporate-announcements?index=equities', {
          headers: {
            'Accept': 'application/json, text/plain, */*',
            'Cookie': this.cookies,
            'Referer': 'https://www.nseindia.com/companies-listing/corporate-filings-announcements',
          },
        });

        if (Array.isArray(res.data)) {
          return res.data;
        }
        return [];
      } catch (err: any) {
        retries++;
        if (retries > env.HTTP_MAX_RETRIES) {
          console.error('[NSE] Failed fetching announcements after max retries:', err.message);
          return [];
        }
        const delay = Math.min(
          env.HTTP_INITIAL_RETRY_DELAY_MS * Math.pow(2, retries) + Math.random() * 200,
          env.HTTP_MAX_RETRY_DELAY_MS
        );
        console.warn(`[NSE] Request retry ${retries}/${env.HTTP_MAX_RETRIES} in ${Math.round(delay)}ms...`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    return [];
  }
}
