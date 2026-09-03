import { NormalizedFiling } from './types';

export interface RawNseAnnouncement {
  seq_id?: string | number;
  symbol?: string;
  sm_name?: string;
  sm_isin?: string;
  an_dt?: string;
  sort_date?: string;
  desc?: string;
  attchmntText?: string;
  attchmntFile?: string;
}

export function parseNseAnnouncement(raw: RawNseAnnouncement): NormalizedFiling | null {
  if (!raw || !raw.seq_id) return null;

  const sourceAnnouncementId = String(raw.seq_id).trim();
  const companyName = raw.sm_name ? raw.sm_name.trim() : raw.symbol || 'Unknown Company';
  const nseSymbol = raw.symbol ? raw.symbol.trim().toUpperCase() : null;
  const isin = raw.sm_isin ? raw.sm_isin.trim().toUpperCase() : null;

  // Parse filing date
  let filingDate = new Date();
  if (raw.sort_date) {
    const d = new Date(raw.sort_date);
    if (!isNaN(d.getTime())) filingDate = d;
  } else if (raw.an_dt) {
    const d = new Date(raw.an_dt);
    if (!isNaN(d.getTime())) filingDate = d;
  }

  const eventType = raw.desc ? raw.desc.trim() : 'Corporate Announcement';
  const subject = raw.attchmntText ? raw.attchmntText.trim() : eventType;

  // PDF URL construction
  let pdfUrl: string | null = null;
  if (raw.attchmntFile) {
    pdfUrl = raw.attchmntFile.startsWith('http')
      ? raw.attchmntFile.trim()
      : `https://nsearchives.nseindia.com/corporate/${raw.attchmntFile.trim()}`;
  }

  return {
    source: 'NSE',
    sourceAnnouncementId,
    companyName,
    nseSymbol,
    bseCode: null,
    isin,
    filingDate,
    eventType,
    subject,
    sourceUrl: pdfUrl || 'https://www.nseindia.com/companies-listing/corporate-filings-announcements',
    pdfUrl,
  };
}
