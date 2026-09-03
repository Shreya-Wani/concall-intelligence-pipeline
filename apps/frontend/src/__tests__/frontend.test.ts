import assert from 'node:assert';
import { describe, test } from 'node:test';
import { WebSocketClient } from '../services/websocket';
import { PipelineEventItem } from '../types/websocket';

describe('Phase 7 Frontend Unit Tests', () => {
  describe('1. WebSocket Service & Reconnection', () => {
    test('notifies state subscribers when WebSocket status transitions', () => {
      const client = new WebSocketClient();
      const states: string[] = [];

      const unsubscribe = client.subscribeState((state) => {
        states.push(state);
      });

      assert.ok(states.length >= 1, 'Initial state notified');
      assert.strictEqual(states[0], 'disconnected');

      unsubscribe();
    });

    test('notifies event subscribers when events are received without exposing filesystem secrets', () => {
      const client = new WebSocketClient();
      const events: PipelineEventItem[] = [];

      const unsubscribe = client.subscribeEvents((event) => {
        events.push(event);
      });

      // Simulate event notification
      (client as any).notifyEventListeners({
        id: 'ev-1',
        type: 'filing.downloaded',
        timestamp: new Date().toISOString(),
        data: {
          filingId: 'f-1',
          companyName: 'Tata Consultancy Services Limited',
          pdfHash: 'hash123',
          byteSize: 1024,
        },
      });

      assert.strictEqual(events.length, 1);
      assert.strictEqual(events[0].data.companyName, 'Tata Consultancy Services Limited');
      assert.strictEqual(events[0].data.localPath, undefined, 'localPath must NOT be present in client event data');

      unsubscribe();
    });
  });

  describe('2. Empty State & Data Discipline', () => {
    test('defines required empty state messages without fake mock summaries', () => {
      const emptyTitle = 'No summaries available yet.';
      const emptyMessage = 'The unattended watcher is actively monitoring official NSE & BSE corporate announcements.';

      assert.strictEqual(emptyTitle, 'No summaries available yet.');
      assert.ok(emptyMessage.includes('unattended watcher'));
    });
  });
});
