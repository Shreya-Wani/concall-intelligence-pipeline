import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Centralized dotenv loader checking workspace root and backend directory
const candidateEnvPaths = [
  path.resolve(__dirname, '../../../.env'),        // Workspace root (d:/concall-intelligence-pipeline/.env)
  path.resolve(__dirname, '../../.env'),           // Backend root (apps/backend/.env)
  path.resolve(process.cwd(), '.env'),             // Current Working Directory .env
  path.resolve(process.cwd(), '../../.env'),       // CWD parent .env
];

for (const envPath of candidateEnvPaths) {
  dotenv.config({ path: envPath });
}

const envSchema = z.object({
  PORT: z.string().transform((val) => parseInt(val, 10)).default('3001'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().default('postgres://postgres:postgres@localhost:5432/concall_db'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),

  // LLM Provider Configuration
  LLM_PROVIDER: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default('openai/gpt-oss-120b'),

  // Watcher Configuration
  NSE_POLL_INTERVAL_MS: z.string().transform((val) => parseInt(val, 10)).default('30000'),
  BSE_POLL_INTERVAL_MS: z.string().transform((val) => parseInt(val, 10)).default('30000'),
  HTTP_TIMEOUT_MS: z.string().transform((val) => parseInt(val, 10)).default('15000'),
  HTTP_MAX_RETRIES: z.string().transform((val) => parseInt(val, 10)).default('3'),
  HTTP_INITIAL_RETRY_DELAY_MS: z.string().transform((val) => parseInt(val, 10)).default('1000'),
  HTTP_MAX_RETRY_DELAY_MS: z.string().transform((val) => parseInt(val, 10)).default('10000'),
  GEMINI_MAP_DELAY_MS: z.string().transform((val) => parseInt(val, 10)).default('5000'),
  LLM_REQUEST_DELAY_MS: z.string().transform((val) => parseInt(val, 10)).default('5000'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables:', parsedEnv.error.format());
  throw new Error('Invalid environment variables');
}

export const env = parsedEnv.data;
