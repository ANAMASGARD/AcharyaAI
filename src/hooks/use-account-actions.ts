import { cloudConfigured, deleteCloudAccount, stopReportSync } from '@/lib/reports/cloud';
import { clearProviderCredentials } from '@/lib/ai-keys/vault';
import { stopRecorderAccount } from '@/lib/recording/lifecycle';
import { deleteRecordingAccount } from '@/lib/recording/api';
import { useAuth, useClerk, useUser } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { confirmAction } from '@/lib/confirm-action';
import { clearUiPreviewAccount } from '@/lib/ui-preview/account';

export function useAccountActions(): Readonly<{
  signOut: () => void;
  deleteAccount: () => void;
  isSigningOut: boolean;
  isDeletingAccount: boolean;
  actionError: string | null;
}> {
  const router = useRouter();
  const { signOut: clerkSignOut } = useClerk();
  const { isSignedIn, userId, getToken } = useAuth();
  const { user } = useUser();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const performSignOut = useCallback(async (): Promise<void> => {
    setActionError(null);
    setIsSigningOut(true);
    try {
      if (userId) stopReportSync(userId);
      if (userId) await stopRecorderAccount(userId);
      if (userId) await clearProviderCredentials(userId);
      await clerkSignOut();
      try {
        if (userId) await clearUiPreviewAccount(userId);
      } finally {
        // Authentication has ended even if the device refuses a local cleanup.
        router.replace('/onboarding');
      }
    } catch (error: unknown) {
      setActionError(error instanceof Error ? error.message : 'Sign-out failed.');
    } finally {
      setIsSigningOut(false);
    }
  }, [clerkSignOut, router, userId]);

  const signOut = useCallback((): void => {
    void confirmAction('Sign out', 'Sign out and remove saved API keys and chat drafts? Class reports remain saved for this account on this device.', 'Sign out')
      .then((confirmed) => { if (confirmed) void performSignOut(); });
  }, [performSignOut]);

  const performDeleteAccount = useCallback(async (): Promise<void> => {
    if (!user || !isSignedIn) {
      return;
    }

    setActionError(null);
    setIsDeletingAccount(true);
    try {
      stopReportSync(user.id);
      await stopRecorderAccount(user.id);
      // Retain cleanup for an explicitly configured legacy backend; direct BYOK needs none.
      if (cloudConfigured()) await deleteCloudAccount(getToken);
      else if (process.env.EXPO_PUBLIC_API_URL) await deleteRecordingAccount(getToken);
      await clearProviderCredentials(user.id);
      if (!cloudConfigured()) await user.delete();
      try {
        await clearUiPreviewAccount(user.id, true);
      } finally {
        await clerkSignOut();
        router.replace('/onboarding');
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Could not delete account. Enable self-delete in the Clerk Dashboard.';
      setActionError(message);
    } finally {
      setIsDeletingAccount(false);
    }
  }, [clerkSignOut, getToken, isSignedIn, router, user]);

  const deleteAccount = useCallback((): void => {
    void confirmAction('Delete account', 'This permanently removes your Acharya account and its saved API keys, local drafts, files, and preferences. This cannot be undone.', 'Delete')
      .then((confirmed) => { if (confirmed) void performDeleteAccount(); });
  }, [performDeleteAccount]);

  return {
    signOut,
    deleteAccount,
    isSigningOut,
    isDeletingAccount,
    actionError,
  };
}
