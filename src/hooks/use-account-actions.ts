import { useAuth, useClerk, useUser } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

export function useAccountActions(): Readonly<{
  signOut: () => void;
  deleteAccount: () => void;
  isSigningOut: boolean;
  isDeletingAccount: boolean;
  actionError: string | null;
}> {
  const router = useRouter();
  const { signOut: clerkSignOut } = useClerk();
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const performSignOut = useCallback(async (): Promise<void> => {
    setActionError(null);
    setIsSigningOut(true);
    try {
      await clerkSignOut();
      router.replace('/sign-in');
    } catch (error: unknown) {
      setActionError(error instanceof Error ? error.message : 'Sign-out failed.');
    } finally {
      setIsSigningOut(false);
    }
  }, [clerkSignOut, router]);

  const signOut = useCallback((): void => {
    Alert.alert('Sign out', 'Are you sure you want to sign out of Acharya?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          void performSignOut();
        },
      },
    ]);
  }, [performSignOut]);

  const performDeleteAccount = useCallback(async (): Promise<void> => {
    if (!user || !isSignedIn) {
      return;
    }

    setActionError(null);
    setIsDeletingAccount(true);
    try {
      await user.delete();
      await clerkSignOut();
      router.replace('/sign-in');
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
    Alert.alert(
      'Delete account',
      'This permanently removes your Acharya account and cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void performDeleteAccount();
          },
        },
      ],
    );
  }, [performDeleteAccount]);

  return {
    signOut,
    deleteAccount,
    isSigningOut,
    isDeletingAccount,
    actionError,
  };
}
