import { NormalizedFiling } from './types';

export interface RawBseAnnouncement {
  NEWSID?: string | number;
  SCRIP_CD?: string | number;
  SLONGNAME?: string;
  NEWSSUB?: string;
  HEADLINE?: string;
  CATEGORYNAME?: string;
  NEWS_DT?: string;
  ATTACHMENTNAME?: string;
  FILENAME?: string;
}

export function parseBseAnnouncement(raw: RawBseAnnouncement): NormalizedFiling | null {
  if (!raw || (!raw.NEWSID && !raw.ATTACHMENTNAME && !raw.FILENAME)) return null;

  const sourceAnnouncementId = String(raw.NEWSID || raw.ATTACHMENTNAME || raw.FILENAME).trim();
  const companyName = raw.SLONGNAME ? raw.SLONGNAME.trim() : 'Unknown Company';
  const bseCode = raw.SCRIP_CD ? String(raw.SCRIP_CD).trim() : null;

  let filingDate = new Date();
  if (raw.NEWS_DT) {
    const d = new Date(raw.NEWS_DT);
    if (!isNaN(d.getTime())) filingDate = d;
  }

  const eventType = raw.CATEGORYNAME ? raw.CATEGORYNAME.trim() : 'Corporate Announcement';
  const subject = raw.NEWSSUB || raw.HEADLINE ? (raw.NEWSSUB || raw.HEADLINE || '').trim() : eventType;

  // PDF URL construction for BSE
  let pdfUrl: string | null = null;
  const fileName = raw.ATTACHMENTNAME || raw.FILENAME;
  if (fileName) {
    pdfUrl = fileName.startsWith('http')
      ? fileName.trim()
      : `https://www.bseindia.com/xml-data/corpfiling/AttachLive/${fileName.trim()}`;
  }

  return {
    source: 'BSE',
    sourceAnnouncementId,
    companyName,
    nseSymbol: null,
    bseCode,
    isin: null,
    filingDate,
    eventType,
    subject,
    sourceUrl: pdfUrl || 'https://www.bseindia.com/corporates/ann.html',
    pdfUrl,
  };
}
