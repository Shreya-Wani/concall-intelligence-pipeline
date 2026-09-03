import assert from 'node:assert';
import { test, describe } from 'node:test';
import { isTranscriptFiling, matchSeededCompany } from '../filters';
import { parseNseAnnouncement } from '../nse.parser';
import { parseBseAnnouncement } from '../bse.parser';
import { generateDeterministicFilename, sanitizeFilename } from '../downloader';

describe('Watcher Component Unit Tests', () => {
  describe('1. Transcript Filtering', () => {
    test('identifies valid transcript announcements', () => {
      assert.strictEqual(isTranscriptFiling('Transcript of Analyst Call Q1 FY26'), true);
      assert.strictEqual(isTranscriptFiling('Concall Transcript for Q4'), true);
      assert.strictEqual(isTranscriptFiling('Audio recording and transcript of conference call'), true);
      assert.strictEqual(isTranscriptFiling('Earnings call transcript'), true);
    });

    test('rejects routine meeting intimations without transcript', () => {
      assert.strictEqual(isTranscriptFiling('Schedule of Analyst/Institutional Investor Meet'), false);
      assert.strictEqual(isTranscriptFiling('Intimation of Board Meeting under Regulation 29'), false);
      assert.strictEqual(isTranscriptFiling('Investor Presentation Q1 FY26'), false);
      assert.strictEqual(isTranscriptFiling('Newspaper publication of financial results'), false);
    });
  });

  describe('2. Company Matching', () => {
    test('matches TCS by symbol, BSE code, ISIN, and alias', () => {
      assert.deepStrictEqual(matchSeededCompany({ nseSymbol: 'TCS' })?.nseSymbol, 'TCS');
      assert.deepStrictEqual(matchSeededCompany({ bseCode: '532540' })?.bseCode, '532540');
      assert.deepStrictEqual(matchSeededCompany({ isin: 'INE467B01029' })?.isin, 'INE467B01029');
      assert.deepStrictEqual(matchSeededCompany({ companyName: 'Tata Consultancy Services Ltd' })?.nseSymbol, 'TCS');
    });

    test('matches Tata Motors correctly', () => {
      assert.deepStrictEqual(matchSeededCompany({ nseSymbol: 'TATAMOTORS' })?.nseSymbol, 'TATAMOTORS');
      assert.deepStrictEqual(matchSeededCompany({ bseCode: '500570' })?.bseCode, '500570');
      assert.deepStrictEqual(matchSeededCompany({ companyName: 'Tata Motors Limited' })?.nseSymbol, 'TATAMOTORS');
    });

    test('matches Sun Pharma correctly', () => {
      assert.deepStrictEqual(matchSeededCompany({ nseSymbol: 'SUNPHARMA' })?.nseSymbol, 'SUNPHARMA');
      assert.deepStrictEqual(matchSeededCompany({ bseCode: '524715' })?.bseCode, '524715');
      assert.deepStrictEqual(matchSeededCompany({ companyName: 'Sun Pharmaceutical Industries Ltd' })?.nseSymbol, 'SUNPHARMA');
    });

    test('returns null for unseeded companies', () => {
      assert.strictEqual(matchSeededCompany({ nseSymbol: 'RELIANCE' }), null);
      assert.strictEqual(matchSeededCompany({ bseCode: '500325' }), null);
      assert.strictEqual(matchSeededCompany({ companyName: 'Infosys Limited' }), null);
    });
  });

  describe('3. Normalization Parsers', () => {
    test('parses NSE announcement into NormalizedFiling', () => {
      const rawNse = {
        seq_id: '106767254',
        symbol: 'TCS',
        sm_name: 'Tata Consultancy Services Limited',
        sm_isin: 'INE467B01029',
        an_dt: '03-Sep-2026 00:30:01',
        desc: 'Analyst / Institutional Investor Meet',
        attchmntText: 'Transcript of Earnings Conference Call',
        attchmntFile: 'TCS_Transcript_Q12026.pdf',
      };

      const normalized = parseNseAnnouncement(rawNse);
      assert.ok(normalized);
      assert.strictEqual(normalized.source, 'NSE');
      assert.strictEqual(normalized.sourceAnnouncementId, '106767254');
      assert.strictEqual(normalized.companyName, 'Tata Consultancy Services Limited');
      assert.strictEqual(normalized.nseSymbol, 'TCS');
      assert.strictEqual(normalized.pdfUrl, 'https://nsearchives.nseindia.com/corporate/TCS_Transcript_Q12026.pdf');
    });

    test('parses BSE announcement into NormalizedFiling', () => {
      const rawBse = {
        NEWSID: 'BSE-12345',
        SCRIP_CD: '532540',
        SLONGNAME: 'Tata Consultancy Services Limited',
        NEWSSUB: 'Transcript of Earnings Call Q1 FY26',
        CATEGORYNAME: 'Company Update',
        NEWS_DT: '2026-09-03T00:15:00',
        ATTACHMENTNAME: 'TCS_BSE_Transcript.pdf',
      };

      const normalized = parseBseAnnouncement(rawBse);
      assert.ok(normalized);
      assert.strictEqual(normalized.source, 'BSE');
      assert.strictEqual(normalized.sourceAnnouncementId, 'BSE-12345');
      assert.strictEqual(normalized.bseCode, '532540');
      assert.strictEqual(normalized.pdfUrl, 'https://www.bseindia.com/xml-data/corpfiling/AttachLive/TCS_BSE_Transcript.pdf');
    });
  });

  describe('4. Filename Sanitization & Deterministic Naming', () => {
    test('sanitizes unsafe characters in filenames', () => {
      assert.strictEqual(sanitizeFilename('NSE/TCS:2026*09?03.pdf'), 'NSE_TCS_2026_09_03.pdf');
    });

    test('generates deterministic filename based on safe filing info', () => {
      const date = new Date('2026-09-03T00:00:00.000Z');
      const filename = generateDeterministicFilename('NSE', 'TCS', date, '106767254');
      assert.strictEqual(filename, 'NSE_TCS_20260903_106767254.pdf');
    });
  });
});
