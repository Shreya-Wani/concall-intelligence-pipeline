import { SummaryContent, SummaryContentSchema } from '@concall/shared';
import { env } from '../config/env';
import { LlmClient } from './llm-client';
import { renderSummaryMarkdown } from './markdown-renderer';
import { MapChunkResult, QAObservation, ReduceInput, SummarizationResult, TranscriptChunk } from './types';

export class MapReduceEngine {
  private llmClient: LlmClient;

  constructor(llmClient?: LlmClient) {
    this.llmClient = llmClient || new LlmClient();
  }

  public async mapChunk(chunk: TranscriptChunk): Promise<MapChunkResult> {
    const systemPrompt = `
You are a financial analyst extracting facts from an earnings call transcript chunk.
Extract intermediate insights and evidence from Chunk #${chunk.chunkIndex + 1} of ${chunk.totalChunks}.

CRITICAL Q&A EXTRACTION RULES:
- For every question asked by an analyst/questioner in this chunk, extract a structured Q&A observation.
- "asked_by": the analyst name and firm (e.g. "Keith Bachman — BMO"). If unknown, use null.
- "question": the full question text from the transcript.
- "answer": the full management response to the question, verbatim or near-verbatim.
  If the question is present but the answer begins in the NEXT chunk, set answer to null
  and set answer_continues_in_next_chunk to true.
  NEVER set answer to "Not disclosed in transcript." unless the answer is genuinely absent from this AND all other chunks.
- "evidence": verbatim quote(s) from this chunk covering both question and answer.
- "chunkIndex": ${chunk.chunkIndex}

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
  "qaObservations": [
    {
      "asked_by": "Analyst Name — Firm or null",
      "question": "Full question text",
      "answer": "Full management answer text or null if answer is in the next chunk",
      "answer_continues_in_next_chunk": false,
      "evidence": "verbatim excerpt covering this Q&A exchange",
      "chunkIndex": ${chunk.chunkIndex}
    }
  ],
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

      // Parse qaObservations: accept both structured objects and legacy plain strings
      const rawQA: unknown[] = Array.isArray(parsed.qaObservations) ? parsed.qaObservations : [];
      const qaObservations: QAObservation[] = rawQA
        .map((item): QAObservation | null => {
          if (typeof item === 'string') {
            // Legacy fallback: plain string — wrap as a minimal QAObservation
            return {
              asked_by: null,
              question: item,
              answer: null,
              answer_continues_in_next_chunk: false,
              evidence: item,
              chunkIndex: chunk.chunkIndex,
            };
          }
          if (item && typeof item === 'object') {
            const obj = item as Record<string, unknown>;
            return {
              asked_by: typeof obj.asked_by === 'string' ? obj.asked_by : null,
              question: typeof obj.question === 'string' ? obj.question : '',
              answer: typeof obj.answer === 'string' ? obj.answer : null,
              answer_continues_in_next_chunk:
                typeof obj.answer_continues_in_next_chunk === 'boolean'
                  ? obj.answer_continues_in_next_chunk
                  : false,
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


  public async intermediateReduceGroup(groupMapResults: MapChunkResult[], groupIndex: number): Promise<MapChunkResult> {
    const systemPrompt = `
You are a financial analyst consolidating chunk-level extractions for Group #${groupIndex + 1}.
Synthesize claims, financial figures, guidance, segment notes, Q&A observations, and risks from the provided chunk extractions.

CRITICAL GROUNDING RULES:
- Use ONLY facts disclosed in the provided chunk extractions.
- Preserve exact financial numbers (e.g. ₹1,245 crore, $500 million, 12.5%, +150 bps, Q1 FY26, FY25).
- Do NOT invent or infer facts not explicitly stated.

CRITICAL Q&A PRESERVATION RULES:
- Every Q&A observation in the input MUST be preserved in the output.
- Keep the exact "asked_by", "question", and "answer" fields from the input without truncation.
- If a Q&A observation has answer=null and answer_continues_in_next_chunk=true, preserve those values unchanged.
- If a Q&A observation has a real answer, copy the answer text exactly — do NOT replace it with "Not disclosed in transcript."
- NEVER drop a Q&A observation from the output even if it seems redundant.
- Merge duplicates only if both the question AND answer are identical.

Return a JSON object matching this exact structure:
{
  "chunkIndex": ${groupIndex},
  "claims": [
    {
      "claim": "short summary of claim",
      "evidence": "exact quote or sentence",
      "chunkIndex": ${groupIndex}
    }
  ],
  "financialFigures": ["list of financial figures"],
  "segmentObservations": ["segment performance notes"],
  "guidanceStatements": ["forward looking guidance notes"],
  "managementCommentary": ["key executive remarks"],
  "qaObservations": [
    {
      "asked_by": "Analyst Name — Firm or null",
      "question": "Full question text",
      "answer": "Full management answer text or null",
      "answer_continues_in_next_chunk": false,
      "evidence": "verbatim excerpt",
      "chunkIndex": 0
    }
  ],
  "risks": ["risks or concerns"]
}
`.trim();

    const userPrompt = `GROUP #${groupIndex + 1} MAP EXTRACTIONS (${groupMapResults.length} CHUNKS):\n\n${JSON.stringify(groupMapResults)}`;

    const rawResponse = await this.llmClient.generateCompletion({
      systemPrompt,
      userPrompt,
    });

    try {
      const parsed = JSON.parse(rawResponse);

      // Parse qaObservations with the same defensive logic used in mapChunk
      const rawQA: unknown[] = Array.isArray(parsed.qaObservations) ? parsed.qaObservations : [];
      const qaObservations: QAObservation[] = rawQA
        .map((item): QAObservation | null => {
          if (typeof item === 'string') {
            return {
              asked_by: null,
              question: item,
              answer: null,
              answer_continues_in_next_chunk: false,
              evidence: item,
              chunkIndex: groupIndex,
            };
          }
          if (item && typeof item === 'object') {
            const obj = item as Record<string, unknown>;
            return {
              asked_by: typeof obj.asked_by === 'string' ? obj.asked_by : null,
              question: typeof obj.question === 'string' ? obj.question : '',
              answer: typeof obj.answer === 'string' ? obj.answer : null,
              answer_continues_in_next_chunk:
                typeof obj.answer_continues_in_next_chunk === 'boolean'
                  ? obj.answer_continues_in_next_chunk
                  : false,
              evidence: typeof obj.evidence === 'string' ? obj.evidence : '',
              chunkIndex: typeof obj.chunkIndex === 'number' ? obj.chunkIndex : groupIndex,
            };
          }
          return null;
        })
        .filter((item): item is QAObservation => item !== null);

      return {
        chunkIndex: groupIndex,
        claims: Array.isArray(parsed.claims) ? parsed.claims : [],
        financialFigures: Array.isArray(parsed.financialFigures) ? parsed.financialFigures : [],
        segmentObservations: Array.isArray(parsed.segmentObservations) ? parsed.segmentObservations : [],
        guidanceStatements: Array.isArray(parsed.guidanceStatements) ? parsed.guidanceStatements : [],
        managementCommentary: Array.isArray(parsed.managementCommentary) ? parsed.managementCommentary : [],
        qaObservations,
        risks: Array.isArray(parsed.risks) ? parsed.risks : [],
      };
    } catch (err: any) {
      console.warn(`[INTERMEDIATE REDUCE] Error parsing group #${groupIndex} JSON response:`, err.message);
      // On parse error: preserve structured QA objects directly from source chunks (no loss)
      return {
        chunkIndex: groupIndex,
        claims: groupMapResults.flatMap((m) => m.claims),
        financialFigures: Array.from(new Set(groupMapResults.flatMap((m) => m.financialFigures))),
        segmentObservations: groupMapResults.flatMap((m) => m.segmentObservations),
        guidanceStatements: groupMapResults.flatMap((m) => m.guidanceStatements),
        managementCommentary: groupMapResults.flatMap((m) => m.managementCommentary),
        qaObservations: groupMapResults.flatMap((m) => m.qaObservations),
        risks: groupMapResults.flatMap((m) => m.risks),
      };
    }
  }

  public async reduceSummaries(input: ReduceInput): Promise<SummarizationResult> {
    let finalMapResults = input.mapResults;

    if (input.mapResults.length > 3) {
      const groupSize = 3;
      const intermediateResults: MapChunkResult[] = [];
      const totalGroups = Math.ceil(input.mapResults.length / groupSize);

      for (let g = 0; g < totalGroups; g++) {
        const group = input.mapResults.slice(g * groupSize, (g + 1) * groupSize);
        console.log(`[REDUCE] Running intermediate reduction for Group #${g + 1}/${totalGroups} (${group.length} chunks)...`);
        const intermediate = await this.intermediateReduceGroup(group, g);
        intermediateResults.push(intermediate);

        // Pause between intermediate group calls to prevent rate-limit bursts
        const requestDelay = env.LLM_REQUEST_DELAY_MS || env.GEMINI_MAP_DELAY_MS || 5000;
        if (process.env.NODE_ENV !== 'test' && g < totalGroups - 1) {
          await new Promise((r) => setTimeout(r, requestDelay));
        }
      }

      // Delay before final reduce synthesis
      const requestDelay = env.LLM_REQUEST_DELAY_MS || env.GEMINI_MAP_DELAY_MS || 5000;
      if (process.env.NODE_ENV !== 'test') {
        await new Promise((r) => setTimeout(r, requestDelay));
      }

      finalMapResults = intermediateResults;
    }

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

    const userPrompt = `MAP RESULTS FROM ${finalMapResults.length} CONSOLIDATED GROUPS:\n\n${JSON.stringify(finalMapResults)}`;

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
