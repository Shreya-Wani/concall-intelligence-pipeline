import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../config/env';
import * as schema from './schema';

const client = postgres(env.DATABASE_URL, { max: 10, connect_timeout: 5 });
export const db = drizzle(client, { schema });

export async function checkDbHealth(): Promise<boolean> {
  try {
    const result = await client`SELECT 1 as health`;
    return result.length > 0;
  } catch (error) {
    console.error('Database connection error:', error);
    return false;
  }
}
