import { useAuth } from '@clerk/expo';
import NetInfo from '@react-native-community/netinfo';
import { type ReactNode, useCallback, useEffect, useRef } from 'react';

import { runSync } from '@/lib/sync/engine';
import { clearLocalUserData } from '@/lib/sync/local-sessions';

type SyncProviderProps = {
  children: ReactNode;
};

const MIN_SYNC_INTERVAL_MS = 5_000;

export function SyncProvider({ children }: SyncProviderProps) {
  const { isSignedIn, userId, getToken } = useAuth();
  const lastUserIdRef = useRef<string | null>(null);
  const lastSyncAtRef = useRef(0);
  const syncingRef = useRef(false);

  const syncNow = useCallback(async () => {
    if (!isSignedIn || !userId) {
      return;
    }
    const now = Date.now();
    if (syncingRef.current || now - lastSyncAtRef.current < MIN_SYNC_INTERVAL_MS) {
      return;
    }

    syncingRef.current = true;
    try {
      const token = await getToken();
      if (!token) {
        return;
      }
      await runSync(userId, token);
      lastSyncAtRef.current = Date.now();
    } catch {
      // Non-fatal — teacher can keep recording offline
    } finally {
      syncingRef.current = false;
    }
  }, [getToken, isSignedIn, userId]);

  useEffect(() => {
    if (!isSignedIn) {
      if (lastUserIdRef.current) {
        void clearLocalUserData(lastUserIdRef.current);
        lastUserIdRef.current = null;
      }
      return;
    }

    if (!userId) {
      return;
    }

    const previousUserId = lastUserIdRef.current;
    if (previousUserId && previousUserId !== userId) {
      void clearLocalUserData(previousUserId);
    }
    lastUserIdRef.current = userId;
  }, [isSignedIn, userId]);

  useEffect(() => {
    if (!isSignedIn) {
      return;
    }

    void syncNow();

    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        void syncNow();
      }
    });

    return unsubscribe;
  }, [isSignedIn, syncNow]);

  return children;
}
