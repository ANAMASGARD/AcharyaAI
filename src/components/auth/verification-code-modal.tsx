import { type ComponentRef, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { colors } from '@/theme/colors';
import { borderWidths, radii, shadows, spacing } from '@/theme/tokens';

const CODE_LENGTH = 6;

type VerificationCodeModalProps = Readonly<{
  visible: boolean;
  email: string;
  error?: string | null;
  isVerifying?: boolean;
  onComplete: (code: string) => void;
  onDismiss: () => void;
  onResend: () => void;
}>;

export function VerificationCodeModal({
  visible,
  email,
  error,
  isVerifying = false,
  onComplete,
  onDismiss,
  onResend,
}: VerificationCodeModalProps): React.ReactElement {
  const [digits, setDigits] = useState<string[]>(Array.from({ length: CODE_LENGTH }, () => ''));
  const inputRefs = useRef<(ComponentRef<typeof TextInput> | null)[]>([]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const timer = setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 250);

    return () => clearTimeout(timer);
  }, [visible]);

  const handleDismiss = (): void => {
    setDigits(Array.from({ length: CODE_LENGTH }, () => ''));
    onDismiss();
  };

  const handleDigitChange = (index: number, value: string): void => {
    const sanitized = value.replace(/\D/g, '');

    if (sanitized.length === 0) {
      const nextDigits = [...digits];
      nextDigits[index] = '';
      setDigits(nextDigits);
      return;
    }

    if (sanitized.length > 1) {
      const pasted = sanitized.slice(0, CODE_LENGTH).split('');
      const nextDigits = Array.from({ length: CODE_LENGTH }, (_, digitIndex) => {
        return pasted[digitIndex] ?? '';
      });
      setDigits(nextDigits);

      const nextEmptyIndex = nextDigits.findIndex((digit) => digit === '');
      const focusIndex = nextEmptyIndex === -1 ? CODE_LENGTH - 1 : nextEmptyIndex;
      inputRefs.current[focusIndex]?.focus();

      if (nextDigits.every((digit) => digit !== '')) {
        onComplete(nextDigits.join(''));
      }
      return;
    }

    const nextDigits = [...digits];
    nextDigits[index] = sanitized[0] ?? '';
    setDigits(nextDigits);

    if (index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    if (nextDigits.every((digit) => digit !== '')) {
      onComplete(nextDigits.join(''));
    }
  };

  const handleKeyPress = (index: number, key: string): void => {
    if (key !== 'Backspace' || digits[index]) {
      return;
    }

    if (index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={handleDismiss}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}>
        <Pressable accessibilityRole="button" style={styles.backdrop} onPress={handleDismiss} />

        <View style={styles.card}>
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.message}>
            Enter the 6-digit code we sent to <Text style={styles.email}>{email}</Text>
          </Text>

          <View style={styles.codeRow}>
            {digits.map((digit, index) => (
              <TextInput
                key={`code-digit-${index}`}
                ref={(ref) => {
                  inputRefs.current[index] = ref;
                }}
                editable={!isVerifying}
                keyboardType="number-pad"
                maxLength={CODE_LENGTH}
                returnKeyType="done"
                selectTextOnFocus
                style={styles.codeInput}
                textContentType="oneTimeCode"
                value={digit}
                onChangeText={(value) => handleDigitChange(index, value)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(index, nativeEvent.key)}
              />
            ))}
          </View>

          {isVerifying ? (
            <ActivityIndicator color={colors.foreground} style={styles.loader} />
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable accessibilityRole="button" disabled={isVerifying} onPress={onResend}>
            <Text style={styles.resend}>Resend code</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: borderWidths.default,
    marginHorizontal: spacing.xl,
    padding: spacing.xl,
    ...shadows.lg,
  },
  codeInput: {
    backgroundColor: colors.input,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: borderWidths.default,
    color: colors.foreground,
    flex: 1,
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 20,
    height: 52,
    textAlign: 'center',
  },
  codeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  email: {
    color: colors.foreground,
    fontFamily: 'SpaceGrotesk-Bold',
  },
  error: {
    color: colors.destructive,
    fontFamily: 'SpaceGrotesk-Regular',
    fontSize: 13,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  loader: {
    marginTop: spacing.md,
  },
  message: {
    color: colors.mutedForeground,
    fontFamily: 'SpaceGrotesk-Regular',
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: spacing['2xl'],
  },
  resend: {
    color: colors.foreground,
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 14,
    marginTop: spacing.lg,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  title: {
    color: colors.foreground,
    fontFamily: 'ArchivoBlack-Regular',
    fontSize: 24,
    textAlign: 'center',
  },
});
