import { type ReactNode } from 'react';

/** Web static export does not run Expo SQLite; local DB is native-only. */
export function DatabaseProvider({ children }: { children: ReactNode }) {
  return children;
}
