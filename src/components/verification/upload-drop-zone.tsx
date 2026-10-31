import { Pressable } from '@/components/feedback/pressable';
import { useThemeColors, useThemeStyles } from '@/theme/use-theme';
import type { ThemeColors } from '@/theme/colors';
import { NeoButton } from "@/components/ui/neo-button";
import {
  formatFileSize,
  getNotesUploadErrorMessage,
} from "@/lib/notes-file-validation";
import { borderWidths, radii, spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import type { NotesUploadError, NotesUploadFile } from "@/types/notes-verification";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

type Props = Readonly<{
  selectedFile: NotesUploadFile | null;
  isPicking: boolean;
  error: NotesUploadError | null;
  canVerify: boolean;
  isVerifying: boolean;
  onPickDocument: () => void;
  onPickImage: () => void;
  onTakePhoto: () => void;
  onClearFile: () => void;
  onVerify: () => void;
}>;

export function UploadDropZone({
  selectedFile,
  isPicking,
  error,
  canVerify,
  isVerifying,
  onPickDocument,
  onPickImage,
  onTakePhoto,
  onClearFile,
  onVerify,
}: Props): React.ReactElement {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);

  const hasFile = selectedFile !== null;
  const isImage = selectedFile?.kind === "image" && Boolean(selectedFile.uri);

  return (
    <View style={styles.container}>
      <Text style={styles.stepLabel}>1 · Upload question paper</Text>

      {selectedFile && !selectedFile.uri ? <Text style={styles.fileSize}>This attachment is no longer available. Remove it and choose the file again.</Text> : null}
      {hasFile ? (
        <View style={styles.dropZone}>
          {isPicking ? (
            <ActivityIndicator color={colors.foreground} size="small" />
          ) : isImage ? (
            <View style={styles.imagePreview}>
              <Image
                contentFit="cover"
                source={{ uri: selectedFile.uri }}
                style={styles.previewImage}
              />
              <View style={styles.fileMeta}>
                <Text numberOfLines={1} style={styles.fileName}>
                  {selectedFile.name}
                </Text>
                <Text style={styles.fileSize}>
                  {formatFileSize(selectedFile.sizeBytes)}
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Remove selected file"
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                onPress={onClearFile}
                style={styles.clearButton}
              >
                <MaterialCommunityIcons color={colors.foreground} name="close" size={18} />
              </Pressable>
            </View>
          ) : (
            <View style={styles.filePreview}>
              <Pressable onPress={onPickDocument} style={styles.fileTapArea}>
                <View style={styles.fileIconWrap}>
                  <MaterialCommunityIcons
                    color={colors.onAccent}
                    name="file-document-outline"
                    size={22}
                  />
                </View>
                <View style={styles.fileMeta}>
                  <Text numberOfLines={1} style={styles.fileName}>
                    {selectedFile.name}
                  </Text>
                  <Text style={styles.fileSize}>
                    {formatFileSize(selectedFile.sizeBytes)}
                  </Text>
                </View>
              </Pressable>
              <Pressable
                accessibilityLabel="Remove selected file"
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                onPress={onClearFile}
                style={styles.clearButton}
              >
                <MaterialCommunityIcons color={colors.foreground} name="close" size={18} />
              </Pressable>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.dropZone}>
          {isPicking ? (
            <ActivityIndicator color={colors.foreground} size="small" />
          ) : (
            <>
              <Text style={styles.zoneLabel}>PDF, Word, or photo</Text>
              <View style={styles.sourceRow}>
                <Pressable onPress={onPickDocument} style={styles.sourceButton}>
                  <MaterialCommunityIcons name="file-document-outline" size={18} />
                  <Text style={styles.sourceLabel}>PDF/Doc</Text>
                </Pressable>
                <Pressable onPress={onPickImage} style={styles.sourceButton}>
                  <MaterialCommunityIcons name="image-outline" size={18} />
                  <Text style={styles.sourceLabel}>Gallery</Text>
                </Pressable>
                <Pressable onPress={onTakePhoto} style={styles.sourceButton}>
                  <MaterialCommunityIcons name="camera-outline" size={18} />
                  <Text style={styles.sourceLabel}>Camera</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      )}

      {error ? (
        <View style={styles.errorBanner}>
          <MaterialCommunityIcons color={colors.onAccent} name="alert-circle-outline" size={18} />
          <Text style={[styles.errorText, { color: colors.onAccent }]}>{getNotesUploadErrorMessage(error)}</Text>
        </View>
      ) : null}

      <View style={styles.ctaWrap}>
        <NeoButton
          disabled={!canVerify || isVerifying}
          iconName="check-decagram"
          label={isVerifying ? "Verifying…" : "Verify Paper"}
          onPress={onVerify}
        />
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  clearButton: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: borderWidths.thin,
    height: spacing.touch,
    justifyContent: "center",
    width: spacing.touch,
  },
  container: {
    gap: spacing.md,
  },
  ctaWrap: {
    alignItems: "stretch",
  },
  dropZone: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderStyle: "dashed",
    borderWidth: borderWidths.thin,
    gap: spacing.md,
    justifyContent: "center",
    minHeight: 168,
    padding: spacing.lg,
  },
  errorBanner: {
    alignItems: "center",
    backgroundColor: colors.coral,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: borderWidths.thin,
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  errorText: {
    color: colors.foreground,
    flex: 1,
    fontFamily: fontFamilies.sansMedium,
    fontSize: 14,
    lineHeight: 20,
  },
  fileIconWrap: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: borderWidths.thin,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  fileMeta: {
    flex: 1,
    gap: 2,
  },
  fileName: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansBold,
    fontSize: 15,
    lineHeight: 20,
  },
  filePreview: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    width: "100%",
  },
  fileSize: {
    color: colors.mutedForeground,
    fontFamily: fontFamilies.sans,
    fontSize: 13,
    lineHeight: 18,
  },
  fileTapArea: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: spacing.md,
    minHeight: spacing.touch,
  },
  imagePreview: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    width: "100%",
  },
  previewImage: {
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: borderWidths.thin,
    height: 72,
    width: 72,
  },
  sourceButton: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: borderWidths.thin,
    flex: 1,
    gap: 4,
    paddingVertical: spacing.sm,
  },
  sourceLabel: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansMedium,
    fontSize: 12,
  },
  sourceRow: {
    flexDirection: "row",
    gap: spacing.sm,
    width: "100%",
  },
  stepLabel: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansBold,
    fontSize: 16,
    lineHeight: 22,
  },
  zoneLabel: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansBold,
    fontSize: 18,
    lineHeight: 24,
    textAlign: "center",
  },
});
