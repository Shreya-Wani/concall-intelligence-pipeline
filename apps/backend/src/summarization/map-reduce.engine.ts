import { SummaryContent, SummaryContentSchema } from '@concall/shared';
import { LlmClient } from './llm-client';
import { renderSummaryMarkdown } from './markdown-renderer';
import { MapChunkResult, ReduceInput, SummarizationResult, TranscriptChunk } from './types';

export class MapReduceEngine {
  private llmClient: LlmClient;

  constructor(llmClient?: LlmClient) {
    this.llmClient = llmClient || new LlmClient();
  }

  public async mapChunk(chunk: TranscriptChunk): Promise<MapChunkResult> {
    const systemPrompt = `
You are a financial analyst extracting facts from an earnings call transcript chunk.
Extract intermediate insights and evidence from Chunk #${chunk.chunkIndex + 1} of ${chunk.totalChunks}.

Return a JSON object matching this exact structure:
{
  "chunkIndex": ${chunk.chunkIndex},
  "claims": [
    {
      "claim": "short summary of factual claim",
      "evidence": "exact quote or verbatim sentence from chunk",
      "chunkIndex": ${chunk.chunkIndex}
    }
  ],
  "financialFigures": ["list of exact financial figures, e.g. ₹1,245 crore, 12.5%, $500 million"],
  "segmentObservations": ["segment performance notes mentioned in chunk"],
  "guidanceStatements": ["forward looking guidance mentioned in chunk"],
  "managementCommentary": ["key executive remarks mentioned in chunk"],
  "qaObservations": ["questions and answers mentioned in chunk"],
  "risks": ["risks or concerns mentioned in chunk"]
}
`.trim();

    const userPrompt = `TRANSCRIPT CHUNK #${chunk.chunkIndex + 1}/${chunk.totalChunks}:\n\n${chunk.text}`;

    const rawResponse = await this.llmClient.generateCompletion({
      systemPrompt,
      userPrompt,
    });

    try {
      const parsed = JSON.parse(rawResponse);
      return {
        chunkIndex: chunk.chunkIndex,
        claims: Array.isArray(parsed.claims) ? parsed.claims : [],
        financialFigures: Array.isArray(parsed.financialFigures) ? parsed.financialFigures : [],
        segmentObservations: Array.isArray(parsed.segmentObservations) ? parsed.segmentObservations : [],
        guidanceStatements: Array.isArray(parsed.guidanceStatements) ? parsed.guidanceStatements : [],
        managementCommentary: Array.isArray(parsed.managementCommentary) ? parsed.managementCommentary : [],
        qaObservations: Array.isArray(parsed.qaObservations) ? parsed.qaObservations : [],
        risks: Array.isArray(parsed.risks) ? parsed.risks : [],
      };
    } catch (err: any) {
      console.warn(`[MAP] Error parsing chunk #${chunk.chunkIndex} JSON response:`, err.message);
      return {
        chunkIndex: chunk.chunkIndex,
        claims: [],
        financialFigures: [],
        segmentObservations: [],
        guidanceStatements: [],
        managementCommentary: [],
        qaObservations: [],
        risks: [],
      };
    }
  }

  public async reduceSummaries(input: ReduceInput): Promise<SummarizationResult> {
    const systemPrompt = `
You are a senior financial analyst synthesizing chunk-level extraction results into a grounded structured earnings call summary.

Return a JSON object conforming strictly to this Zod schema structure:
{
  "company": "${input.company}",
  "scrip_code": ${input.bseCode ? `"${input.bseCode}"` : 'null'},
  "nse_symbol": ${input.nseSymbol ? `"${input.nseSymbol}"` : 'null'},
  "quarter": "${input.quarter}",
  "call_date": null,
  "source": "${input.source}",
  "source_url": ${input.sourceUrl ? `"${input.sourceUrl}"` : 'null'},
  "tldr": ["array of key bullet points summarizing the call"],
  "management_commentary": ["array of key management remarks"],
  "guidance": ["array of future guidance notes"],
  "segment_performance": [
    { "segment": "Segment Name", "notes": "Segment details and growth" }
  ],
  "key_metrics": [
    { "metric": "Metric Name", "value": "Exact Value", "context": "Metric context" }
  ],
  "notable_qa": [
    { "question": "Question text", "answer": "Answer text", "asked_by": "Analyst Name — Firm (or Not disclosed in transcript.)" }
  ],
  "risks": ["array of risks or headwinds"]
}

Rules:
- Do NOT alter financial numbers (e.g. ₹1,245 crore, 12.5%, $500 million, Q1 FY26, FY25, +150 bps, 2.5x).
- If analyst name or firm is missing, set asked_by to "Not disclosed in transcript."
- If any array section has no items disclosed, return an empty array [] or ["Not disclosed in transcript."].
`.trim();

    const userPrompt = `MAP RESULTS FROM ${input.mapResults.length} CHUNKS:\n\n${JSON.stringify(input.mapResults, null, 2)}`;

    let repairAttempts = 0;
    const maxRepairAttempts = 2;

    while (repairAttempts <= maxRepairAttempts) {
      const rawResponse = await this.llmClient.generateCompletion({
        systemPrompt,
        userPrompt: repairAttempts === 0 ? userPrompt : `${userPrompt}\n\nFIX INVALID JSON OUTPUT. RETURN ONLY VALID JSON CONFORMING TO SummaryContentSchema.`,
      });

      try {
        const parsed = JSON.parse(rawResponse);
        const validated = SummaryContentSchema.safeParse(parsed);

        if (validated.success) {
          const summaryJson: SummaryContent = validated.data;
          const summaryMarkdown = renderSummaryMarkdown(summaryJson);

          return {
            summaryJson,
            summaryMarkdown,
            model: this.llmClient.getProviderName(),
            promptVersion: 'v1.0',
          };
        } else {
          repairAttempts++;
          console.warn(`[REDUCE] Zod validation failed (attempt ${repairAttempts}/${maxRepairAttempts}):`, validated.error.format());
        }
      } catch (err: any) {
        repairAttempts++;
        console.warn(`[REDUCE] JSON parse error (attempt ${repairAttempts}/${maxRepairAttempts}):`, err.message);
      }
    }

    throw new Error(`Reduce phase failed Zod SummaryContentSchema validation after ${maxRepairAttempts} repair retries.`);
  }
}
