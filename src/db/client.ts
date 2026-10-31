import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

import * as schema from '@/db/schema';

const DATABASE_NAME = 'acharya.db';

let cachedDb: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getLocalDb() {
  if (!cachedDb) {
    const expo = openDatabaseSync(DATABASE_NAME, { enableChangeListener: true });
    cachedDb = drizzle(expo, { schema });
  }
  return cachedDb;
}

export function closeLocalDbForTests() {
  cachedDb = null;
}
