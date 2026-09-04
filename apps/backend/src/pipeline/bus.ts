import { EventEmitter } from 'events';

export interface FilingDiscoveredPayload {
  filingId: string;
  companyId: string;
  companyName: string;
  source: 'NSE' | 'BSE';
  announcementId: string | null;
  subject: string;
  filingDate: string;
}

export interface FilingDownloadedPayload {
  filingId: string;
  companyId: string;
  companyName: string;
  source: 'NSE' | 'BSE';
  pdfHash: string;
  byteSize: number;
}

export interface TranscriptExtractedPayload {
  filingId: string;
  transcriptId: string;
  companyName: string;
  pageCount: number;
  characterCount: number;
  extractionMethod: string;
}

export interface SummaryCompletedPayload {
  filingId: string;
  summaryId: string;
  companyName: string;
  quarter: string;
  model: string;
}

export interface PipelineErrorPayload {
  stage: 'watcher' | 'downloader' | 'extraction' | 'summarization';
  filingId?: string;
  companyName?: string;
  errorMessage: string;
}

export interface WatcherHeartbeatPayload {
  source: 'NSE' | 'BSE';
  checkedAt: string;
  nextCheckMs: number;
}

export interface BusEventMap {
  'filing.discovered': FilingDiscoveredPayload;
  'filing.downloaded': FilingDownloadedPayload;
  'transcript.extracted': TranscriptExtractedPayload;
  'summary.completed': SummaryCompletedPayload;
  'pipeline.error': PipelineErrorPayload;
  'watcher.heartbeat': WatcherHeartbeatPayload;
}

export type BusEventType = keyof BusEventMap;

class PipelineBus extends EventEmitter {
  emit<K extends BusEventType>(event: K, payload: BusEventMap[K]): boolean {
    return super.emit(event, payload);
  }

  on<K extends BusEventType>(event: K, listener: (payload: BusEventMap[K]) => void): this {
    return super.on(event, listener);
  }

  off<K extends BusEventType>(event: K, listener: (payload: BusEventMap[K]) => void): this {
    return super.off(event, listener);
  }

  once<K extends BusEventType>(event: K, listener: (payload: BusEventMap[K]) => void): this {
    return super.once(event, listener);
  }
}

export const bus = new PipelineBus();
bus.setMaxListeners(50);
