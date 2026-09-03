import createCryptoHash from 'crypto';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import http from 'http';
import https from 'https';
import { env } from '../config/env';
import { DownloadResult, FilingSource } from './types';

export function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
}

export function generateDeterministicFilename(
  source: FilingSource,
  companySymbolOrCode: string,
  filingDate: Date,
  announcementId: string
): string {
  const dateStr = filingDate.toISOString().slice(0, 10).replace(/-/g, '');
  const rawName = `${source}_${companySymbolOrCode}_${dateStr}_${announcementId}.pdf`;
  return sanitizeFilename(rawName);
}

export async function downloadPdfStream(
  pdfUrl: string,
  targetFilename: string
): Promise<DownloadResult> {
  const targetDir = path.resolve(process.cwd(), 'data/raw');
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const targetPath = path.join(targetDir, targetFilename);

  let retries = 0;
  while (retries <= env.HTTP_MAX_RETRIES) {
    try {
      console.log(`[DOWNLOAD] Fetching PDF from ${pdfUrl}...`);
      const response = await axios.get(pdfUrl, {
        responseType: 'stream',
        timeout: env.HTTP_TIMEOUT_MS,
        httpAgent: new http.Agent({ insecureHTTPParser: true } as http.AgentOptions),
        httpsAgent: new https.Agent({ insecureHTTPParser: true, rejectUnauthorized: false } as https.AgentOptions),
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'application/pdf, application/octet-stream, */*',
        },
      });

      if (response.status !== 200) {
        throw new Error(`HTTP status ${response.status} downloading PDF`);
      }

      const contentTypeHeader = response.headers['content-type'];
      const contentType = typeof contentTypeHeader === 'string' ? contentTypeHeader : 'application/pdf';

      const hashStream = createCryptoHash.createHash('sha256');
      const fileStream = fs.createWriteStream(targetPath);

      let byteSize = 0;

      await new Promise<void>((resolve, reject) => {
        response.data.on('data', (chunk: Buffer) => {
          byteSize += chunk.length;
          hashStream.update(chunk);
          fileStream.write(chunk);
        });

        response.data.on('end', () => {
          fileStream.end();
          resolve();
        });

        response.data.on('error', (err: Error) => {
          fileStream.destroy();
          reject(err);
        });

        fileStream.on('error', (err) => reject(err));
      });

      const pdfHash = hashStream.digest('hex');

      console.log(`[DOWNLOAD] Successfully saved ${targetFilename} (${byteSize} bytes, SHA-256: ${pdfHash.slice(0, 10)}...)`);

      return {
        localPath: targetPath,
        pdfHash,
        byteSize,
        contentType,
      };
    } catch (err: any) {
      if (fs.existsSync(targetPath)) {
        try {
          fs.unlinkSync(targetPath);
        } catch (_) {}
      }

      retries++;
      if (retries > env.HTTP_MAX_RETRIES) {
        console.error(`[DOWNLOAD] Failed downloading PDF after max retries:`, err.message);
        throw err;
      }
      const delay = Math.min(
        env.HTTP_INITIAL_RETRY_DELAY_MS * Math.pow(2, retries) + Math.random() * 200,
        env.HTTP_MAX_RETRY_DELAY_MS
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw new Error('PDF download failed');
}
