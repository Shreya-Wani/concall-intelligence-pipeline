import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import companiesRouter from './api/companies';
import filingsRouter from './api/filings';
import healthRouter from './api/health';
import summariesRouter from './api/summaries';
import { env } from './config/env';

const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:') ||
        origin === env.FRONTEND_URL
      ) {
        return callback(null, true);
      }
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

app.use(express.json());

app.use('/api', healthRouter);
app.use('/api', companiesRouter);
app.use('/api', filingsRouter);
app.use('/api', summariesRouter);

app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'The requested resource was not found on this server.',
    },
  });
});

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
