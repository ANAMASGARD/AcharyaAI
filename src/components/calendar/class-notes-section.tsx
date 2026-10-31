import { colors } from "@/theme/colors";
import { borderWidths, radii, spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = Readonly<{
  notes: string | null;
}>;

export function ClassNotesSection({ notes }: Props): React.ReactElement {
  const handleCopy = async (): Promise<void> => {
    if (!notes) {
      return;
    }

    await Clipboard.setStringAsync(notes);
  };

  if (!notes) {
    return (
      <View style={styles.emptyBox}>
        <Text style={styles.emptyTitle}>Class Notes</Text>
        <Text style={styles.emptyBody}>
          Notes not available for this session. Record and analyze a new class to
          generate student notes.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Class Notes</Text>
        <Pressable
          accessibilityLabel="Copy notes"
          accessibilityRole="button"
          onPress={() => {
            void handleCopy();
          }}
          style={styles.copyButton}
        >
          <MaterialCommunityIcons
            color={colors.foreground}
            name="content-copy"
            size={20}
          />
        </Pressable>
      </View>
      <Text style={styles.body}>{notes}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    color: colors.foreground,
    fontFamily: fontFamilies.sans,
    fontSize: 14,
    lineHeight: 22,
  },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: borderWidths.thin,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  copyButton: {
    alignItems: "center",
    backgroundColor: colors.cream,
    borderColor: colors.border,
    borderRadius: radii.sm,
    borderWidth: borderWidths.thin,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  emptyBody: {
    color: colors.foreground,
    fontFamily: fontFamilies.sans,
    fontSize: 14,
    lineHeight: 21,
  },
  emptyBox: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: borderWidths.thin,
    gap: spacing.xs,
    padding: spacing.lg,
  },
  emptyTitle: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansBold,
    fontSize: 14,
  },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  title: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansBold,
    fontSize: 14,
  },
});
