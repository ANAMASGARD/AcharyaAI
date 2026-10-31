export type AsyncStatus = "idle" | "loading" | "success" | "error";

export type GetToken = () => Promise<string | null>;

export type FetchOptions = Readonly<{
  silent?: boolean;
  force?: boolean;
}>;

export const TAB_DATA_STALE_MS = 60_000;

export function isStale(
  lastFetchedAt: number | null,
  staleMs: number = TAB_DATA_STALE_MS,
): boolean {
  if (lastFetchedAt === null) {
    return true;
  }

  return Date.now() - lastFetchedAt >= staleMs;
}
