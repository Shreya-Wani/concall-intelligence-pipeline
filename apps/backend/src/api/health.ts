import { Request, Response, Router } from 'express';
import { checkDbHealth } from '../db';
import { checkRedisHealth } from '../redis';

const router = Router();

router.get('/health', async (_req: Request, res: Response) => {
  const isDbHealthy = await checkDbHealth();
  const isRedisHealthy = await checkRedisHealth();

  res.status(200).json({
    status: 'ok',
    service: 'concall-intelligence-backend',
    db: isDbHealthy ? 'connected' : 'disconnected',
    redis: isRedisHealthy ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

export default router;
