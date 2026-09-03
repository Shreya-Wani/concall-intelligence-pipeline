import { PipelineEventItem, WsConnectionState } from '../types/websocket';

const getEnvVar = (key: string, defaultVal: string): string => {
  if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
    return (import.meta as any).env[key] || defaultVal;
  }
  return typeof process !== 'undefined' && process.env ? process.env[key] || defaultVal : defaultVal;
};

type WsEventListener = (event: PipelineEventItem) => void;
type WsStateListener = (state: WsConnectionState) => void;

export class WebSocketClient {
  private url: string;
  private ws: WebSocket | null = null;
  private eventListeners: Set<WsEventListener> = new Set();
  private stateListeners: Set<WsStateListener> = new Set();
  private state: WsConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isIntentionallyClosed = false;

  constructor() {
    this.url = getEnvVar('VITE_WS_URL', 'ws://localhost:3001/ws');
  }

  public connect(): void {
    if (typeof window === 'undefined' || typeof WebSocket === 'undefined') return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isIntentionallyClosed = false;
    this.updateState('connecting');

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('[WS-CLIENT] Connected to backend WebSocket stream');
        this.reconnectAttempts = 0;
        this.updateState('connected');
      };

      this.ws.onmessage = (messageEvent) => {
        try {
          const raw = JSON.parse(messageEvent.data);
          const item: PipelineEventItem = {
            id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            type: raw.type,
            timestamp: raw.timestamp || new Date().toISOString(),
            data: raw.data || {},
          };

          this.notifyEventListeners(item);
        } catch (err: any) {
          console.warn('[WS-CLIENT] Error parsing WebSocket message:', err.message);
        }
      };

      this.ws.onclose = () => {
        console.log('[WS-CLIENT] Connection closed');
        this.updateState('disconnected');
        this.ws = null;
        if (!this.isIntentionallyClosed) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (err) => {
        console.warn('[WS-CLIENT] WebSocket error:', err);
        this.updateState('disconnected');
      };
    } catch (err: any) {
      console.warn('[WS-CLIENT] Connection attempt failed:', err.message);
      this.updateState('disconnected');
      this.scheduleReconnect();
    }
  }

  public disconnect(): void {
    this.isIntentionallyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.updateState('disconnected');
  }

  public subscribeEvents(listener: WsEventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  public subscribeState(listener: WsStateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.state); // Immediate callback with current state
    return () => this.stateListeners.delete(listener);
  }

  private updateState(newState: WsConnectionState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.stateListeners.forEach((fn) => fn(newState));
    }
  }

  private notifyEventListeners(event: PipelineEventItem): void {
    this.eventListeners.forEach((fn) => fn(event));
  }

  private scheduleReconnect(): void {
    if (this.isIntentionallyClosed) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('[WS-CLIENT] Maximum reconnection attempts reached.');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts) + Math.random() * 200, 10000);
    console.log(`[WS-CLIENT] Reconnecting in ${Math.round(delay)}ms (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }
}

export const wsClient = new WebSocketClient();
