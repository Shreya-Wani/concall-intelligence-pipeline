import assert from 'node:assert';
import { test, describe } from 'node:test';
import { cleanTranscriptText, detectRepeatedHeadersFooters, removePageNumbers } from '../text-cleaner';
import { evaluateTranscriptQuality } from '../quality-check';
import { ExtractionPage } from '../types';

describe('PDF Extraction & Text Cleaner Unit Tests', () => {
  describe('1. Financial & Numerical Data Preservation', () => {
    test('preserves rupees, dollars, percentages, bps, dates, decimals, and negative numbers exactly', () => {
      const sampleText = [
        'Revenue increased by 12.5% to ₹1,245 crore in Q1 FY26 compared to FY25.',
        'Net margin expanded by +150 bps with operating cash flow at $500 million.',
        'Volume growth was 2.5x with a debt reduction of -5.2% (EPS: 12.45).',
      ].join('\n');

      const pages: ExtractionPage[] = [{ pageNumber: 1, text: sampleText, charCount: sampleText.length }];
      const cleaned = cleanTranscriptText(pages);

      assert.ok(cleaned.cleanedText.includes('₹1,245 crore'), 'Rupee value preserved');
      assert.ok(cleaned.cleanedText.includes('$500 million'), 'Dollar value preserved');
      assert.ok(cleaned.cleanedText.includes('12.5%'), 'Percentage preserved');
      assert.ok(cleaned.cleanedText.includes('+150 bps'), 'Basis points preserved');
      assert.ok(cleaned.cleanedText.includes('Q1 FY26'), 'Quarter date preserved');
      assert.ok(cleaned.cleanedText.includes('FY25'), 'Fiscal year preserved');
      assert.ok(cleaned.cleanedText.includes('2.5x'), 'Multiplier preserved');
      assert.ok(cleaned.cleanedText.includes('-5.2%'), 'Negative percentage preserved');
      assert.ok(cleaned.cleanedText.includes('12.45'), 'Decimal figure preserved');
    });
  });

  describe('2. Speaker Label Preservation', () => {
    test('maintains speaker names and roles intact', () => {
      const transcriptInput = [
        'Management:',
        'John Doe — Chief Financial Officer',
        'Thank you for joining our Q1 FY26 earnings call.',
        '',
        'Analyst:',
        'Jane Smith — Goldman Sachs',
        'Could you provide details on the EBITDA margin expansion?',
      ].join('\n');

      const pages: ExtractionPage[] = [{ pageNumber: 1, text: transcriptInput, charCount: transcriptInput.length }];
      const cleaned = cleanTranscriptText(pages);

      assert.ok(cleaned.cleanedText.includes('Management:'), 'Management label preserved');
      assert.ok(cleaned.cleanedText.includes('John Doe — Chief Financial Officer'), 'CFO name preserved');
      assert.ok(cleaned.cleanedText.includes('Analyst:'), 'Analyst label preserved');
      assert.ok(cleaned.cleanedText.includes('Jane Smith — Goldman Sachs'), 'Analyst name & firm preserved');
    });
  });

  describe('3. Header & Footer Removal', () => {
    test('conservatively removes repeated headers/footers across pages without stripping financial terms', () => {
      const page1 = [
        'CONFIDENTIAL - TATA CONSULTANCY SERVICES EARNINGS CALL',
        'Management Presentation',
        'Revenue was ₹50,000 crore.',
        'Page 1 of 3',
      ].join('\n');

      const page2 = [
        'CONFIDENTIAL - TATA CONSULTANCY SERVICES EARNINGS CALL',
        'Question & Answer Session',
        'EBITDA margin reached 24.5%.',
        'Page 2 of 3',
      ].join('\n');

      const pages: ExtractionPage[] = [
        { pageNumber: 1, text: page1, charCount: page1.length },
        { pageNumber: 2, text: page2, charCount: page2.length },
      ];

      const repeated = detectRepeatedHeadersFooters(pages);
      assert.ok(repeated.has('CONFIDENTIAL - TATA CONSULTANCY SERVICES EARNINGS CALL'), 'Header artifact detected');

      const cleaned = cleanTranscriptText(pages);
      assert.ok(!cleaned.cleanedText.includes('CONFIDENTIAL - TATA CONSULTANCY SERVICES EARNINGS CALL'), 'Header artifact removed');
      assert.ok(!cleaned.cleanedText.includes('Page 1 of 3'), 'Footer page number removed');
      assert.ok(cleaned.cleanedText.includes('₹50,000 crore'), 'Financial data preserved');
      assert.ok(cleaned.cleanedText.includes('24.5%'), 'EBITDA percentage preserved');
    });
  });

  describe('4. Page Number Cleaning', () => {
    test('removes standalone page numbers and page-number patterns', () => {
      assert.strictEqual(removePageNumbers('Page 12'), null);
      assert.strictEqual(removePageNumbers('Page 12 of 45'), null);
      assert.strictEqual(removePageNumbers('12 of 45'), null);
      assert.strictEqual(removePageNumbers('42'), null);

      assert.strictEqual(removePageNumbers('Q1 FY26 Revenue ₹1,245 crore'), 'Q1 FY26 Revenue ₹1,245 crore');
    });
  });

  describe('5. Quality Evaluation & Scanned PDF Detection', () => {
    test('passes quality check for normal text earnings transcript', () => {
      const text = 'A '.repeat(500); // 1000 chars text
      const pages: ExtractionPage[] = [{ pageNumber: 1, text, charCount: text.length }];
      const result = evaluateTranscriptQuality(text, 1, pages);

      assert.strictEqual(result.passed, true);
      assert.strictEqual(result.isScannedPdf, false);
      assert.ok(result.score >= 0.8);
    });

    test('detects scanned image-only PDF with low text density and flags OCR_REQUIRED', () => {
      const scannedText = 'Scanned document page 1'; // 23 chars
      const pages: ExtractionPage[] = [{ pageNumber: 1, text: scannedText, charCount: scannedText.length }];
      const result = evaluateTranscriptQuality(scannedText, 5, pages);

      assert.strictEqual(result.passed, false);
      assert.strictEqual(result.isScannedPdf, true);
      assert.ok(result.warnings.some((w) => w.includes('OCR required')));
    });
  });
});
