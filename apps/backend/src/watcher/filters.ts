import { SeededCompanyMatch } from './types';

export const SEEDED_COMPANIES = [
  {
    name: 'Tata Consultancy Services Limited',
    nseSymbol: 'TCS',
    bseCode: '532540',
    isin: 'INE467B01029',
    aliases: ['tata consultancy services', 'tcs'],
  },
  {
    name: 'Tata Motors Limited',
    nseSymbol: 'TATAMOTORS',
    bseCode: '500570',
    isin: 'INE155A01022',
    aliases: ['tata motors', 'tatamotors'],
  },
  {
    name: 'Sun Pharmaceutical Industries Limited',
    nseSymbol: 'SUNPHARMA',
    bseCode: '524715',
    isin: 'INE044A01036',
    aliases: ['sun pharma', 'sun pharmaceutical', 'sunpharma'],
  },
];

const TRANSCRIPT_KEYWORDS = [
  'transcript',
  'concall',
  'con call',
  'con-call',
  'conference call',
  'conference-call',
  'earnings call',
  'analyst meet transcript',
  'institutional investor meet transcript',
  'audio/video recording and transcript',
  'recording and transcript',
];

const EXCLUSION_PATTERNS = [
  'schedule of analyst',
  'intimation of analyst',
  'schedule of conference call',
  'intimation of conference call',
  'audio recording of',
  'video recording of',
  'investor presentation',
  'newspaper publication',
];

export function isTranscriptFiling(subject?: string | null, eventType?: string | null): boolean {
  const text = `${subject || ''} ${eventType || ''}`.toLowerCase();

  // If text explicitly contains exclusion patterns without mentioning transcript, reject
  const hasExclusion = EXCLUSION_PATTERNS.some((pattern) => text.includes(pattern));
  const hasTranscriptKeyword = text.includes('transcript');

  if (hasExclusion && !hasTranscriptKeyword) {
    return false;
  }

  // Check if text matches any valid transcript keyword
  return TRANSCRIPT_KEYWORDS.some((kw) => text.includes(kw));
}

export function matchSeededCompany(input: {
  nseSymbol?: string | null;
  bseCode?: string | null;
  isin?: string | null;
  companyName?: string | null;
}): { name: string; nseSymbol: string; bseCode: string; isin: string } | null {
  // 1. Direct match by NSE Symbol
  if (input.nseSymbol) {
    const symbolClean = input.nseSymbol.trim().toUpperCase();
    const matched = SEEDED_COMPANIES.find((c) => c.nseSymbol === symbolClean);
    if (matched) return matched;
  }

  // 2. Direct match by BSE Scrip Code
  if (input.bseCode) {
    const codeClean = input.bseCode.trim();
    const matched = SEEDED_COMPANIES.find((c) => c.bseCode === codeClean);
    if (matched) return matched;
  }

  // 3. Direct match by ISIN
  if (input.isin) {
    const isinClean = input.isin.trim().toUpperCase();
    const matched = SEEDED_COMPANIES.find((c) => c.isin === isinClean);
    if (matched) return matched;
  }

  // 4. Secondary fallback: exact alias match on cleaned company name
  if (input.companyName) {
    const nameClean = input.companyName.trim().toLowerCase();
    const matched = SEEDED_COMPANIES.find((c) => c.aliases.some((alias) => nameClean.includes(alias)));
    if (matched) return matched;
  }

  return null;
}
