import { useAuth, useSignUp } from '@clerk/expo';
import { Redirect, useRouter } from 'expo-router';
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
import { SocialAuthCompletion } from '@/components/auth/social-auth-completion';
import {
  resendSignUpEmailOtp,
  startSignUpEmailOtp,
  verifySignUpEmailOtp,
} from '@/lib/auth-flow';
import { SIGNED_IN_HOME } from '@/lib/routes';

export default function SignUpScreen(): React.ReactElement {
  useWarmUpBrowser();

  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { signUp, fetchStatus } = useSignUp();
  const {
    isSocialAuthAvailable,
    socialAuthUnavailableReason,
    startGoogleAuth,
    isGoogleLoading,
    isFacebookAuthAvailable,
    facebookAuthUnavailableReason,
    startFacebookAuth,
    isFacebookLoading,
    isMicrosoftAuthAvailable,
    microsoftAuthUnavailableReason,
    startMicrosoftAuth,
    isMicrosoftLoading,
    pendingMicrosoftSignUp,
    completeMicrosoftSignUp,
    dismissMicrosoftSignUp,
    oauthError,
  } = useSocialAuth();

  const [name, setName] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [verificationVisible, setVerificationVisible] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);

  const isBusy = fetchStatus === 'fetching' || isSendingCode || isVerifying || isGoogleLoading || isFacebookLoading || isMicrosoftLoading || Boolean(pendingMicrosoftSignUp);

  const handleContinueWithEmail = async (): Promise<void> => {
    setFormError(null);

    if (!name.trim()) {
      setFormError('Please enter your name.');
      return;
    }

    if (!emailAddress.trim()) {
      setFormError('Please enter your email address.');
      return;
    }

    setIsSendingCode(true);

    const error = await startSignUpEmailOtp(signUp, {
      emailAddress: emailAddress.trim(),
      firstName: name.trim(),
    });

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

    const error = await verifySignUpEmailOtp(signUp, code, router);

    setIsVerifying(false);

    if (error) {
      setVerificationError(error.message);
      return;
    }

    setVerificationVisible(false);
  };

  const handleResendCode = async (): Promise<void> => {
    setVerificationError(null);
    const error = await resendSignUpEmailOtp(signUp);

    if (error) {
      setVerificationError(error.message);
    }
  };

  if (isSignedIn) {
    return <Redirect href={SIGNED_IN_HOME} />;
  }

  return (
    <>
      <StatusBar style="dark" />
      <AuthScreenShell
        footer={
          <AuthCrossLink
            href="/sign-in"
            linkLabel="Sign in"
            prompt="Already have an account?"
          />
        }
        title="Create your account">
        <AuthLabeledInput
          autoCapitalize="words"
          label="NAME"
          placeholder="Your name"
          value={name}
          onChangeText={setName}
        />

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
          <SocialAuthButton
            disabled={isBusy || !isSocialAuthAvailable}
            label="Sign up with Google"
            loading={isGoogleLoading}
            variant="google"
            onPress={() => {
              void startGoogleAuth();
            }}
          />
          {!isSocialAuthAvailable ? (
            <Text style={styles.authHint}>{socialAuthUnavailableReason}</Text>
          ) : null}
          <SocialAuthButton
            disabled={isBusy || !isFacebookAuthAvailable}
            label="Sign up with Facebook"
            loading={isFacebookLoading}
            variant="facebook"
            onPress={() => {
              void startFacebookAuth();
            }}
          />
          {!isFacebookAuthAvailable ? (
            <Text style={styles.authHint}>{facebookAuthUnavailableReason}</Text>
          ) : null}
          <SocialAuthButton
            disabled={isBusy || !isMicrosoftAuthAvailable}
            label="Sign up with Microsoft"
            loading={isMicrosoftLoading}
            variant="microsoft"
            onPress={() => { void startMicrosoftAuth(); }}
          />
          {!isMicrosoftAuthAvailable ? (
            <Text style={styles.authHint}>{microsoftAuthUnavailableReason}</Text>
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

      {pendingMicrosoftSignUp ? (
        <SocialAuthCompletion signUp={pendingMicrosoftSignUp} onComplete={completeMicrosoftSignUp} onDismiss={dismissMicrosoftSignUp} />
      ) : null}
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
  authHint: {
    color: colors.foreground,
    fontSize: 13,
  },
  formError: {
    color: colors.destructive,
    fontSize: 13,
    marginBottom: spacing.sm,
  },
});
