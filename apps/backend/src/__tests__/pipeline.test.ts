import { describe, expect, it } from 'vitest';
import { cleanTranscriptText, detectRepeatedHeadersFooters, normalizeSpeakerLabels } from '../extraction/text-cleaner';
import { groundSummary } from '../summarization/grounding';
import { mergeFacts } from '../summarization/map-reduce.engine';
import { deriveQuarterFromDate, deriveQuarterFromText, resolveQuarter } from '../summarization/quarter';
import { chunkTranscript } from '../summarization/text-chunker';
import { MapChunkResult } from '../summarization/types';
import { isTranscriptFiling } from '../watcher/filters';

describe('1. Quarter Derivation', () => {
  it('extracts direct Q1 FY25 pattern', () => {
    const res = deriveQuarterFromText('Infosys Q1 FY25 Earnings Call');
    expect(res?.quarter).toBe('Q1 FY25');
    expect(res?.quarter_inferred).toBe(false);
  });

  it('extracts ordinal quarter pattern', () => {
    const res = deriveQuarterFromText('Discussion of First Quarter FY26 results');
    expect(res?.quarter).toBe('Q1 FY26');
  });

  it('extracts quarter ended month pattern', () => {
    const res = deriveQuarterFromText('For the quarter ended June 2024');
    expect(res?.quarter).toBe('Q1 FY25');
  });

  it('derives Indian FY quarter from Date (Q1: Apr-Jun)', () => {
    const res = deriveQuarterFromDate(new Date('2024-05-15'));
    expect(res.quarter).toBe('Q1 FY25');
    expect(res.quarter_inferred).toBe(true);
  });

  it('derives Indian FY quarter from Date (Q4: Jan-Mar)', () => {
    const res = deriveQuarterFromDate(new Date('2025-02-10'));
    expect(res.quarter).toBe('Q4 FY25');
  });

  it('resolves quarter with fallback precedence', () => {
    const res = resolveQuarter('Nothing here', new Date('2024-08-01'), 'TCS Concall');
    expect(res.quarter).toBe('Q2 FY25');
    expect(res.quarter_inferred).toBe(true);
  });
});

describe('2. Grounding Verification', () => {
  it('verifies summary numbers against transcript', () => {
    const summary = {
      tldr: ['Revenue reached ₹1,245 crore.'],
      key_metrics: [{ metric: 'EBITDA Margin', value: '21.5%', context: 'Up 150 bps' }],
    };
    const transcript = 'Revenue increased to Rs. 1,245 crores with EBITDA margin at 21.5%, up 150 bps.';

    const report = groundSummary(summary, transcript);
    expect(report.numericPrecision).toBe(1.0);
    expect(report.numbersVerified).toBe(3);
    expect(report.unverifiable).toBe(0);
  });

  it('flags ungrounded numbers in report', () => {
    const summary = {
      tldr: ['Revenue reached ₹9,999 crore.'],
    };
    const transcript = 'Revenue increased to Rs. 1,245 crores.';

    const report = groundSummary(summary, transcript);
    expect(report.numericPrecision).toBe(0);
    expect(report.unverifiable).toBe(1);
    expect(report.dropped.length).toBe(1);
  });
});

describe('3. Text Cleaner & Speaker Normalization', () => {
  it('normalizes speaker labels onto newlines', () => {
    const raw = 'Intro text. Management: Welcome everyone. Analyst - Kotak: Thanks for taking my question.';
    const cleaned = normalizeSpeakerLabels(raw);
    expect(cleaned).toContain('\nManagement:');
    expect(cleaned).toContain('\nAnalyst - Kotak:');
  });

  it('detects repeated headers across pages', () => {
    const pages = [
      { pageNumber: 1, text: 'Infosys Q1 FY25 Transcript | Page 1 of 25\nContent 1', charCount: 50 },
      { pageNumber: 2, text: 'Infosys Q1 FY25 Transcript | Page 2 of 25\nContent 2', charCount: 50 },
      { pageNumber: 3, text: 'Infosys Q1 FY25 Transcript | Page 3 of 25\nContent 3', charCount: 50 },
    ];
    const repeated = detectRepeatedHeadersFooters(pages);
    expect(repeated.size).toBeGreaterThan(0);
  });

  it('cleans transcript text removing repeated headers and edge page numbers', () => {
    const pages = [
      { pageNumber: 1, text: 'Header Line\nPage 1\nManagement: Hello\nFooter Line', charCount: 40 },
      { pageNumber: 2, text: 'Header Line\nPage 2\nAnalyst: Question\nFooter Line', charCount: 40 },
      { pageNumber: 3, text: 'Header Line\nPage 3\nManagement: Answer\nFooter Line', charCount: 40 },
    ];
    const cleaned = cleanTranscriptText(pages);
    expect(cleaned.cleanedText).toContain('Management:');
    expect(cleaned.cleanedText).toContain('Hello');
    expect(cleaned.cleanedText).toContain('Analyst:');
    expect(cleaned.cleanedText).toContain('Question');

  });
});

describe('4. Text Chunker & Speaker Boundaries', () => {
  it('chunks text cleanly at speaker boundaries', () => {
    const longText = Array(300).fill('Management: We had a solid quarter with strong growth. ').join(' ') +
      '\nModerator: Next question is from Keith Bachman.\n' +
      Array(300).fill('Analyst - BMO: Can you speak about BFSI? ').join(' ');

    const chunks = chunkTranscript(longText, { targetChunkSize: 5000, overlapSize: 200 });
    expect(chunks.length).toBeGreaterThan(1);
  });
});

describe('5. Deterministic mergeFacts', () => {
  it('merges claims and deduplicates figures without LLM', () => {
    const maps: MapChunkResult[] = [
      {
        chunkIndex: 0,
        claims: [{ claim: 'Revenue grew 12%', evidence: '12%', chunkIndex: 0 }],
        financialFigures: ['₹1,245 crore', '12%'],
        segmentObservations: ['IT grew 10%'],
        guidanceStatements: ['Double digit growth'],
        managementCommentary: ['Good demand'],
        qaObservations: [{ asked_by: 'Analyst A', question: 'Margin outlook?', answer: null, answer_continues_in_next_chunk: true, evidence: 'Q1', chunkIndex: 0 }],
        risks: ['Forex'],
      },
      {
        chunkIndex: 1,
        claims: [{ claim: 'Revenue grew 12%', evidence: '12%', chunkIndex: 1 }],
        financialFigures: ['₹1,245 crore', '150 bps'],
        segmentObservations: ['BFSI recovery'],
        guidanceStatements: ['Double digit growth'],
        managementCommentary: ['Good demand'],
        qaObservations: [{ asked_by: 'Analyst A', question: '', answer: 'EBITDA margin up 150 bps', answer_continues_in_next_chunk: false, evidence: 'A1', chunkIndex: 1 }],
        risks: ['Inflation'],
      },
    ];

    const merged = mergeFacts(maps);
    expect(merged.claims.length).toBe(1);
    expect(merged.financialFigures).toContain('150 bps');
    expect(merged.qaObservations.length).toBe(1);
    expect(merged.qaObservations[0].question).toBe('Margin outlook?');
    expect(merged.qaObservations[0].answer).toBe('EBITDA margin up 150 bps');
  });
});

describe('6. Transcript Filing Filter', () => {
  it('identifies valid transcript filings', () => {
    expect(isTranscriptFiling('Transcript of Q1 FY25 Earnings Call', 'Corporate Announcement')).toBe(true);
    expect(isTranscriptFiling('Audio recording and transcript of concall', 'Filing')).toBe(true);
  });

  it('rejects non-transcript intimation notices', () => {
    expect(isTranscriptFiling('Schedule of Analyst/Investor Meeting', 'Intimation')).toBe(false);
    expect(isTranscriptFiling('Investor Presentation Q1 FY25', 'Presentation')).toBe(false);
  });
});
