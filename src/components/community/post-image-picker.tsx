import { useThemeColors, useThemeStyles } from '@/theme/use-theme';
import type { ThemeColors } from '@/theme/colors';
import { borderWidths, radii, spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import type { CommunityPostImageDraft } from "@/types/community";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type Props = Readonly<{
  selectedImages: readonly CommunityPostImageDraft[];
  isPicking: boolean;
  errorMessage: string | null;
  canAddMore: boolean;
  onPickImages: () => void;
  onPickFromFiles: () => void;
  onTakePhoto: () => void;
  onRemoveImage: (id: string) => void;
}>;

export function PostImagePicker({
  selectedImages,
  isPicking,
  errorMessage,
  canAddMore,
  onPickImages,
  onPickFromFiles,
  onTakePhoto,
  onRemoveImage,
}: Props): React.ReactElement {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Images (optional)</Text>

      <View style={styles.actionRow}>
        <Pressable
          accessibilityRole="button"
          disabled={!canAddMore || isPicking}
          onPress={onPickImages}
          style={({ pressed }) => [
            styles.actionChip,
            styles.actionGallery,
            pressed && styles.actionChipPressed,
            (!canAddMore || isPicking) && styles.actionChipDisabled,
          ]}
        >
          <MaterialCommunityIcons
            color={colors.onAccent}
            name="image-multiple-outline"
            size={16}
          />
          <Text style={[styles.actionLabel, { color: colors.onAccent }]}>Gallery</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          disabled={!canAddMore || isPicking}
          onPress={onTakePhoto}
          style={({ pressed }) => [
            styles.actionChip,
            styles.actionCamera,
            pressed && styles.actionChipPressed,
            (!canAddMore || isPicking) && styles.actionChipDisabled,
          ]}
        >
          <MaterialCommunityIcons
            color={colors.onAccent}
            name="camera-outline"
            size={16}
          />
          <Text style={[styles.actionLabel, { color: colors.onAccent }]}>Camera</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          disabled={!canAddMore || isPicking}
          onPress={onPickFromFiles}
          style={({ pressed }) => [
            styles.actionChip,
            styles.actionFiles,
            pressed && styles.actionChipPressed,
            (!canAddMore || isPicking) && styles.actionChipDisabled,
          ]}
        >
          <MaterialCommunityIcons
            color={colors.onAccent}
            name="folder-image"
            size={16}
          />
          <Text style={[styles.actionLabel, { color: colors.onAccent }]}>Files</Text>
        </Pressable>
      </View>

      {isPicking ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.foreground} size="small" />
          <Text style={styles.loadingText}>Opening picker…</Text>
        </View>
      ) : null}

      {selectedImages.length > 0 ? (
        <ScrollView
          contentContainerStyle={styles.previewRow}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {selectedImages.map((image) => (
            <View key={image.id ?? image.uri} style={styles.previewCard}>
              {image.uri ? <Image
                contentFit="cover"
                source={{ uri: image.uri }}
                style={styles.previewImage}
              /> : <View style={styles.previewImage}><Text style={styles.previewName}>File unavailable. Remove and choose again.</Text></View>}
              <Pressable
                accessibilityLabel={`Remove ${image.name}`}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                onPress={() => onRemoveImage(image.id ?? image.uri)}
                style={styles.removeButton}
              >
                <MaterialCommunityIcons color={colors.onAccent} name="close" size={14} />
              </Pressable>
              <Text numberOfLines={1} style={styles.previewName}>
                {image.name}
              </Text>
            </View>
          ))}
        </ScrollView>
      ) : null}

      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  actionChip: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: borderWidths.thin,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  actionChipDisabled: {
    opacity: 0.55,
  },
  actionCamera: {
    backgroundColor: colors.mint,
  },
  actionChipPressed: {
    opacity: 0.9,
  },
  actionFiles: {
    backgroundColor: colors.lavender,
  },
  actionGallery: {
    backgroundColor: colors.sky,
  },
  actionLabel: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansMedium,
    fontSize: 13,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  container: {
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  error: {
    color: colors.destructive,
    fontFamily: fontFamilies.sans,
    fontSize: 13,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  label: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansMedium,
    fontSize: 14,
    lineHeight: 18,
  },
  loadingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  loadingText: {
    color: colors.mutedForeground,
    fontFamily: fontFamilies.sans,
    fontSize: 13,
    lineHeight: 18,
  },
  previewCard: {
    width: 108,
  },
  previewImage: {
    backgroundColor: colors.muted,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: borderWidths.thin,
    height: 88,
    width: 108,
  },
  previewName: {
    color: colors.mutedForeground,
    fontFamily: fontFamilies.sans,
    fontSize: 11,
    lineHeight: 14,
    marginTop: 4,
  },
  previewRow: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  removeButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    height: 22,
    justifyContent: "center",
    position: "absolute",
    right: 6,
    top: 6,
    width: 22,
  },
});
