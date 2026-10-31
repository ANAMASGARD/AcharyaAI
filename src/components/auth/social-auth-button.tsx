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
  variant?: 'google' | 'facebook' | 'email';
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
        (variant === 'google' || variant === 'facebook') && styles.googleButton,
        pressed && !isDisabled && styles.buttonPressed,
        isDisabled && styles.buttonDisabled,
        style,
      ]}>
      {variant === 'google' ? <GoogleIcon /> : null}
      {variant === 'facebook' ? <FacebookIcon /> : null}
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
