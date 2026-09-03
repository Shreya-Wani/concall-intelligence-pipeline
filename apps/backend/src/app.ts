import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import companiesRouter from './api/companies';
import filingsRouter from './api/filings';
import healthRouter from './api/health';
import summariesRouter from './api/summaries';
import { env } from './config/env';

const app = express();

// CORS configuration (restricting origin to FRONTEND_URL and local Vite dev ports)
app.use(
  cors({
    origin: [env.FRONTEND_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
  })
);

// JSON body parser
app.use(express.json());

// API Routers
app.use('/api', healthRouter);
app.use('/api', companiesRouter);
app.use('/api', filingsRouter);
app.use('/api', summariesRouter);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'The requested resource was not found on this server.',
    },
  });
});

// Centralized Error Handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[SERVER ERROR]', err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: env.NODE_ENV === 'development' ? err.message : 'An unexpected server error occurred.',
    },
  });
});

export default app;
