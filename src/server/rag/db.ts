import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { RagError } from "./contracts";
export function sqlClient() {
  const url = (process.env.RAG_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim());
  if (!url)
    throw new RagError("Neon is not configured: set server DATABASE_URL.", 503);
  return neon(url);
}
export function database() {
  return drizzle(sqlClient());
}
export async function query<T>(
  statement: string,
  parameters: unknown[] = [],
): Promise<T[]> {
  return (await sqlClient().query(statement, parameters)) as T[];
}
