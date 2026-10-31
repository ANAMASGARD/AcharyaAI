import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { images } from '@/constants/images';
import { colors } from '@/theme/colors';
import { borderWidths, radii, spacing } from '@/theme/tokens';

type AuthScreenShellProps = Readonly<{
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}>;

export function AuthLabeledInput({
  label,
  required = false,
  value,
  onChangeText,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  placeholder,
  error,
}: Readonly<{
  label: string;
  required?: boolean;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'sentences' | 'words';
  placeholder?: string;
  error?: string;
}>): React.ReactElement {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>
        {label}
        {required ? <Text style={styles.requiredMark}> *</Text> : null}
      </Text>
      <View style={[styles.inputWrap, error ? styles.inputWrapError : null]}>
        {keyboardType === 'email-address' ? (
          <MaterialCommunityIcons
            color={colors.mutedForeground}
            name="email-outline"
            size={20}
            style={styles.inputIcon}
          />
        ) : null}
        <TextInput
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          keyboardType={keyboardType}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, keyboardType === 'email-address' ? styles.inputWithIcon : null]}
          value={value}
          onChangeText={onChangeText}
        />
      </View>
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

export function AuthScreenShell({
  title,
  subtitle,
  children,
  footer,
}: AuthScreenShellProps): React.ReactElement {
  const { height: screenHeight } = useWindowDimensions();

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>

          <View style={styles.form}>{children}</View>

          {footer ? <View style={styles.footer}>{footer}</View> : null}

          <View style={[styles.mascotWrap, { minHeight: screenHeight * 0.22 }]}>
            <Image
              accessibilityLabel="Acharya mascot"
              contentFit="contain"
              source={images.mascotAuth}
              style={styles.mascot}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fieldError: {
    color: colors.destructive,
    fontFamily: 'SpaceGrotesk-Regular',
    fontSize: 12,
    marginTop: spacing.xs,
  },
  fieldLabel: {
    color: colors.foreground,
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 12,
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  fieldWrap: {
    marginBottom: spacing.lg,
  },
  flex: {
    flex: 1,
  },
  footer: {
    marginTop: spacing.sm,
  },
  form: {
    marginTop: spacing.xl,
  },
  header: {
    paddingTop: spacing.lg,
  },
  input: {
    backgroundColor: colors.input,
    color: colors.foreground,
    flex: 1,
    fontFamily: 'SpaceGrotesk-Regular',
    fontSize: 16,
    minHeight: spacing.touch,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  inputIcon: {
    marginLeft: spacing.md,
  },
  inputWithIcon: {
    paddingLeft: spacing.sm,
  },
  inputWrap: {
    alignItems: 'center',
    backgroundColor: colors.input,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: borderWidths.default,
    flexDirection: 'row',
    minHeight: spacing.touch,
    overflow: 'hidden',
  },
  inputWrapError: {
    borderColor: colors.destructive,
  },
  mascot: {
    height: 220,
    width: '100%',
  },
  mascotWrap: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: spacing.lg,
    width: '100%',
  },
  requiredMark: {
    color: colors.destructive,
  },
  safeArea: {
    backgroundColor: colors.cream,
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  subtitle: {
    color: colors.mutedForeground,
    fontFamily: 'SpaceGrotesk-Regular',
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.sm,
  },
  title: {
    color: colors.foreground,
    fontFamily: 'ArchivoBlack-Regular',
    fontSize: 30,
    lineHeight: 36,
  },
});
