import assert from 'node:assert';
import { describe, test } from 'node:test';
import { SummaryContentSchema } from '@concall/shared';
import { LlmClient } from '../llm-client';
import { MapReduceEngine } from '../map-reduce.engine';
import { renderSummaryMarkdown } from '../markdown-renderer';
import { chunkTranscript } from '../text-chunker';

describe('Phase 5 Summarization Unit Tests', () => {
  describe('1. Chunker & Boundary Preservation', () => {
    test('splits long transcript into chunks with required metadata and overlap', () => {
      const p1 = 'A'.repeat(4000);
      const p2 = 'B'.repeat(4000);
      const text = `${p1}\n\nManagement:\n${p2}`;

      const chunks = chunkTranscript(text, { targetChunkSize: 5000, overlapSize: 500 });
      assert.ok(chunks.length > 1, 'Transcript split into multiple chunks');

      chunks.forEach((chunk, idx) => {
        assert.strictEqual(chunk.chunkIndex, idx);
        assert.strictEqual(chunk.totalChunks, chunks.length);
        assert.ok(typeof chunk.startChar === 'number');
        assert.ok(typeof chunk.endChar === 'number');
        assert.ok(chunk.text.length > 0);
      });
    });

    test('preserves speaker label boundaries during chunking', () => {
      const section1 = 'Management:\nJohn Doe — CFO\n' + 'Statement line. '.repeat(200);
      const section2 = '\nAnalyst:\nJane Smith — Goldman Sachs\n' + 'Question line. '.repeat(200);
      const fullText = section1 + section2;

      const chunks = chunkTranscript(fullText, { targetChunkSize: 3000, overlapSize: 300 });
      assert.ok(chunks.length >= 2);

      // Verify second chunk begins near speaker boundary
      assert.ok(chunks[1].text.includes('Analyst:'), 'Speaker block boundary preserved');
    });
  });

  describe('2. Map & Reduce Engine with LLM Fallback Provider', () => {
    test('executes map phase and extracts claims with evidence and chunkIndex', async () => {
      process.env.LLM_PROVIDER = 'fallback';
      const client = new LlmClient();
      const engine = new MapReduceEngine(client);

      const chunk = {
        chunkIndex: 0,
        totalChunks: 1,
        startChar: 0,
        endChar: 500,
        text: 'Revenue increased 12.5% to ₹1,245 crore in Q1 FY26.',
      };

      const mapResult = await engine.mapChunk(chunk);
      assert.strictEqual(mapResult.chunkIndex, 0);
      assert.ok(Array.isArray(mapResult.claims));
      assert.ok(mapResult.claims.length > 0);
      assert.strictEqual(mapResult.claims[0].chunkIndex, 0);
      assert.ok(mapResult.claims[0].evidence.includes('₹1,245 crore'));
    });

    test('synthesizes map outputs into valid SummaryContentSchema JSON during reduce phase', async () => {
      process.env.LLM_PROVIDER = 'fallback';
      const client = new LlmClient();
      const engine = new MapReduceEngine(client);

      const result = await engine.reduceSummaries({
        company: 'Tata Consultancy Services Limited',
        quarter: 'Q1 FY26',
        nseSymbol: 'TCS',
        bseCode: '532540',
        source: 'NSE',
        sourceUrl: 'https://www.nseindia.com',
        mapResults: [
          {
            chunkIndex: 0,
            claims: [
              {
                claim: 'Revenue grew 12.5% to ₹1,245 crore',
                evidence: 'Revenue increased 12.5% to ₹1,245 crore',
                chunkIndex: 0,
              },
            ],
            financialFigures: ['₹1,245 crore', '12.5%', '+150 bps', '$500 million'],
            segmentObservations: ['Cloud & Digital grew 18.5%'],
            guidanceStatements: ['Double digit growth in FY26'],
            managementCommentary: ['Strong demand across key verticals'],
            qaObservations: ['Margin expansion questioned'],
            risks: ['Macroeconomic uncertainty'],
          },
        ],
      });

      const zodCheck = SummaryContentSchema.safeParse(result.summaryJson);
      assert.strictEqual(zodCheck.success, true, 'Reduce phase summary conforms strictly to SummaryContentSchema');

      assert.strictEqual(result.summaryJson.company, 'Tata Consultancy Services Limited');
      assert.strictEqual(result.summaryJson.nse_symbol, 'TCS');
      assert.ok(result.summaryJson.tldr.some((t) => t.includes('₹1,245 crore')), 'Financial values preserved in TLDR');
    });
  });

  describe('3. Markdown Rendering Parity', () => {
    test('renders validated SummaryContent JSON deterministically into GitHub markdown', () => {
      const summaryJson = {
        company: 'Sun Pharmaceutical Industries Limited',
        scrip_code: '524715',
        nse_symbol: 'SUNPHARMA',
        quarter: 'Q1 FY26',
        call_date: '2026-07-20',
        source: 'BSE',
        source_url: 'https://api.bseindia.com',
        tldr: ['R&D investments grew 15.0% to $120 million.'],
        management_commentary: ['Global specialty business delivered 22.5% YoY growth.'],
        guidance: ['Sustained R&D investment pipeline.'],
        segment_performance: [{ segment: 'India Formulations', notes: 'Grew 11.2% YoY.' }],
        key_metrics: [{ metric: 'R&D Spend', value: '$120 million', context: '15.0% growth' }],
        notable_qa: [
          {
            question: 'What is the outlook for US generics?',
            answer: 'Price erosion remains stable in single digits.',
            asked_by: 'John Smith — Citi',
          },
        ],
        risks: ['Regulatory inspection delays.'],
      };

      const markdown = renderSummaryMarkdown(summaryJson);
      assert.ok(markdown.includes('# Executive Earnings Summary: Sun Pharmaceutical Industries Limited'));
      assert.ok(markdown.includes('**Quarter:** Q1 FY26'));
      assert.ok(markdown.includes('R&D investments grew 15.0% to $120 million'));
      assert.ok(markdown.includes('| R&D Spend | **$120 million** | 15.0% growth |'));
      assert.ok(markdown.includes('John Smith — Citi'));
    });
  });

  describe('4. LLM Production Fallback Policy & Missing Info Handling', () => {
    test('fails clearly if production provider is chosen without API key', async () => {
      process.env.LLM_PROVIDER = 'gemini';
      delete process.env.GEMINI_API_KEY;

      const client = new LlmClient();
      await assert.rejects(
        async () => {
          await client.generateCompletion({ systemPrompt: 'test', userPrompt: 'test' });
        },
        /GEMINI_API_KEY environment variable is not set/,
        'Fails explicitly without silent mock generation in production mode'
      );
    });

    test('handles missing information by preserving "Not disclosed in transcript."', () => {
      const summaryJson = {
        company: 'Tata Motors Limited',
        scrip_code: '500570',
        nse_symbol: 'TATAMOTORS',
        quarter: 'Q1 FY26',
        call_date: null,
        source: 'NSE',
        source_url: null,
        tldr: [],
        management_commentary: [],
        guidance: [],
        segment_performance: [],
        key_metrics: [],
        notable_qa: [],
        risks: [],
      };

      const markdown = renderSummaryMarkdown(summaryJson);
      assert.ok(markdown.includes('_Not disclosed in transcript._'));
    });
  });
});
