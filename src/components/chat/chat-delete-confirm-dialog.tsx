import { colors } from "@/theme/colors";
import { borderWidths, radii, shadows, spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { AcharyaBlurView as BlurView } from "@/components/ui/acharya-blur";
import {
  ActivityIndicator,
  useWindowDimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";


type Props = Readonly<{
  visible: boolean;
  chatTitle?: string;
  isDeleting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}>;

export function ChatDeleteConfirmDialog({
  visible,
  chatTitle,
  isDeleting = false,
  onCancel,
  onConfirm,
}: Props): React.ReactElement | null {
  const { width } = useWindowDimensions();
  if (!visible) {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <BlurView
        intensity={Platform.OS === "android" ? 48 : 40}
        style={StyleSheet.absoluteFill}
        tint="dark"
      />
      <View style={styles.backdropTint} />
      <Pressable
        accessibilityLabel="Dismiss delete dialog"
        disabled={isDeleting}
        onPress={onCancel}
        style={styles.backdropPressable}
      />

      <View style={[styles.card, { width: Math.min(width * 0.78, 288) }]}>
        <View style={styles.cardHeader}>
          <Text style={styles.title}>Delete chat?</Text>
          <Pressable
            accessibilityLabel="Close"
            disabled={isDeleting}
            onPress={onCancel}
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

        <Text style={styles.body}>
          This delete is irreversible. You will lose all messages in this chat
          permanently.
          {chatTitle ? `\n\n“${chatTitle}”` : ""}
        </Text>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            disabled={isDeleting}
            onPress={onCancel}
            style={({ pressed }) => [
              styles.cancelButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.cancelLabel}>Cancel</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={isDeleting}
            onPress={onConfirm}
            style={({ pressed }) => [
              styles.deleteButton,
              pressed && styles.pressed,
            ]}
          >
            {isDeleting ? (
              <ActivityIndicator color={colors.foreground} size="small" />
            ) : (
              <Text style={styles.deleteLabel}>Delete</Text>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  body: {
    color: colors.foreground,
    fontFamily: fontFamilies.sans,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.sm,
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
  deleteButton: {
    alignItems: "center",
    backgroundColor: colors.coral,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: borderWidths.default,
    flex: 1,
    justifyContent: "center",
    minHeight: 44,
    ...shadows.sm,
  },
  deleteLabel: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansBold,
    fontSize: 14,
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
  title: {
    color: colors.foreground,
    flex: 1,
    fontFamily: fontFamilies.head,
    fontSize: 18,
    lineHeight: 22,
  },
});
