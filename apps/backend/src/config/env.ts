import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

const candidateEnvPaths = [
  path.resolve(__dirname, '../../../.env'),
  path.resolve(__dirname, '../../.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../../.env'),
];

for (const envPath of candidateEnvPaths) {
  dotenv.config({ path: envPath });
}

const envSchema = z.object({
  PORT: z.string().transform((val) => parseInt(val, 10)).default('3001'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().default('postgres://postgres@127.0.0.1:5433/concall_db'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),

  // LLM Provider — required; process exits at boot if missing in non-test environments
  LLM_PROVIDER: z.enum(['gemini', 'groq', 'openai', 'fallback']).default('fallback'),
  GEMINI_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default('openai/gpt-oss-120b'),

  // Pipeline feature flag — set to 'true' to start the watcher+orchestrator
  PIPELINE_ENABLED: z.string().transform((v) => v === 'true').default('false'),

  // Watcher Configuration
  NSE_POLL_INTERVAL_MS: z.string().transform((val) => parseInt(val, 10)).default('60000'),
  BSE_POLL_INTERVAL_MS: z.string().transform((val) => parseInt(val, 10)).default('60000'),
  HTTP_TIMEOUT_MS: z.string().transform((val) => parseInt(val, 10)).default('15000'),
  HTTP_MAX_RETRIES: z.string().transform((val) => parseInt(val, 10)).default('3'),
  HTTP_INITIAL_RETRY_DELAY_MS: z.string().transform((val) => parseInt(val, 10)).default('1000'),
  HTTP_MAX_RETRY_DELAY_MS: z.string().transform((val) => parseInt(val, 10)).default('10000'),
  GEMINI_MAP_DELAY_MS: z.string().transform((val) => parseInt(val, 10)).default('5000'),
  LLM_REQUEST_DELAY_MS: z.string().transform((val) => parseInt(val, 10)).default('5000'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('\u274c Invalid environment variables:', parsedEnv.error.format());
  throw new Error('Invalid environment variables');
}

export const env = parsedEnv.data;

// Guard: in non-test environments, 'fallback' provider produces mock data.
// Warn loudly so developers don't accidentally run on mocks in staging.
if (env.NODE_ENV !== 'test' && env.LLM_PROVIDER === 'fallback') {
  console.warn(
    '[ENV] WARNING: LLM_PROVIDER=fallback — the pipeline will return MOCK summaries.\n' +
    '  Set LLM_PROVIDER=groq (or gemini/openai) and supply the corresponding API key.'
  );
}

// Guard: if a real provider is chosen, ensure the API key is present.
if (env.LLM_PROVIDER !== 'fallback') {
  const keyMap: Record<string, string | undefined> = {
    groq: env.GROQ_API_KEY,
    gemini: env.GEMINI_API_KEY,
    openai: env.OPENAI_API_KEY,
  };
  if (!keyMap[env.LLM_PROVIDER]) {
    throw new Error(
      `LLM_PROVIDER is "${env.LLM_PROVIDER}" but the corresponding API key is not set. ` +
      `Set ${env.LLM_PROVIDER.toUpperCase()}_API_KEY in your .env file.`
    );
  }
}