import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { images } from '@/constants/images';
import { colors } from '@/theme/colors';
import { borderWidths, radii, shadows, spacing } from '@/theme/tokens';

type SocialAuthButtonProps = Readonly<{
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'google' | 'facebook' | 'microsoft' | 'email';
  style?: StyleProp<ViewStyle>;
}>;

function GoogleIcon(): React.ReactElement {
  return (
    <Image
      accessibilityLabel="Google"
      contentFit="contain"
      source={images.googleLogo}
      style={styles.googleIcon}
    />
  );
}

function FacebookIcon(): React.ReactElement {
  return (
    <MaterialCommunityIcons
      accessibilityLabel="Facebook"
      color="#1877F2"
      name="facebook"
      size={26}
    />
  );
}

function EmailIcon(): React.ReactElement {
  return (
    <MaterialCommunityIcons
      accessibilityLabel="Email"
      color={colors.foreground}
      name="email-outline"
      size={22}
    />
  );
}

function MicrosoftIcon(): React.ReactElement {
  return (
    <View accessibilityLabel="Microsoft" style={styles.microsoftIcon}>
      {['#F25022', '#7FBA00', '#00A4EF', '#FFB900'].map((color) => (
        <View key={color} style={[styles.microsoftTile, { backgroundColor: color }]} />
      ))}
    </View>
  );
}

export function SocialAuthButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  variant = 'email',
  style,
}: SocialAuthButtonProps): React.ReactElement {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant !== 'email' && styles.googleButton,
        pressed && !isDisabled && styles.buttonPressed,
        isDisabled && styles.buttonDisabled,
        style,
      ]}>
      {variant === 'google' ? <GoogleIcon /> : null}
      {variant === 'facebook' ? <FacebookIcon /> : null}
      {variant === 'microsoft' ? <MicrosoftIcon /> : null}
      {variant === 'email' ? <EmailIcon /> : null}
      <Text style={styles.buttonText}>{loading ? 'Please wait…' : label}</Text>
    </Pressable>
  );
}

type AuthCrossLinkProps = Readonly<{
  prompt: string;
  linkLabel: string;
  href: '/sign-in' | '/sign-up';
}>;

export function AuthCrossLink({ prompt, linkLabel, href }: AuthCrossLinkProps): React.ReactElement {
  return (
    <View style={styles.crossLinkWrap}>
      <Text style={styles.crossLinkPrompt}>
        {prompt}{' '}
        <Link href={href}>
          <Text style={styles.crossLinkAction}>{linkLabel}</Text>
        </Link>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  microsoftIcon: { width: 24, height: 24, flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  microsoftTile: { width: 11, height: 11 },
  button: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: borderWidths.default,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: spacing.touch,
    paddingHorizontal: spacing.lg,
    ...shadows.sm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  googleButton: {
    backgroundColor: colors.background,
  },
  buttonPressed: {
    transform: [{ translateX: 2 }, { translateY: 2 }],
    ...shadows.xs,
  },
  buttonText: {
    color: colors.primaryForeground,
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 16,
    fontWeight: '700',
  },
  crossLinkWrap: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  crossLinkPrompt: {
    color: colors.foreground,
    fontFamily: 'SpaceGrotesk-Regular',
    fontSize: 14,
    textAlign: 'center',
  },
  crossLinkAction: {
    color: colors.foreground,
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  googleIcon: {
    height: 24,
    width: 24,
  },
});
