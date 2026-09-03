import { z } from 'zod';

export const PipelineEventTypeSchema = z.enum([
  'filing.discovered',
  'filing.downloaded',
  'transcript.extracted',
  'summary.completed',
  'pipeline.error',
]);

export type PipelineEventType = z.infer<typeof PipelineEventTypeSchema>;

export interface FilingDiscoveredData {
  filingId: string;
  companyId: string;
  companyName: string;
  source: 'NSE' | 'BSE';
  announcementId: string;
  subject: string;
  filingDate: string;
}

export interface FilingDownloadedData {
  filingId: string;
  companyId: string;
  companyName: string;
  source: 'NSE' | 'BSE';
  announcementId: string;
  pdfHash: string;
  byteSize: number;
}

export interface TranscriptExtractedData {
  filingId: string;
  transcriptId: string;
  companyName: string;
  pageCount: number;
  characterCount: number;
  extractionMethod: string;
}

export interface SummaryCompletedData {
  summaryId: string;
  filingId: string;
  companyId: string;
  companyName: string;
  quarter: string;
  model: string;
}

export interface PipelineErrorData {
  stage: 'watcher' | 'downloader' | 'extraction' | 'summarization';
  filingId?: string;
  companyName?: string;
  errorMessage: string;
}

export interface PipelineEventMap {
  'filing.discovered': FilingDiscoveredData;
  'filing.downloaded': FilingDownloadedData;
  'transcript.extracted': TranscriptExtractedData;
  'summary.completed': SummaryCompletedData;
  'pipeline.error': PipelineErrorData;
}

export interface PipelineEvent<T extends PipelineEventType = PipelineEventType> {
  type: T;
  timestamp: string;
  data: PipelineEventMap[T];
}
