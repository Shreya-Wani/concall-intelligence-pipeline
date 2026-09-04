import { db } from '../db';
import { companies } from '../db/schema';

export const SEEDED_COMPANIES = [
  { name: 'Tata Consultancy Services Limited', nseSymbol: 'TCS', bseCode: '532540', isin: 'INE467B01029', aliases: ['tata consultancy services', 'tcs'] },
  { name: 'Tata Motors Limited', nseSymbol: 'TATAMOTORS', bseCode: '500570', isin: 'INE155A01022', aliases: ['tata motors', 'tatamotors'] },
  { name: 'Sun Pharmaceutical Industries Limited', nseSymbol: 'SUNPHARMA', bseCode: '524715', isin: 'INE044A01036', aliases: ['sun pharma', 'sun pharmaceutical', 'sunpharma'] },
  { name: 'Infosys Limited', nseSymbol: 'INFY', bseCode: '500209', isin: 'INE009A01021', aliases: ['infosys', 'infy'] },
  { name: 'HDFC Bank Limited', nseSymbol: 'HDFCBANK', bseCode: '500180', isin: 'INE040A01034', aliases: ['hdfc bank', 'hdfcbank', 'hdfc'] },
];

interface CachedCompany {
  name: string;
  nseSymbol: string | null;
  bseCode: string | null;
  isin: string | null;
  aliases?: string[];
}

let companyCache: CachedCompany[] = [];
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function getWatchedCompanies(): Promise<CachedCompany[]> {
  if (Date.now() < cacheExpiresAt && companyCache.length > 0) {
    return companyCache;
  }
  try {
    const rows = await db
      .select({
        name: companies.name,
        nseSymbol: companies.nseSymbol,
        bseCode: companies.bseCode,
        isin: companies.isin,
      })
      .from(companies);
    if (rows.length > 0) {
      companyCache = rows.map((r) => {
        const seedMatch = SEEDED_COMPANIES.find((s) => s.nseSymbol === r.nseSymbol);
        return { ...r, aliases: seedMatch?.aliases || [r.name.toLowerCase()] };
      });
      cacheExpiresAt = Date.now() + CACHE_TTL_MS;
      return companyCache;
    }
  } catch (err: any) {
    // Suppress warning if DB offline during offline unit tests
  }
  return SEEDED_COMPANIES;
}

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
  const hasExclusion = EXCLUSION_PATTERNS.some((pattern) => text.includes(pattern));
  const hasTranscriptKeyword = text.includes('transcript');
  if (hasExclusion && !hasTranscriptKeyword) return false;
  return TRANSCRIPT_KEYWORDS.some((kw) => text.includes(kw));
}

export async function matchSeededCompany(input: {
  nseSymbol?: string | null;
  bseCode?: string | null;
  isin?: string | null;
  companyName?: string | null;
}): Promise<{ name: string; nseSymbol: string | null; bseCode: string | null; isin: string | null } | null> {
  const watched = await getWatchedCompanies();

  if (input.nseSymbol) {
    const sym = input.nseSymbol.trim().toUpperCase();
    const m = watched.find((c) => c.nseSymbol?.toUpperCase() === sym);
    if (m) return m;
  }

  if (input.bseCode) {
    const code = input.bseCode.trim();
    const m = watched.find((c) => c.bseCode === code);
    if (m) return m;
  }

  if (input.isin) {
    const isin = input.isin.trim().toUpperCase();
    const m = watched.find((c) => c.isin?.toUpperCase() === isin);
    if (m) return m;
  }

  if (input.companyName) {
    const nameLower = input.companyName.trim().toLowerCase();
    const m = watched.find((c) => {
      if (nameLower.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(nameLower)) return true;
      if (c.aliases && c.aliases.some((alias) => nameLower.includes(alias))) return true;
      return false;
    });
    if (m) return m;
  }

  return null;
}
