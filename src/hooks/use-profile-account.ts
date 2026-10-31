import { useAuth, useClerk, useUser } from '@clerk/expo';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useMemo, useState } from 'react';

import { useAccountActions } from '@/hooks/use-account-actions';

export function useProfileAccount(): Readonly<{
  signOut: () => void;
  openAccountPortal: () => Promise<void>;
  hasAccountPortal: boolean;
  isOpeningPortal: boolean;
  actionError: string | null;
}> {
  const clerk = useClerk();
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const accountActions = useAccountActions();
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);
  const portalUrl = useMemo(() => {
    if (!isLoaded || !isSignedIn) return null;
    try {
      const url = new URL(clerk.buildUserProfileUrl());
      return url.protocol === 'https:' ? url.toString() : null;
    } catch {
      return null;
    }
  }, [clerk, isLoaded, isSignedIn]);

  const openAccountPortal = useCallback(async (): Promise<void> => {
    setPortalError(null);
    if (!portalUrl) {
      setPortalError('Account settings are unavailable right now. Please try again later.');
      return;
    }
    setIsOpeningPortal(true);
    try {
      await WebBrowser.openBrowserAsync(portalUrl);
      await user?.reload();
    } catch {
      setPortalError('Could not open account settings. Please try again.');
    } finally {
      setIsOpeningPortal(false);
    }
  }, [portalUrl, user]);

  return {
    signOut: accountActions.signOut,
    openAccountPortal,
    hasAccountPortal: portalUrl !== null,
    isOpeningPortal,
    actionError: portalError ?? accountActions.actionError,
  };
}
