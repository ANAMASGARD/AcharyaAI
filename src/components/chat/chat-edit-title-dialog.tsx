import { useThemeColors, useThemeStyles } from '@/theme/use-theme';
import type { ThemeColors } from '@/theme/colors';
import { useKeyboardState } from "react-native-keyboard-controller";
import { borderWidths, radii, shadows, spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { AcharyaBlurView as BlurView } from "@/components/ui/acharya-blur";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  useWindowDimensions,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";


type Props = Readonly<{
  visible: boolean;
  initialTitle: string;
  isSaving?: boolean;
  onCancel: () => void;
  onSave: (title: string) => void;
}>;

function computeCardLift(
  keyboardHeight: number,
  cardHeight: number,
  bottomInset: number,
  windowHeight: number,
): number {
  if (keyboardHeight <= 0 || cardHeight <= 0) {
    return 0;
  }

  const centeredBottom = windowHeight / 2 + cardHeight / 2;
  const keyboardTop = windowHeight - keyboardHeight;
  const clearance = spacing.lg + bottomInset;
  const overlap = centeredBottom - keyboardTop + clearance;

  return overlap > 0 ? overlap : 0;
}

export function ChatEditTitleDialog(props: Props): React.ReactElement | null {
  return props.visible ? <ChatTitleForm {...props} /> : null;
}

function ChatTitleForm({
  visible,
  initialTitle,
  isSaving = false,
  onCancel,
  onSave,
}: Props): React.ReactElement | null {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);

  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const keyboardHeight = useKeyboardState((state) => visible ? state.height : 0);
  const [draftTitle, setDraftTitle] = useState(initialTitle);
  const [cardHeight, setCardHeight] = useState(0);

  const cardLift = useMemo(
    () => computeCardLift(keyboardHeight, cardHeight, insets.bottom, height),
    [cardHeight, height, insets.bottom, keyboardHeight],
  );

  const trimmed = draftTitle.trim();
  const canSave = trimmed.length > 0 && trimmed !== initialTitle.trim();

  const handleCancel = (): void => {
    Keyboard.dismiss();
    onCancel();
  };

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <BlurView
        intensity={Platform.OS === "android" ? 48 : 40}
        style={StyleSheet.absoluteFill}
        tint="dark"
      />
      <View style={styles.backdropTint} />
      <Pressable
        accessibilityLabel="Dismiss edit dialog"
        disabled={isSaving}
        onPress={handleCancel}
        style={styles.backdropPressable}
      />

      <View
        onLayout={(event) => {
          setCardHeight(event.nativeEvent.layout.height);
        }}
        style={[styles.card, { width: Math.min(width * 0.78, 288), transform: [{ translateY: -cardLift }] }]}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.title}>Rename chat</Text>
          <Pressable
            accessibilityLabel="Close"
            disabled={isSaving}
            onPress={handleCancel}
            style={({ pressed }) => [
              styles.closeButton,
              pressed && styles.pressed,
            ]}
          >
            <MaterialCommunityIcons
              color={colors.foreground}
              name="close"
              size={20}
            />
          </Pressable>
        </View>

        <Text style={styles.hint}>
          Give this conversation a name you will recognize in your history.
        </Text>

        <TextInput
          autoFocus
          editable={!isSaving}
          maxLength={80}
          onChangeText={setDraftTitle}
          placeholder="Chat name"
          placeholderTextColor={colors.mutedForeground}
          selectTextOnFocus
          style={styles.input}
          value={draftTitle}
        />

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            disabled={isSaving}
            onPress={handleCancel}
            style={({ pressed }) => [
              styles.cancelButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.cancelLabel}>Cancel</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={isSaving || !canSave}
            onPress={() => {
              Keyboard.dismiss();
              onSave(trimmed);
            }}
            style={({ pressed }) => [
              styles.saveButton,
              (isSaving || !canSave) && styles.disabled,
              pressed && canSave && !isSaving && styles.pressed,
            ]}
          >
            {isSaving ? (
              <ActivityIndicator color={colors.onAccent} size="small" />
            ) : (
              <Text style={[styles.saveLabel, { color: colors.onAccent }]}>Save</Text>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  backdropPressable: {
    ...StyleSheet.absoluteFill,
  },
  backdropTint: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(26, 26, 26, 0.28)",
  },
  cancelButton: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: borderWidths.default,
    flex: 1,
    justifyContent: "center",
    minHeight: 44,
    ...shadows.sm,
  },
  cancelLabel: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansBold,
    fontSize: 14,
  },
  card: {
    alignSelf: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.xl,
    borderWidth: borderWidths.default,
    padding: spacing.md,
    ...shadows.lg,
  },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  closeButton: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.sm,
    borderWidth: borderWidths.default,
    height: 32,
    justifyContent: "center",
    width: 32,
    ...shadows.sm,
  },
  disabled: {
    opacity: 0.5,
  },
  hint: {
    color: colors.mutedForeground,
    fontFamily: fontFamilies.sans,
    fontSize: 13,
    lineHeight: 18,
    marginTop: spacing.sm,
  },
  input: {
    backgroundColor: colors.cream,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: borderWidths.default,
    color: colors.foreground,
    fontFamily: fontFamilies.sans,
    fontSize: 15,
    marginTop: spacing.md,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ translateY: 1 }],
  },
  saveButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: borderWidths.default,
    flex: 1,
    justifyContent: "center",
    minHeight: 44,
    ...shadows.sm,
  },
  saveLabel: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansBold,
    fontSize: 14,
  },
  title: {
    color: colors.foreground,
    flex: 1,
    fontFamily: fontFamilies.head,
    fontSize: 18,
    lineHeight: 22,
  },
});
