/** Retry only failures establishing a connection, when no SQL was sent. */
export function failedBeforeConnect(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as {
    syscall?: unknown;
    errors?: unknown[];
    cause?: unknown;
  };
  if (value.syscall === "connect" || value.syscall === "getaddrinfo")
    return true;
  if (Array.isArray(value.errors) && value.errors.length)
    return value.errors.every(failedBeforeConnect);
  return value.cause !== undefined && failedBeforeConnect(value.cause);
}
export async function fetchWithConnectRetry(
  ...args: Parameters<typeof fetch>
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetch(...args);
    } catch (error) {
      if (attempt >= 4 || !failedBeforeConnect(error)) throw error;
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(2000, 250 * 2 ** attempt)),
      );
    }
  }
}
