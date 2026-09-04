import http from 'http';
import { WebSocket, WebSocketServer } from 'ws';

export class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private pingInterval: NodeJS.Timeout | null = null;
  private connectHandlers: Array<(ws: WebSocket) => void> = [];

  public init(server: http.Server, path: string = '/ws'): void {
    if (this.wss) return;

    this.wss = new WebSocketServer({ server, path });

    this.wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
      console.log(`[WS] Client connected from ${req.socket.remoteAddress}`);
      this.clients.add(ws);

      ws.send(
        JSON.stringify({
          type: 'connection.established',
          timestamp: new Date().toISOString(),
          data: { message: 'Connected to Concall Intelligence WebSocket Stream' },
        })
      );

      for (const handler of this.connectHandlers) {
        try { handler(ws); } catch (_) {}
      }

      ws.on('pong', () => { (ws as any).isAlive = true; });
      ws.on('close', () => { this.clients.delete(ws); console.log('[WS] Client disconnected'); });
      ws.on('error', (err) => { console.warn('[WS] Client error:', err.message); this.clients.delete(ws); });
    });

    this.pingInterval = setInterval(() => {
      if (!this.wss) return;
      this.clients.forEach((ws) => {
        if ((ws as any).isAlive === false) { this.clients.delete(ws); return ws.terminate(); }
        (ws as any).isAlive = false;
        ws.ping();
      });
    }, 30000);
    this.pingInterval.unref();

    this.wss.on('close', () => {
      if (this.pingInterval) { clearInterval(this.pingInterval); this.pingInterval = null; }
    });

    console.log(`[WS] WebSocket server initialized on path ${path}`);
  }

  public getConnectedClientCount(): number {
    return this.clients.size;
  }

  public onConnect(handler: (ws: WebSocket) => void): void {
    this.connectHandlers.push(handler);
  }

  public broadcastRaw(type: string, data: unknown): void {
    const payload = JSON.stringify({ type, timestamp: new Date().toISOString(), data });
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try { client.send(payload); } catch (err: any) {
          console.warn('[WS] Error sending to client:', err.message);
          this.clients.delete(client);
        }
      }
    });
  }

  public broadcast(type: string, data: unknown): void {
    this.broadcastRaw(type, data);
  }

  public close(): Promise<void> {
    return new Promise((resolve) => {
      if (this.pingInterval) { clearInterval(this.pingInterval); this.pingInterval = null; }
      if (!this.wss) return resolve();
      this.wss.close(() => { this.wss = null; this.clients.clear(); resolve(); });
    });
  }
}

export const wsManager = new WebSocketManager();
