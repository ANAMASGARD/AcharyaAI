/** Orders writes and prevents callbacks from a signed-out account recreating deleted drafts. */
export class PreviewSessionEndedError extends Error {
  constructor() {
    super('This preview session has ended.');
    this.name = 'PreviewSessionEndedError';
  }
}

export function createPreviewQueue() {
  let active = true;
  let tail: Promise<unknown> = Promise.resolve();

  return {
    run<T>(operation: () => Promise<T>): Promise<T> {
      if (!active) return Promise.reject(new PreviewSessionEndedError());
      const next = tail.then(operation);
      tail = next.catch(() => undefined);
      return next;
    },
    async close(): Promise<void> {
      active = false;
      await tail;
    },
    flush(): Promise<unknown> {
      return tail;
    },
  };
}

/** All sessions for an account finish before its files and drafts are removed. */
export function createPreviewLifecycle(clear: (owner: string, includePreferences: boolean) => Promise<void>) {
  const sessions = new Map<string, Set<ReturnType<typeof createPreviewQueue>>>();
  const cleanups = new Map<string, Promise<void>>();
  return {
    createSession(owner: string) {
      const queue = createPreviewQueue();
      const pendingCleanup = cleanups.get(owner);
      let cleanupRecovered = false;
      async function waitForCleanup() {
        if (!pendingCleanup || cleanupRecovered) return;
        try { await pendingCleanup; } catch {
          // Retry a failed cleanup before exposing drafts to a new session.
          await clear(owner, false);
        }
        cleanupRecovered = true;
        if (cleanups.get(owner) === pendingCleanup) cleanups.delete(owner);
      }
      const accountSessions = sessions.get(owner) ?? new Set();
      sessions.set(owner, accountSessions);
      accountSessions.add(queue);
      return {
        run<T>(operation: () => Promise<T>): Promise<T> {
          return queue.run(async () => { await waitForCleanup(); return operation(); });
        },
        flush: queue.flush,
        async close() { await queue.close(); accountSessions.delete(queue); },
      };
    },
    clear(owner: string, includePreferences = false): Promise<void> {
      const existing = cleanups.get(owner) ?? Promise.resolve();
      const accountSessions = [...(sessions.get(owner) ?? [])];
      sessions.delete(owner);
      const closing = Promise.all(accountSessions.map((session) => session.close()));
      const cleanup = existing.catch(() => undefined).then(async () => {
        await closing;
        await clear(owner, includePreferences);
      });
      cleanups.set(owner, cleanup);
      void cleanup.then(() => { if (cleanups.get(owner) === cleanup) cleanups.delete(owner); }, () => undefined);
      return cleanup;
    },
  };
}
