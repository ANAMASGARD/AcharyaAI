import { Pressable } from '@/components/feedback/pressable';
import { useThemeColors, useThemeStyles } from '@/theme/use-theme';
import type { ThemeColors } from '@/theme/colors';
import { createId } from "@/lib/id";
import { useFlushDrafts, usePreviewFeature } from "@/components/preview/preview-provider";
import { borderWidths, radii, spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRef, useState } from "react";
import { PostImagePicker } from "./post-image-picker";
import { useCommunityPostImages, getCommunityPostImagesErrorMessage } from "@/hooks/use-community-post-images";
import type { CommunityPostImageDraft } from "@/types/community";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type Props = Readonly<{
  onSend: (body: string, linkUrl?: string, images?: readonly CommunityPostImageDraft[], messageId?: string) => Promise<void>;
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

  const flushDrafts = useFlushDrafts();
  const submission = useRef(false);
  const [draftId, setDraftId] = usePreviewFeature(`group-message-id:${groupId}`, "");
  const [body, setBody] = usePreviewFeature(`group-message-body:${groupId}`, "");
  const [linkUrl, setLinkUrl] = usePreviewFeature(`group-message-link:${groupId}`, "");
  const [showLink, setShowLink] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const photos = useCommunityPostImages(`group-message-images:${groupId}`);

  const handleSend = async (): Promise<void> => {
    const trimmed = body.trim();

    if (submission.current || (!trimmed && !linkUrl.trim() && photos.selectedImages.length === 0) || isSending) {
      return;
    }

    submission.current = true;
    setError(null);
    try {
      const messageId = draftId || createId();
      setDraftId(messageId);
      await flushDrafts();
      await onSend(trimmed, linkUrl.trim() || undefined, photos.selectedImages, messageId);
      setDraftId("");
      setBody("");
      setLinkUrl("");
      setShowLink(false);
      photos.clearImages();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Message could not be sent. Your draft is safe.");
    } finally { submission.current = false; }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.hint}>Only members of this group can read messages.</Text>
      {error ? <Text accessibilityRole="alert" style={[styles.hint, { color: colors.destructive }]}>{error}</Text> : null}
      <PostImagePicker disabled={isSending} selectedImages={photos.selectedImages} isPicking={photos.isPicking || isSending} canAddMore={photos.canAddMore && !isSending} errorMessage={photos.error ? getCommunityPostImagesErrorMessage(photos.error) : null} onPickImages={() => void photos.pickImages()} onPickFromFiles={() => void photos.pickFromFiles()} onTakePhoto={() => void photos.takePhoto()} onRemoveImage={photos.removeImage} />
      {showLink ? (
        <TextInput
          editable={!isSending}
          onChangeText={setLinkUrl}
          placeholder="Optional link URL"
          placeholderTextColor={colors.mutedForeground}
          style={styles.linkInput}
          value={linkUrl}
        />
      ) : null}
      <View style={styles.row}>
        <Pressable
          disabled={isSending}
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
          editable={!isSending}
          multiline
          onChangeText={setBody}
          placeholder="Message your group..."
          placeholderTextColor={colors.mutedForeground}
          style={styles.input}
          value={body}
        />
        <Pressable
          accessibilityLabel="Send message"
          accessibilityRole="button"
          disabled={isSending || (!body.trim() && !linkUrl.trim() && photos.selectedImages.length === 0)}
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
    height: 44,
    justifyContent: "center",
    width: 44,
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
    height: 44,
    justifyContent: "center",
    width: 44,
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
