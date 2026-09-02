import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import healthRouter from './api/health';
import { env } from './config/env';

const app = express();

// CORS configuration
app.use(
  cors({
    origin: [env.FRONTEND_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
  })
);

// JSON body parser
app.use(express.json());

// Routes
app.use('/api', healthRouter);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource was not found on this server.',
  });
});

// Centralized Error Handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred.',
  });
});

export default app;
