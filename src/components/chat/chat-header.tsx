import { images } from "@/constants/images";
import { colors } from "@/theme/colors";
import { borderWidths, radii, spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = Readonly<{
  onOpenHistory: () => void;
}>;

export function ChatHeader({ onOpenHistory }: Props): React.ReactElement {
  const router = useRouter();

  return (
    <View style={styles.header}>
      <Pressable
        accessibilityLabel="Chat history"
        onPress={onOpenHistory}
        style={({ pressed }) => [styles.menuButton, pressed && styles.pressed]}
      >
        <MaterialCommunityIcons color={colors.foreground} name="menu" size={22} />
      </Pressable>

      <View style={styles.brandRow}>
        <Image
          accessibilityLabel="Acharya"
          contentFit="contain"
          source={images.mascotLogo}
          style={styles.logo}
        />
        <Text numberOfLines={1} style={styles.title}>
          Acharya
        </Text>
      </View>

      <Pressable
        accessibilityLabel="Upload notes"
        onPress={() => {
          router.push("/notes/upload");
        }}
        style={({ pressed }) => [
          styles.uploadButton,
          pressed && styles.pressed,
        ]}
      >
        <MaterialCommunityIcons
          color={colors.destructiveForeground}
          name="book-open-page-variant"
          size={16}
        />
        <Text style={styles.uploadLabel}>Upload</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  brandRow: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderBottomColor: colors.border,
    borderBottomWidth: borderWidths.default,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 56,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  logo: {
    height: 44,
    width: 44,
  },
  menuButton: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: borderWidths.default,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  pressed: {
    opacity: 0.85,
  },
  title: {
    color: colors.foreground,
    fontFamily: fontFamilies.head,
    fontSize: 22,
    lineHeight: 26,
  },
  uploadButton: {
    alignItems: "center",
    backgroundColor: colors.destructive,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: borderWidths.thin,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  uploadLabel: {
    color: colors.destructiveForeground,
    fontFamily: fontFamilies.sansBold,
    fontSize: 14,
  },
});
