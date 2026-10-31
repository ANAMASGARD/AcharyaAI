/** Retry an expired cached session once with a fresh Clerk token. Never bypass auth. */
export async function withFreshSession(
  getToken: (options?: { skipCache?: boolean }) => Promise<string | null>,
  send: (token: string) => Promise<Response>,
  ensureCurrent: () => void,
): Promise<Response> {
  const token = await getToken();
  ensureCurrent();
  if (!token) throw new Error("Please sign in to continue.");
  let response = await send(token);
  if (response.status === 401) {
    await response.body?.cancel();
    const refreshed = await getToken({ skipCache: true });
    ensureCurrent();
    if (!refreshed) throw new Error("Your session ended. Please sign in again.");
    response = await send(refreshed);
  }
  ensureCurrent();
  return response;
}
