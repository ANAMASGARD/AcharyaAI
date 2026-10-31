import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

import * as schema from '@/server/db/schema';

let cachedDb: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getServerDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not configured');
  }
  if (!cachedDb) {
    const sql = neon(url);
    cachedDb = drizzle(sql, { schema });
  }
  return cachedDb;
}
