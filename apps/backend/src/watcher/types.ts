export type FilingSource = 'NSE' | 'BSE';

export interface NormalizedFiling {
  source: FilingSource;
  sourceAnnouncementId: string;
  companyName: string;
  nseSymbol?: string | null;
  bseCode?: string | null;
  isin?: string | null;
  filingDate: Date;
  eventType?: string | null;
  subject?: string | null;
  quarter?: string | null;
  callDate?: Date | null;
  sourceUrl?: string | null;
  pdfUrl?: string | null;
}

export interface SeededCompanyMatch {
  id: string;
  name: string;
  nseSymbol: string;
  bseCode: string;
  isin: string;
  sector: string;
}

export interface DownloadResult {
  localPath: string;
  pdfHash: string;
  byteSize: number;
  contentType: string;
}

export interface IngestStats {
  source: FilingSource;
  totalFetched: number;
  matchedCompany: number;
  transcriptFiltered: number;
  level1Duplicates: number;
  level2Duplicates: number;
  downloaded: number;
  failed: number;
}

export interface WatcherConfig {
  nsePollIntervalMs: number;
  bsePollIntervalMs: number;
  httpTimeoutMs: number;
  httpMaxRetries: number;
  httpInitialRetryDelayMs: number;
  httpMaxRetryDelayMs: number;
}
