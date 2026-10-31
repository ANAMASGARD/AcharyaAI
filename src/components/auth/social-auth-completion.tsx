import type { SignUpResource } from '@clerk/shared/types';
import { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthLabeledInput } from '@/components/auth/auth-screen-shell';
import { SocialAuthButton } from '@/components/auth/social-auth-button';
import { VerificationCodeModal } from '@/components/auth/verification-code-modal';
import { colors } from '@/theme/colors';
import { borderWidths, radii, shadows, spacing } from '@/theme/tokens';

type Props = Readonly<{
  signUp: SignUpResource;
  onComplete: (signUp: SignUpResource) => Promise<void>;
  onDismiss: () => void;
}>;

/** Continue the existing OAuth signup; never replace it with a new email signup. */
export function SocialAuthCompletion({ signUp, onComplete, onDismiss }: Props): React.ReactElement {
  const resource = useRef(signUp);
  const busy = useRef(false);
  const [email, setEmail] = useState(signUp.emailAddress ?? '');
  const [codeSent, setCodeSent] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (operation: () => Promise<void>): Promise<void> => {
    if (busy.current) return;
    busy.current = true;
    setIsBusy(true);
    setError(null);
    try {
      await operation();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Could not verify your email. Please try again.');
    } finally {
      busy.current = false;
      setIsBusy(false);
    }
  };

  const sendCode = (): Promise<void> => run(async () => {
    if (!email.trim()) throw new Error('Please enter your email address.');
    if (!codeSent) resource.current = await resource.current.update({ emailAddress: email.trim() });
    resource.current = await resource.current.prepareEmailAddressVerification({ strategy: 'email_code' });
    setCodeSent(true);
  });

  const verifyCode = (code: string): Promise<void> => run(async () => {
    resource.current = await resource.current.attemptEmailAddressVerification({ code });
    await onComplete(resource.current);
  });

  return (
    <>
      <Modal transparent visible={!codeSent} animationType="slide" onRequestClose={() => { if (!busy.current) onDismiss(); }}>
        <View style={styles.overlay}>
          <View style={styles.card}>
            <Text style={styles.title}>Verify your email</Text>
            <Text style={styles.message}>Finish Microsoft sign-up by verifying an email you can access.</Text>
            <AuthLabeledInput label="EMAIL" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} required />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <SocialAuthButton label="Send verification code" disabled={isBusy} loading={isBusy} onPress={() => { void sendCode(); }} />
            <Pressable accessibilityRole="button" disabled={isBusy} onPress={onDismiss} style={styles.cancel}>
              <Text style={styles.message}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <VerificationCodeModal visible={codeSent} email={email.trim()} error={error} isVerifying={isBusy}
        onComplete={(code) => { void verifyCode(code); }}
        onResend={() => { void sendCode(); }}
        onDismiss={() => { if (!busy.current) onDismiss(); }} />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.45)' },
  card: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: borderWidths.default, borderRadius: radii.md, marginHorizontal: spacing.xl, padding: spacing.xl, gap: spacing.md, ...shadows.lg },
  title: { color: colors.foreground, fontFamily: 'SpaceGrotesk-Bold', fontSize: 22 },
  message: { color: colors.foreground, fontFamily: 'SpaceGrotesk-Regular', fontSize: 14 },
  error: { color: colors.destructive, fontSize: 13 },
  cancel: { minHeight: spacing.touch, alignItems: 'center', justifyContent: 'center' },
});
