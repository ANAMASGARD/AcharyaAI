import { colors } from "@/theme/colors";
import { borderWidths, radii, shadows, spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import type { ChatConversationSummary } from "@/types/chat";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = Readonly<{
  conversation: ChatConversationSummary;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
}>;

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Recent";
  }

  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
  });
}

export function ChatHistoryCard({
  conversation,
  onPress,
  onEdit,
  onDelete,
}: Props): React.ReactElement {
  const messageLabel =
    conversation.messageCount === 1
      ? "1 msg"
      : `${conversation.messageCount} msgs`;

  return (
    <View style={styles.cardWrap}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Pressable
            accessibilityLabel={`Open ${conversation.title}`}
            onPress={onPress}
            style={({ pressed }) => [
              styles.cardTapArea,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.titleRow}>
              <MaterialCommunityIcons
                color={colors.foreground}
                name="message-text-outline"
                size={18}
              />
              <Text numberOfLines={2} style={styles.title}>
                {conversation.title}
              </Text>
            </View>
            <Text style={styles.meta}>
              {messageLabel} • {formatDate(conversation.createdAt)}
            </Text>
          </Pressable>

          <Pressable
            accessibilityLabel={`Rename ${conversation.title}`}
            onPress={onEdit}
            style={({ pressed }) => [
              styles.editButton,
              pressed && styles.pressed,
            ]}
          >
            <MaterialCommunityIcons
              color={colors.foreground}
              name="pencil-outline"
              size={16}
            />
          </Pressable>
        </View>

        <Pressable
          accessibilityLabel={`Delete ${conversation.title}`}
          onPress={onDelete}
          style={({ pressed }) => [
            styles.deleteButton,
            pressed && styles.pressed,
          ]}
        >
          <MaterialCommunityIcons
            color={colors.foreground}
            name="trash-can-outline"
            size={16}
          />
          <Text style={styles.deleteLabel}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.primary,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: borderWidths.default,
    gap: spacing.md,
    padding: spacing.md,
    ...shadows.md,
  },
  cardHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.sm,
  },
  cardTapArea: {
    flex: 1,
    gap: spacing.xs,
  },
  cardWrap: {
    marginBottom: spacing.md,
  },
  deleteButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.coral,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: borderWidths.thin,
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...shadows.sm,
  },
  deleteLabel: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansBold,
    fontSize: 13,
  },
  editButton: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.sm,
    borderWidth: borderWidths.default,
    height: 32,
    justifyContent: "center",
    marginTop: 2,
    width: 32,
    ...shadows.sm,
  },
  meta: {
    color: colors.mutedForeground,
    fontFamily: fontFamilies.sans,
    fontSize: 12,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ translateY: 1 }],
  },
  title: {
    color: colors.foreground,
    flex: 1,
    fontFamily: fontFamilies.sansBold,
    fontSize: 15,
    lineHeight: 20,
  },
  titleRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.sm,
  },
});
