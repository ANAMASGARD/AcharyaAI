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
  const { isSignedIn, userId } = useAuth();
  const { user } = useUser();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const performSignOut = useCallback(async (): Promise<void> => {
    setActionError(null);
    setIsSigningOut(true);
    try {
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
    void confirmAction('Sign out', 'Sign out of Acharya and remove local drafts and copied files? Your preferences are kept for this account.', 'Sign out')
      .then((confirmed) => { if (confirmed) void performSignOut(); });
  }, [performSignOut]);

  const performDeleteAccount = useCallback(async (): Promise<void> => {
    if (!user || !isSignedIn) {
      return;
    }

    setActionError(null);
    setIsDeletingAccount(true);
    try {
      await user.delete();
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
  }, [clerkSignOut, isSignedIn, router, user]);

  const deleteAccount = useCallback((): void => {
    void confirmAction('Delete account', 'This permanently removes your Acharya account and its local drafts, files, and preferences. This cannot be undone.', 'Delete')
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
