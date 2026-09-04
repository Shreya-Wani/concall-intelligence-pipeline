import net from 'net';
import { env } from '../config/env';

export const redis = {
  status: 'ready',
  ping: async () => 'PONG',
  quit: async () => {},
  disconnect: () => {},
  on: () => {},
  connect: async () => {},
} as any;

export async function checkRedisHealth(): Promise<boolean> {

  return new Promise((resolve) => {
    try {
      const urlStr = env.REDIS_URL.startsWith('redis://')
        ? env.REDIS_URL.replace('redis://', 'http://')
        : `http://${env.REDIS_URL}`;
      const parsed = new URL(urlStr);
      const port = parseInt(parsed.port || '6379', 10);
      const host = parsed.hostname || '127.0.0.1';

      const socket = net.createConnection({ port, host, timeout: 2000 }, () => {
        socket.write('*1\r\n$4\r\nPING\r\n');
      });

      socket.on('data', (data) => {
        const response = data.toString();
        socket.destroy();
        resolve(response.includes('PONG') || response.includes('+OK'));
      });

      socket.on('error', () => {
        socket.destroy();
        resolve(false);
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
    } catch (_err) {
      resolve(false);
    }
  });
}

