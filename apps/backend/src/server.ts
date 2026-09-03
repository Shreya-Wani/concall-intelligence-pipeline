import app from './app';
import { env } from './config/env';
import { checkDbHealth } from './db';
import { checkRedisHealth } from './redis';
import { wsManager } from './ws/websocket.server';

async function bootstrap() {
  console.log(`🚀 Starting Concall Intelligence Backend in ${env.NODE_ENV} mode...`);

  // Verify DB connection
  const dbConnected = await checkDbHealth();
  if (dbConnected) {
    console.log('✅ Connected to PostgreSQL database.');
  } else {
    console.warn('⚠️ PostgreSQL connection check failed.');
  }

  // Verify Redis connection
  const redisConnected = await checkRedisHealth();
  if (redisConnected) {
    console.log('✅ Connected to Redis instance.');
  } else {
    console.warn('⚠️ Redis connection check failed.');
  }

  const server = app.listen(env.PORT, () => {
    console.log(`📡 Backend server listening on http://localhost:${env.PORT}`);
    console.log(`🩺 Health check endpoint available at http://localhost:${env.PORT}/api/health`);
  });

  // Attach WebSocket server to HTTP server at path /ws
  wsManager.init(server, '/ws');

  const shutdown = async () => {
    console.log('Stopping server...');
    await wsManager.close();
    server.close(() => {
      console.log('Server stopped.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
