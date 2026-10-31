import { useAuth } from '@clerk/expo';
import { useEffect, useRef } from 'react';

import { clearUiPreviewAccount } from '@/lib/ui-preview/account';

/** Reacts to both explicit sign-out and a session ending outside the profile screen. */
export function PreviewAuthCleanup(): null {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const previousOwner = useRef<string | null>(null);
  useEffect(() => {
    if (!isLoaded || (isSignedIn && !userId)) return;
    const nextOwner = isSignedIn ? userId ?? null : null;
    const previous = previousOwner.current;
    previousOwner.current = nextOwner;
    if (previous && previous !== nextOwner) {
      void clearUiPreviewAccount(previous).catch(() => {
        // A later sign-in can retry local cleanup; never fall back to cloud storage.
        console.warn('Acharya could not finish removing signed-out local drafts.');
      });
    }
  }, [isLoaded, isSignedIn, userId]);
  return null;
}
