import { type ReactNode } from 'react';

/** Sync runs on native with SQLite; web uses cloud APIs only when hosted. */
export function SyncProvider({ children }: { children: ReactNode }) {
  return children;
}
