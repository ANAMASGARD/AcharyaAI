import { formatTimeAgo } from "@/lib/community/time-ago";
import { colors } from "@/theme/colors";
import { borderWidths, radii, spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import type { GroupMessage } from "@/types/community";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

type Props = Readonly<{
  message: GroupMessage;
}>;

export function GroupChatBubble({ message }: Props): React.ReactElement {
  return (
    <View style={styles.row}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{message.authorAvatarLetter}</Text>
      </View>
      <View style={styles.bubble}>
        <Text style={styles.author}>{message.authorDisplayName}</Text>
        <Text style={styles.body}>{message.body}</Text>
        {message.linkUrl ? (
          <Pressable
            accessibilityRole="link"
            onPress={() => {
              void Linking.openURL(message.linkUrl as string);
            }}
          >
            <Text style={styles.link}>{message.linkUrl}</Text>
          </Pressable>
        ) : null}
        <Text style={styles.time}>{formatTimeAgo(message.createdAt)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  author: {
    color: colors.mutedForeground,
    fontFamily: fontFamilies.sansMedium,
    fontSize: 12,
    lineHeight: 16,
  },
  avatar: {
    alignItems: "center",
    backgroundColor: colors.sky,
    borderColor: colors.border,
    borderRadius: radii.sm,
    borderWidth: borderWidths.thin,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  avatarText: {
    color: colors.foreground,
    fontFamily: fontFamilies.head,
    fontSize: 14,
    lineHeight: 18,
  },
  body: {
    color: colors.foreground,
    fontFamily: fontFamilies.sans,
    fontSize: 15,
    lineHeight: 21,
    marginTop: 2,
  },
  bubble: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: borderWidths.thin,
    flex: 1,
    padding: spacing.md,
  },
  link: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansMedium,
    fontSize: 13,
    lineHeight: 18,
    marginTop: spacing.xs,
    textDecorationLine: "underline",
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  time: {
    color: colors.mutedForeground,
    fontFamily: fontFamilies.sans,
    fontSize: 11,
    lineHeight: 14,
    marginTop: spacing.xs,
  },
});
