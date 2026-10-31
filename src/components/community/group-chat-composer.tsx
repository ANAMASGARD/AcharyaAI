import { Pressable } from '@/components/feedback/pressable';
import { useThemeColors, useThemeStyles } from '@/theme/use-theme';
import type { ThemeColors } from '@/theme/colors';
import { usePreviewFeature } from "@/components/preview/preview-provider";
import { borderWidths, radii, spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type Props = Readonly<{
  onSend: (body: string, linkUrl?: string) => Promise<void>;
  isSending: boolean;
  groupId: string;
}>;

export function GroupChatComposer({
  onSend,
  isSending,
  groupId,
}: Props): React.ReactElement {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);

  const [body, setBody] = usePreviewFeature(`group-message-body:${groupId}`, "");
  const [linkUrl, setLinkUrl] = usePreviewFeature(`group-message-link:${groupId}`, "");
  const [showLink, setShowLink] = useState(false);

  const handleSend = async (): Promise<void> => {
    const trimmed = body.trim();

    if (!trimmed || isSending) {
      return;
    }

    await onSend(trimmed, linkUrl.trim() || undefined);
    setBody("");
    setLinkUrl("");
    setShowLink(false);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.hint}>Local preview · messages are saved on this device only.</Text>
      {showLink ? (
        <TextInput
          onChangeText={setLinkUrl}
          placeholder="Optional link URL"
          placeholderTextColor={colors.mutedForeground}
          style={styles.linkInput}
          value={linkUrl}
        />
      ) : null}
      <View style={styles.row}>
        <Pressable
          accessibilityLabel="Attach link"
          accessibilityRole="button"
          onPress={() => setShowLink((current) => !current)}
          style={styles.iconButton}
        >
          <MaterialCommunityIcons
            color={colors.foreground}
            name="link-variant"
            size={22}
          />
        </Pressable>
        <TextInput
          multiline
          onChangeText={setBody}
          placeholder="Message your group..."
          placeholderTextColor={colors.mutedForeground}
          style={styles.input}
          value={body}
        />
        <Pressable
          accessibilityLabel="Save local message"
          accessibilityRole="button"
          disabled={isSending || !body.trim()}
          onPress={() => {
            void handleSend();
          }}
          style={[styles.sendButton, isSending && styles.sendDisabled]}
        >
          {isSending ? (
            <ActivityIndicator color={colors.onAccent} size="small" />
          ) : (
            <MaterialCommunityIcons
              color={colors.onAccent}
              name="send"
              size={20}
            />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  hint: {
    color: colors.mutedForeground,
    fontFamily: fontFamilies.sans,
    fontSize: 11,
    lineHeight: 14,
    marginBottom: spacing.xs,
  },
  iconButton: {
    alignItems: "center",
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  input: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: borderWidths.thin,
    color: colors.foreground,
    flex: 1,
    fontFamily: fontFamilies.sans,
    fontSize: 15,
    maxHeight: 100,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  linkInput: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: borderWidths.thin,
    color: colors.foreground,
    fontFamily: fontFamilies.sans,
    fontSize: 14,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  row: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: spacing.xs,
  },
  sendButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: borderWidths.thin,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  sendDisabled: {
    opacity: 0.6,
  },
  wrap: {
    borderTopColor: colors.border,
    borderTopWidth: borderWidths.thin,
    padding: spacing.md,
  },
});
