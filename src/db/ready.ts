import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import migrations from '../../drizzle/expo/migrations';
import { getLocalDb } from './client';

let ready: Promise<void> | null = null;
/** One migration authority shared by recording and history. Native workers never migrate. */
export async function readyLocalDb() {
  const db = getLocalDb();
  ready ??= migrate(db, migrations).catch((error: unknown) => { ready = null; throw error; });
  await ready;
  return db;
}
