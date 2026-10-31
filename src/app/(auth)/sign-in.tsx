import { useSignIn } from '@clerk/expo';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  AuthCrossLink,
  SocialAuthButton,
} from '@/components/auth/social-auth-button';
import {
  AuthLabeledInput,
  AuthScreenShell,
} from '@/components/auth/auth-screen-shell';
import { VerificationCodeModal } from '@/components/auth/verification-code-modal';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/tokens';
import { useWarmUpBrowser } from '@/hooks/use-warm-up-browser';
import { useSocialAuth } from '@/hooks/use-social-auth';
import {
  resendSignInEmailOtp,
  startSignInEmailOtp,
  verifySignInEmailOtp,
} from '@/lib/auth-flow';
import { useRouter } from 'expo-router';

export default function SignInScreen(): React.ReactElement {
  useWarmUpBrowser();

  const router = useRouter();
  const { signIn, fetchStatus } = useSignIn();
  const {
    isSocialAuthAvailable,
    startGoogleAuth,
    isGoogleLoading,
    oauthError,
  } = useSocialAuth();

  const [emailAddress, setEmailAddress] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [verificationVisible, setVerificationVisible] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);

  const isBusy = fetchStatus === 'fetching' || isSendingCode || isVerifying;

  const handleContinueWithEmail = async (): Promise<void> => {
    setFormError(null);

    if (!emailAddress.trim()) {
      setFormError('Please enter your email address.');
      return;
    }

    setIsSendingCode(true);

    const error = await startSignInEmailOtp(signIn, emailAddress.trim());

    setIsSendingCode(false);

    if (error) {
      setFormError(error.message);
      return;
    }

    setVerificationError(null);
    setVerificationVisible(true);
  };

  const handleVerifyCode = async (code: string): Promise<void> => {
    if (isVerifying) {
      return;
    }

    setIsVerifying(true);
    setVerificationError(null);

    const error = await verifySignInEmailOtp(signIn, code, router);

    setIsVerifying(false);

    if (error) {
      setVerificationError(error.message);
      return;
    }

    setVerificationVisible(false);
  };

  const handleResendCode = async (): Promise<void> => {
    setVerificationError(null);
    const error = await resendSignInEmailOtp(signIn);

    if (error) {
      setVerificationError(error.message);
    }
  };

  return (
    <>
      <StatusBar style="dark" />
      <AuthScreenShell
        footer={
          <AuthCrossLink
            href="/sign-up"
            linkLabel="Sign up"
            prompt="Don't have an account?"
          />
        }
        subtitle="Continue with your email."
        title="Sign in to your account">
        <AuthLabeledInput
          autoCapitalize="none"
          keyboardType="email-address"
          label="EMAIL"
          placeholder="you@school.edu"
          required
          value={emailAddress}
          onChangeText={setEmailAddress}
        />

        {formError ? <Text style={styles.formError}>{formError}</Text> : null}
        {oauthError ? <Text style={styles.formError}>{oauthError}</Text> : null}

        <View style={styles.buttonStack}>
          {isSocialAuthAvailable ? (
            <>
              <SocialAuthButton
                disabled={isBusy}
                label="Continue with Google"
                loading={isGoogleLoading}
                variant="google"
                onPress={() => {
                  void startGoogleAuth();
                }}
              />

            </>
          ) : null}
          <SocialAuthButton
            disabled={isBusy}
            label="Continue with Email"
            loading={isSendingCode}
            variant="email"
            onPress={() => {
              void handleContinueWithEmail();
            }}
          />
        </View>

        <View nativeID="clerk-captcha" />
      </AuthScreenShell>

      <VerificationCodeModal
        email={emailAddress}
        error={verificationError}
        isVerifying={isVerifying}
        visible={verificationVisible}
        onComplete={(code) => {
          void handleVerifyCode(code);
        }}
        onDismiss={() => setVerificationVisible(false)}
        onResend={() => {
          void handleResendCode();
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  buttonStack: {
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  formError: {
    color: colors.destructive,
    fontSize: 13,
    marginBottom: spacing.sm,
  },
});
