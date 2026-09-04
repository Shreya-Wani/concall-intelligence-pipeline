import { SummaryContent, SummaryContentSchema } from '@concall/shared';
import { env } from '../config/env';
import { LlmClient } from './llm-client';
import { renderSummaryMarkdown } from './markdown-renderer';
import { resolveQuarter } from './quarter';
import { groundSummary } from './grounding';
import { MapChunkResult, QAObservation, ReduceInput, SummarizationResult, TranscriptChunk } from './types';

export const DEFAULT_MAX_INTERMEDIATE_PAYLOAD_BYTES = 24000;

export function getPayloadByteSize(systemPrompt: string, userPrompt: string): number {
  return Buffer.byteLength(systemPrompt + userPrompt, 'utf-8');
}

/**
 * Deterministically merges MAP chunk results without extra LLM round-trips.
 * Stitches split Q&A turns across chunk boundaries.
 */
export function mergeFacts(mapResults: MapChunkResult[]): MapChunkResult {
  const claimsMap = new Map<string, any>();
  const figuresSet = new Set<string>();
  const segmentSet = new Set<string>();
  const guidanceSet = new Set<string>();
  const commentarySet = new Set<string>();
  const risksSet = new Set<string>();

  const rawQA: QAObservation[] = [];

  for (let i = 0; i < mapResults.length; i++) {
    const res = mapResults[i];
    res.claims?.forEach((c) => { if (c?.claim) claimsMap.set(c.claim.trim().toLowerCase(), c); });
    res.financialFigures?.forEach((f) => { if (f) figuresSet.add(f.trim()); });
    res.segmentObservations?.forEach((s) => { if (s) segmentSet.add(s.trim()); });
    res.guidanceStatements?.forEach((g) => { if (g) guidanceSet.add(g.trim()); });
    res.managementCommentary?.forEach((m) => { if (m) commentarySet.add(m.trim()); });
    res.risks?.forEach((r) => { if (r) risksSet.add(r.trim()); });

    if (Array.isArray(res.qaObservations)) {
      rawQA.push(...res.qaObservations);
    }
  }

  // Stitch Q&A where answer continued into next chunk
  const stitchedQA: QAObservation[] = [];
  for (let i = 0; i < rawQA.length; i++) {
    const curr = rawQA[i];
    if (curr.answer_continues_in_next_chunk && !curr.answer && i + 1 < rawQA.length) {
      const next = rawQA[i + 1];
      if (next.answer && !next.question) {
        stitchedQA.push({
          asked_by: curr.asked_by || next.asked_by,
          question: curr.question,
          answer: next.answer,
          answer_continues_in_next_chunk: false,
          evidence: `${curr.evidence}\n${next.evidence}`.trim(),
          chunkIndex: curr.chunkIndex,
        });
        i++; // skip next since merged
        continue;
      }
    }
    stitchedQA.push(curr);
  }

  // Deduplicate Q&A by question + answer
  const qaDedupMap = new Map<string, QAObservation>();
  stitchedQA.forEach((qa) => {
    if (!qa.question) return;
    const key = `${qa.question.trim().toLowerCase()}||${(qa.answer || '').trim().toLowerCase()}`;
    if (!qaDedupMap.has(key)) {
      qaDedupMap.set(key, qa);
    }
  });

  return {
    chunkIndex: 0,
    claims: Array.from(claimsMap.values()),
    financialFigures: Array.from(figuresSet),
    segmentObservations: Array.from(segmentSet),
    guidanceStatements: Array.from(guidanceSet),
    managementCommentary: Array.from(commentarySet),
    qaObservations: Array.from(qaDedupMap.values()),
    risks: Array.from(risksSet),
  };
}

export class MapReduceEngine {
  private llmClient: LlmClient;
  private maxPayloadBytes: number;

  constructor(llmClient?: LlmClient, maxPayloadBytes?: number) {
    this.llmClient = llmClient || new LlmClient();
    this.maxPayloadBytes = maxPayloadBytes || DEFAULT_MAX_INTERMEDIATE_PAYLOAD_BYTES;
  }

  public async mapChunk(chunk: TranscriptChunk): Promise<MapChunkResult> {
    const systemPrompt = `
You are a financial analyst extracting facts from an earnings call transcript chunk.
Extract intermediate insights and evidence from Chunk #${chunk.chunkIndex + 1} of ${chunk.totalChunks}.

CRITICAL Q&A EXTRACTION RULES:
- For every question asked by an analyst/questioner in this chunk, extract a structured Q&A observation.
- "asked_by": analyst name and firm (e.g. "Keith Bachman — BMO"). If unknown, use null.
- "question": the full question text from transcript.
- "answer": full management response text or null if answer continues in next chunk.
- "evidence": verbatim quote(s).
- "chunkIndex": ${chunk.chunkIndex}

Return JSON object:
{
  "chunkIndex": ${chunk.chunkIndex},
  "claims": [{ "claim": "...", "evidence": "...", "chunkIndex": ${chunk.chunkIndex} }],
  "financialFigures": ["₹1,245 crore", "12.5%"],
  "segmentObservations": ["..."],
  "guidanceStatements": ["..."],
  "managementCommentary": ["..."],
  "qaObservations": [{ "asked_by": "...", "question": "...", "answer": "...", "answer_continues_in_next_chunk": false, "evidence": "...", "chunkIndex": ${chunk.chunkIndex} }],
  "risks": ["..."]
}
`.trim();

    const userPrompt = `TRANSCRIPT CHUNK #${chunk.chunkIndex + 1}/${chunk.totalChunks}:\n\n${chunk.text}`;

    const rawResponse = await this.llmClient.generateCompletion({ systemPrompt, userPrompt });

    try {
      const parsed = JSON.parse(rawResponse);
      const rawQA: unknown[] = Array.isArray(parsed.qaObservations) ? parsed.qaObservations : [];
      const qaObservations: QAObservation[] = rawQA
        .map((item): QAObservation | null => {
          if (typeof item === 'string') {
            return { asked_by: null, question: item, answer: null, answer_continues_in_next_chunk: false, evidence: item, chunkIndex: chunk.chunkIndex };
          }
          if (item && typeof item === 'object') {
            const obj = item as Record<string, unknown>;
            return {
              asked_by: typeof obj.asked_by === 'string' ? obj.asked_by : null,
              question: typeof obj.question === 'string' ? obj.question : '',
              answer: typeof obj.answer === 'string' ? obj.answer : null,
              answer_continues_in_next_chunk: Boolean(obj.answer_continues_in_next_chunk),
              evidence: typeof obj.evidence === 'string' ? obj.evidence : '',
              chunkIndex: typeof obj.chunkIndex === 'number' ? obj.chunkIndex : chunk.chunkIndex,
            };
          }
          return null;
        })
        .filter((item): item is QAObservation => item !== null);

      return {
        chunkIndex: chunk.chunkIndex,
        claims: Array.isArray(parsed.claims) ? parsed.claims : [],
        financialFigures: Array.isArray(parsed.financialFigures) ? parsed.financialFigures : [],
        segmentObservations: Array.isArray(parsed.segmentObservations) ? parsed.segmentObservations : [],
        guidanceStatements: Array.isArray(parsed.guidanceStatements) ? parsed.guidanceStatements : [],
        managementCommentary: Array.isArray(parsed.managementCommentary) ? parsed.managementCommentary : [],
        qaObservations,
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

  public async reduceSummaries(
    input: ReduceInput,
    fullTranscriptText?: string
  ): Promise<SummarizationResult> {
    const mergedMapResult = mergeFacts(input.mapResults);

    // Resolve quarter with Indian FY rules
    const quarterInfo = resolveQuarter(
      fullTranscriptText,
      null,
      `${input.company} Earnings Call ${input.quarter}`
    );

    const systemPrompt = `
You are a senior financial analyst synthesizing an earnings call summary.
Synthesize the extracted facts into a final structured JSON summary.

CRITICAL RULES:
- Do NOT invent numbers or facts not present in the input.
- Preserve exact financial values (e.g. ₹1,245 crore, $500 million, 12.5%, +150 bps).
- "quarter": use "${quarterInfo.quarter}".
- "company": "${input.company}".
- "source": "${input.source}".

JSON Output Schema:
{
  "company": "${input.company}",
  "scrip_code": "${input.bseCode || ''}",
  "nse_symbol": "${input.nseSymbol || ''}",
  "quarter": "${quarterInfo.quarter}",
  "quarter_inferred": ${quarterInfo.quarter_inferred},
  "call_date": null,
  "source": "${input.source}",
  "source_url": "${input.sourceUrl || ''}",
  "tldr": ["key takeaways"],
  "management_commentary": ["executive remarks"],
  "management_tone": "executive tone",
  "guidance": ["forward looking statements"],
  "segment_performance": [{ "segment": "...", "notes": "..." }],
  "key_metrics": [{ "metric": "...", "value": "...", "context": "..." }],
  "notable_qa": [{ "question": "...", "answer": "...", "asked_by": "..." }],
  "risks": ["..."]
}
`.trim();

    // Compact merged facts so prompt payload stays well within LLM request limits (e.g. Groq 413 Payload Too Large)
    const compactQA = (mergedMapResult.qaObservations || [])
      .filter((q) => q.question && q.question.trim().length > 0)
      .slice(0, 10)
      .map((q) => ({
        asked_by: q.asked_by ? q.asked_by.slice(0, 80) : null,
        question: q.question.slice(0, 300),
        answer: q.answer ? q.answer.slice(0, 400) : null,
      }));

    const compactMapResult = {
      financialFigures: (mergedMapResult.financialFigures || []).slice(0, 25),
      segmentObservations: (mergedMapResult.segmentObservations || []).slice(0, 15),
      guidanceStatements: (mergedMapResult.guidanceStatements || []).slice(0, 15),
      managementCommentary: (mergedMapResult.managementCommentary || []).slice(0, 20),
      qaObservations: compactQA,
      risks: (mergedMapResult.risks || []).slice(0, 15),
      claims: (mergedMapResult.claims || []).slice(0, 15).map((c) => ({ claim: c.claim.slice(0, 200) })),
    };

    const userPrompt = `EXTRACTED FACTS:\n${JSON.stringify(compactMapResult, null, 2)}`;

    let summaryJson: SummaryContent;
    let attempts = 0;
    const maxAttempts = 3;
    let lastError: Error | null = null;
    let promptToSend = userPrompt;

    while (attempts < maxAttempts) {
      attempts++;
      try {
        const rawResponse = await this.llmClient.generateCompletion({
          systemPrompt,
          userPrompt: promptToSend,
        });

        const parsed = JSON.parse(rawResponse);
        if (!parsed.quarter) parsed.quarter = quarterInfo.quarter;
        parsed.quarter_inferred = quarterInfo.quarter_inferred;

        summaryJson = SummaryContentSchema.parse(parsed);

        // Grounding verification
        if (fullTranscriptText) {
          const grounding = groundSummary(summaryJson as any, fullTranscriptText);
          summaryJson.grounding = grounding;
        }

        const summaryMarkdown = renderSummaryMarkdown(summaryJson);

        return {
          summaryJson,
          summaryMarkdown,
          model: this.llmClient.getProviderName(),
          promptVersion: 'v2.0',
        };
      } catch (err: any) {
        lastError = err;
        console.warn(`[REDUCE] Attempt ${attempts}/${maxAttempts} failed: ${err.message}`);
        promptToSend = `${userPrompt}\n\nPREVIOUS ERROR (fix JSON format): ${err.message}`;
      }
    }

    throw new Error(`Summarization REDUCE failed after ${maxAttempts} attempts: ${lastError?.message}`);
  }
}
