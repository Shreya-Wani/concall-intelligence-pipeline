import assert from 'node:assert';
import http from 'http';
import { describe, test, before, after } from 'node:test';
import { WebSocket } from 'ws';
import app from '../../app';
import { queryClient } from '../../db';
import { wsManager } from '../../ws/websocket.server';

describe('Phase 6 REST API & WebSocket Unit Tests', () => {
  let server: http.Server;
  let baseUrl: string;
  let wsUrl: string;

  before(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as any;
        const port = address.port;
        baseUrl = `http://localhost:${port}`;
        wsUrl = `ws://localhost:${port}/ws`;
        wsManager.init(server, '/ws');
        resolve();
      });
    });
  });

  after(async () => {
    await wsManager.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await queryClient.end().catch(() => {});
  });

  describe('1. REST API Endpoints', () => {
    test('GET /api/companies returns HTTP 200 with array of seeded companies', async () => {
      const res = await fetch(`${baseUrl}/api/companies`);
      assert.strictEqual(res.status, 200);

      const json = await res.json();
      assert.ok(Array.isArray(json.data));
      // Seeded companies exist in PostgreSQL
      assert.ok(json.data.length >= 3);
      assert.ok(json.data.some((c: any) => c.nseSymbol === 'TCS'));
    });

    test('GET /api/filings/:id returns 404 for unknown or invalid UUID', async () => {
      const res = await fetch(`${baseUrl}/api/filings/00000000-0000-0000-0000-000000000000`);
      assert.strictEqual(res.status, 404);

      const json = await res.json();
      assert.strictEqual(json.error.code, 'NOT_FOUND');
      assert.strictEqual(json.error.message, 'Filing not found');
    });

    test('GET /api/summaries returns HTTP 200 with items array and pagination metadata', async () => {
      const res = await fetch(`${baseUrl}/api/summaries?limit=10&offset=0`);
      assert.strictEqual(res.status, 200);

      const json = await res.json();
      assert.ok(Array.isArray(json.items));
      assert.strictEqual(json.pagination.limit, 10);
      assert.strictEqual(json.pagination.offset, 0);
      assert.ok(typeof json.pagination.total === 'number');
    });

    test('GET /api/summaries returns 400 for invalid query limit', async () => {
      const res = await fetch(`${baseUrl}/api/summaries?limit=invalid`);
      assert.strictEqual(res.status, 400);

      const json = await res.json();
      assert.strictEqual(json.error.code, 'BAD_REQUEST');
    });

    test('GET /api/summaries/:id returns 404 for non-existent summary ID', async () => {
      const res = await fetch(`${baseUrl}/api/summaries/00000000-0000-0000-0000-000000000000`);
      assert.strictEqual(res.status, 404);

      const json = await res.json();
      assert.strictEqual(json.error.code, 'NOT_FOUND');
    });
  });

  describe('2. WebSocket Connection & Event Broadcasting', () => {
    test('accepts WebSocket client connection and broadcasts typed events without sensitive local paths', async () => {
      const client = new WebSocket(wsUrl);

      await new Promise<void>((resolve, reject) => {
        let receivedWelcome = false;

        client.on('open', () => {
          wsManager.broadcast('filing.downloaded', {
            filingId: 'test-filing-123',
            companyId: 'test-company-123',
            companyName: 'Tata Consultancy Services Limited',
            source: 'NSE',
            announcementId: 'NSE-ANN-101',
            pdfHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
            byteSize: 1048576,
          });
        });

        client.on('message', (data) => {
          try {
            const payload = JSON.parse(data.toString());
            if (payload.type === 'connection.established') {
              receivedWelcome = true;
              return;
            }

            if (payload.type === 'filing.downloaded') {
              assert.ok(receivedWelcome);
              assert.strictEqual(payload.data.filingId, 'test-filing-123');
              assert.strictEqual(payload.data.companyName, 'Tata Consultancy Services Limited');
              assert.strictEqual(payload.data.pdfHash, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
              assert.strictEqual(payload.data.localPath, undefined, 'Local filesystem path must NOT be exposed in WebSocket event');

              client.close();
              resolve();
            }
          } catch (err) {
            client.close();
            reject(err);
          }
        });

        client.on('error', reject);
      });
    });
  });
});
