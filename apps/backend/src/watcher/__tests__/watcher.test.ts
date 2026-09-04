import { describe, expect, it } from 'vitest';
import { isTranscriptFiling, matchSeededCompany } from '../filters';

describe('Watcher Filters', () => {
  it('identifies valid transcript filings', () => {
    expect(isTranscriptFiling('Transcript of Analyst Call Q1 FY25', 'Filing')).toBe(true);
    expect(isTranscriptFiling('Audio recording and transcript of concall', 'Filing')).toBe(true);
  });

  it('rejects non-transcript intimation notices', () => {
    expect(isTranscriptFiling('Schedule of Analyst/Investor Meeting', 'Intimation')).toBe(false);
    expect(isTranscriptFiling('Investor Presentation Q1 FY25', 'Presentation')).toBe(false);
  });

  it('matches company by NSE symbol', async () => {
    const res = await matchSeededCompany({ nseSymbol: 'TCS' });
    expect(res?.name).toContain('Tata Consultancy Services');
  });

  it('matches company by BSE code', async () => {
    const res = await matchSeededCompany({ bseCode: '500209' });
    expect(res?.name).toContain('Infosys');
  });

  it('matches company by name alias', async () => {
    const res = await matchSeededCompany({ companyName: 'Sun Pharma Ltd' });
    expect(res?.nseSymbol).toBe('SUNPHARMA');
  });
});
