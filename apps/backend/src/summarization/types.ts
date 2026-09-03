import { SummaryContent } from '@concall/shared';

export interface TranscriptChunk {
  chunkIndex: number; // 0-indexed
  totalChunks: number;
  startChar: number;
  endChar: number;
  text: string;
}

export interface MapClaim {
  claim: string;
  evidence: string;
  chunkIndex: number;
}

/**
 * Structured Q&A observation extracted from a transcript chunk.
 *
 * Rules:
 * - `asked_by`: analyst/questioner name and firm when present in chunk, else null.
 * - `question`: verbatim or near-verbatim question text.
 * - `answer`: verbatim or near-verbatim management answer when present in same chunk.
 *   Use null when the answer is not present in this chunk (i.e. continues in the next chunk).
 * - `answer_continues_in_next_chunk`: true when the question is at the end of the chunk
 *   and the management answer is expected to begin in the next chunk.
 * - `evidence`: the direct quote(s) from the chunk that support question and/or answer.
 * - `chunkIndex`: 0-indexed chunk that contains this Q&A.
 */
export interface QAObservation {
  asked_by: string | null;
  question: string;
  answer: string | null;
  answer_continues_in_next_chunk: boolean;
  evidence: string;
  chunkIndex: number;
}

export interface MapChunkResult {
  chunkIndex: number;
  claims: MapClaim[];
  financialFigures: string[];
  segmentObservations: string[];
  guidanceStatements: string[];
  managementCommentary: string[];
  qaObservations: QAObservation[];
  risks: string[];
}


export interface ReduceInput {
  company: string;
  quarter: string;
  nseSymbol?: string | null;
  bseCode?: string | null;
  source: string;
  sourceUrl?: string | null;
  mapResults: MapChunkResult[];
}

export interface SummarizationResult {
  summaryJson: SummaryContent;
  summaryMarkdown: string;
  model: string;
  promptVersion: string;
}

export interface ChunkConfig {
  targetChunkSize: number; // e.g. 7000
  overlapSize: number; // e.g. 600
}
