import { BusEventMap, BusEventType, bus } from '../pipeline/bus';
import { wsManager } from './websocket.server';

/**
 * WS Bridge — the single subscriber that forwards pipeline bus events
 * to all connected WebSocket clients.
 *
 * Also keeps a rolling buffer of the last 100 events and replays them
 * to each new client so a browser opened mid-run is not staring at an
 * empty activity panel.
 */

const REPLAY_BUFFER_SIZE = 100;

interface ReplayEntry {
  type: string;
  timestamp: string;
  data: unknown;
}

const replayBuffer: ReplayEntry[] = [];

function pushReplay(type: string, data: unknown): void {
  replayBuffer.push({ type, timestamp: new Date().toISOString(), data });
  if (replayBuffer.length > REPLAY_BUFFER_SIZE) {
    replayBuffer.shift();
  }
}

function forwardEvent<K extends BusEventType>(type: K) {
  return (payload: BusEventMap[K]) => {
    pushReplay(type, payload);
    wsManager.broadcastRaw(type, payload);
  };
}

/** Call once after wsManager is initialised. */
export function initBridge(): void {
  bus.on('filing.discovered', forwardEvent('filing.discovered'));
  bus.on('filing.downloaded', forwardEvent('filing.downloaded'));
  bus.on('transcript.extracted', forwardEvent('transcript.extracted'));
  bus.on('summary.completed', forwardEvent('summary.completed'));
  bus.on('pipeline.error', forwardEvent('pipeline.error'));
  bus.on('watcher.heartbeat', forwardEvent('watcher.heartbeat'));

  // Replay buffer on new connection
  wsManager.onConnect((ws) => {
    const snapshot = [...replayBuffer];
    for (const entry of snapshot) {
      try {
        ws.send(JSON.stringify(entry));
      } catch (_) {}
    }
  });

  console.log('[BRIDGE] WS bridge initialised — forwarding bus events to WebSocket clients.');
}

export { replayBuffer };
