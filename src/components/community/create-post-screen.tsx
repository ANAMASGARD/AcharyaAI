import { Pressable } from '@/components/feedback/pressable';
import { useColorMode, useThemeColors, useThemeStyles } from '@/theme/use-theme';
import type { ThemeColors } from '@/theme/colors';
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { CommunityScreenHeader } from "@/components/community/community-screen-header";
import { PostImagePicker } from "@/components/community/post-image-picker";
import {
  getCommunityPostImagesErrorMessage,
  useCommunityPostImages,
} from "@/hooks/use-community-post-images";
import { useTeacherDisplayName } from "@/hooks/use-teacher-display-name";
import { useCommunity } from "@/hooks/use-community";
import { useCommunityStore } from "@/store/community-store";
import { borderWidths, radii, spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useRef, useState } from "react";
import { useFlushDrafts } from "@/components/preview/preview-provider";
import { createId } from "@/lib/id";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const SUBJECT_TAGS = [
  "General",
  "Mathematics",
  "Science",
  "English",
  "Social Studies",
] as const;

export function CreatePostScreen(): React.ReactElement {
  const colorMode = useColorMode();
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);

  const router = useRouter();
  const { groupId } = useLocalSearchParams<{ groupId?: string }>();
  const community = useCommunity();
  const flushDrafts = useFlushDrafts();
  const displayName = useTeacherDisplayName();
  const { draftPost, setDraftPost, clearDraftPost } = useCommunityStore(groupId ? `community-post-draft:${groupId}` : undefined);
  const {
    selectedImages,
    isPicking,
    error: imageError,
    canAddMore,
    pickImages,
    pickFromFiles,
    takePhoto,
    removeImage,
    clearImages,
  } = useCommunityPostImages(groupId ? `community-images:${groupId}` : undefined);
  const submission = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (): Promise<void> => {
    if (submission.current) return;
    if (!draftPost.title.trim() || (!draftPost.body.trim() && !draftPost.linkUrl.trim() && selectedImages.length === 0)) {
      setError("Add a title and some text, a link, or a photo.");
      return;
    }

    submission.current = true;
    setIsSubmitting(true);
    setError(null);

    try {
      const postId = draftPost.postId || createId();
      setDraftPost({ postId });
      await flushDrafts();
      await community.createPost({ ...draftPost, postId, groupId: groupId || draftPost.groupId || null, displayName, images: selectedImages });

      clearDraftPost();
      clearImages();
      router.back();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to create post",
      );
    } finally {
      submission.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <StatusBar style={colorMode === "dark" ? "light" : "dark"} />
      <CommunityScreenHeader title="Create Post" />
      <Text style={styles.label}>{groupId ? "Only members of this private group can see this post." : "All signed-in teachers can see this post."} Drafts stay on this device until you publish.</Text>
      <KeyboardAwareScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <Text style={styles.label}>Title</Text>
        <TextInput
          editable={!isSubmitting}
          onChangeText={(title) => setDraftPost({ title })}
          placeholder="What do you want to share?"
          placeholderTextColor={colors.mutedForeground}
          style={styles.input}
          value={draftPost.title}
        />

        <Text style={styles.label}>Body</Text>
        <TextInput
          editable={!isSubmitting}
          multiline
          onChangeText={(body) => setDraftPost({ body })}
          placeholder="Share your teaching tip or question..."
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, styles.textArea]}
          value={draftPost.body}
        />

        <Text style={styles.label}>Subject tag</Text>
        <View style={styles.tagRow}>
          {SUBJECT_TAGS.map((tag) => (
            <Pressable
              key={tag}
              accessibilityRole="button"
              disabled={isSubmitting}
              onPress={() => setDraftPost({ subjectTag: tag })}
              style={[
                styles.tagChip,
                draftPost.subjectTag === tag ? styles.tagChipActive : null,
              ]}
            >
              <Text style={[styles.tagChipLabel, draftPost.subjectTag === tag && { color: colors.onAccent }]}>{tag}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Link (optional)</Text>
        <TextInput
          editable={!isSubmitting}
          autoCapitalize="none"
          onChangeText={(linkUrl) => setDraftPost({ linkUrl })}
          placeholder="https://..."
          placeholderTextColor={colors.mutedForeground}
          style={styles.input}
          value={draftPost.linkUrl}
        />

        <PostImagePicker
          disabled={isSubmitting}
          canAddMore={canAddMore}
          errorMessage={
            imageError ? getCommunityPostImagesErrorMessage(imageError) : null
          }
          isPicking={isPicking}
          onPickFromFiles={() => {
            void pickFromFiles();
          }}
          onPickImages={() => {
            void pickImages();
          }}
          onRemoveImage={removeImage}
          onTakePhoto={() => {
            void takePhoto();
          }}
          selectedImages={selectedImages}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          accessibilityRole="button"
          disabled={isSubmitting}
          onPress={() => {
            void handleSubmit();
          }}
          style={[styles.submit, isSubmitting && styles.submitDisabled]}
        >
          {isSubmitting ? (
            <ActivityIndicator color={colors.onAccent} size="small" />
          ) : (
            <Text style={[styles.submitLabel, { color: colors.onAccent }]}>Publish post</Text>
          )}
        </Pressable>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  content: {
    gap: spacing.sm,
    padding: spacing.lg,
  },
  error: {
    color: colors.destructive,
    fontFamily: fontFamilies.sans,
    fontSize: 14,
    lineHeight: 20,
  },
  input: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: borderWidths.thin,
    color: colors.foreground,
    fontFamily: fontFamilies.sans,
    fontSize: 15,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  label: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansMedium,
    fontSize: 14,
    lineHeight: 18,
    marginTop: spacing.sm,
  },
  safeArea: {
    backgroundColor: colors.cream,
    flex: 1,
  },
  submit: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: borderWidths.thin,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
  },
  submitDisabled: {
    opacity: 0.7,
  },
  submitLabel: {
    color: colors.foreground,
    fontFamily: fontFamilies.head,
    fontSize: 16,
    lineHeight: 22,
  },
  tagChip: {
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: borderWidths.thin,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  tagChipActive: {
    backgroundColor: colors.primary,
  },
  tagChipLabel: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansMedium,
    fontSize: 12,
    lineHeight: 16,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: "top",
  },
});
