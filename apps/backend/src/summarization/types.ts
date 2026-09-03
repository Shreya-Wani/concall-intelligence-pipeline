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

export interface MapChunkResult {
  chunkIndex: number;
  claims: MapClaim[];
  financialFigures: string[];
  segmentObservations: string[];
  guidanceStatements: string[];
  managementCommentary: string[];
  qaObservations: string[];
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
