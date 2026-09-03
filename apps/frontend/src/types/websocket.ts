export type WsConnectionState = 'connected' | 'connecting' | 'disconnected';

export type PipelineEventType =
  | 'connection.established'
  | 'filing.discovered'
  | 'filing.downloaded'
  | 'transcript.extracted'
  | 'summary.completed'
  | 'pipeline.error';

export interface PipelineEventItem {
  id: string;
  type: PipelineEventType;
  timestamp: string;
  data: Record<string, any>;
}
