import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../config/env';
import * as relations from './relations';
import * as schema from './schema';

export const queryClient = postgres(env.DATABASE_URL, {
  max: 10,
  connect_timeout: 5,
});

export const db = drizzle(queryClient, { schema: { ...schema, ...relations } });

export async function checkDbHealth(): Promise<boolean> {
  try {
    const result = await queryClient`SELECT 1 as health`;
    return result.length > 0;
  } catch (error) {
    return false;
  }
}

export { relations, schema };
