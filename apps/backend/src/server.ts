import app from './app';
import { env } from './config/env';
import { checkDbHealth } from './db';
import { checkRedisHealth } from './redis';
import { orchestrator } from './pipeline/orchestrator';
import { initBridge } from './ws/bridge';
import { wsManager } from './ws/websocket.server';

async function bootstrap() {
  console.log(`🚀 Starting Concall Intelligence Backend in ${env.NODE_ENV} mode...`);

  const dbConnected = await checkDbHealth();
  if (dbConnected) {
    console.log('✅ Connected to PostgreSQL database.');
  } else {
    console.warn('⚠️ PostgreSQL connection check failed.');
    if (env.NODE_ENV === 'production') {
      console.error('❌ Refusing to start in production without a database. Exiting.');
      process.exit(1);
    }
  }

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

  wsManager.init(server, '/ws');
  initBridge();

  if (env.PIPELINE_ENABLED && dbConnected) {
    console.log('[SERVER] PIPELINE_ENABLED=true — starting watcher + orchestrator...');
    await orchestrator.start();
  } else {
    console.log('[SERVER] PIPELINE_ENABLED=false — pipeline orchestrator not started.');
    console.log('[SERVER]   Set PIPELINE_ENABLED=true in .env to activate the live watcher.');
  }

  const shutdown = async () => {
    console.log('Stopping server...');
    orchestrator.stop();
    await wsManager.close();
    server.close(() => { console.log('Server stopped.'); process.exit(0); });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
