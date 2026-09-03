import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load .env from root project directory or local backend directory
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config();

const envSchema = z.object({
  PORT: z.string().transform((val) => parseInt(val, 10)).default('3001'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().default('postgres://postgres:postgres@localhost:5432/concall_db'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),

  // Watcher Configuration
  NSE_POLL_INTERVAL_MS: z.string().transform((val) => parseInt(val, 10)).default('30000'),
  BSE_POLL_INTERVAL_MS: z.string().transform((val) => parseInt(val, 10)).default('30000'),
  HTTP_TIMEOUT_MS: z.string().transform((val) => parseInt(val, 10)).default('15000'),
  HTTP_MAX_RETRIES: z.string().transform((val) => parseInt(val, 10)).default('3'),
  HTTP_INITIAL_RETRY_DELAY_MS: z.string().transform((val) => parseInt(val, 10)).default('1000'),
  HTTP_MAX_RETRY_DELAY_MS: z.string().transform((val) => parseInt(val, 10)).default('10000'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables:', parsedEnv.error.format());
  throw new Error('Invalid environment variables');
}

export const env = parsedEnv.data;
