import { useLayoutEffect } from 'react';
import { useChatStore } from '@/store/chat-store';
import { useChatHistoryStore } from '@/store/chat-history-store';

/** Mounted inside the authenticated, account-keyed product tree. */
export function RagSessionLifecycle(): null {
  useLayoutEffect(() => {
    const reset = () => {
      useChatStore.getState().resetTabData();
      useChatHistoryStore.getState().reset();
    };
    reset();
    return reset;
  }, []);
  return null;
}
