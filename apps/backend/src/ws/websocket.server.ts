import http from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { PipelineEvent, PipelineEventMap, PipelineEventType } from './types';

export class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private pingInterval: NodeJS.Timeout | null = null;

  public init(server: http.Server, path: string = '/ws'): void {
    if (this.wss) return;

    this.wss = new WebSocketServer({ server, path });

    this.wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
      console.log(`[WS] Client connected from ${req.socket.remoteAddress}`);
      this.clients.add(ws);

      // Send initial welcome frame
      ws.send(
        JSON.stringify({
          type: 'connection.established',
          timestamp: new Date().toISOString(),
          data: { message: 'Connected to Concall Intelligence WebSocket Stream' },
        })
      );

      ws.on('pong', () => {
        (ws as any).isAlive = true;
      });

      ws.on('close', () => {
        this.clients.delete(ws);
        console.log('[WS] Client disconnected');
      });

      ws.on('error', (err) => {
        console.warn('[WS] Client error:', err.message);
        this.clients.delete(ws);
      });
    });

    // Ping-pong heartbeat every 30 seconds to clean stale connections
    this.pingInterval = setInterval(() => {
      if (!this.wss) return;
      this.clients.forEach((ws) => {
        if ((ws as any).isAlive === false) {
          this.clients.delete(ws);
          return ws.terminate();
        }
        (ws as any).isAlive = false;
        ws.ping();
      });
    }, 30000);
    // Unref interval so it does not block Node process exit
    this.pingInterval.unref();

    this.wss.on('close', () => {
      if (this.pingInterval) {
        clearInterval(this.pingInterval);
        this.pingInterval = null;
      }
    });

    console.log(`[WS] WebSocket server initialized on path ${path}`);
  }

  public getConnectedClientCount(): number {
    return this.clients.size;
  }

  public broadcast<T extends PipelineEventType>(type: T, data: PipelineEventMap[T]): PipelineEvent<T> {
    const event: PipelineEvent<T> = {
      type,
      timestamp: new Date().toISOString(),
      data,
    };

    const payload = JSON.stringify(event);

    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(payload);
        } catch (err: any) {
          console.warn('[WS] Error broadcasting event to client:', err.message);
          this.clients.delete(client);
        }
      }
    });

    return event;
  }

  public close(): Promise<void> {
    return new Promise((resolve) => {
      if (this.pingInterval) {
        clearInterval(this.pingInterval);
        this.pingInterval = null;
      }
      if (!this.wss) return resolve();
      this.wss.close(() => {
        this.wss = null;
        this.clients.clear();
        resolve();
      });
    });
  }
}

export const wsManager = new WebSocketManager();
