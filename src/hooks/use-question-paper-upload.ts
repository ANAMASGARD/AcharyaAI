import { usePreviewFeature, usePreviewAttachments } from "@/components/preview/preview-provider";
import {
  ACCEPTED_NOTE_MIMES,
  isAcceptedNotesFile,
  isWithinSizeLimit,
  MAX_NOTES_UPLOAD_BYTES,
  normalizeImageAsset,
  normalizePickerAsset,
} from "@/lib/notes-file-validation";
import type { NotesUploadError, NotesUploadFile } from "@/types/notes-verification";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useState } from "react";

type UseQuestionPaperUploadResult = Readonly<{
  selectedFile: NotesUploadFile | null;
  isPicking: boolean;
  error: NotesUploadError | null;
  pickDocument: () => Promise<void>;
  pickImage: () => Promise<void>;
  takePhoto: () => Promise<void>;
  clearFile: () => void;
  clearError: () => void;
}>;

function validateSize(sizeBytes: number | null | undefined): NotesUploadError | null {
  if (!isWithinSizeLimit(sizeBytes)) {
    return "too_large";
  }

  return null;
}

export function useQuestionPaperUpload(): UseQuestionPaperUploadResult {
  const [selectedFile, setSelectedFile] = usePreviewFeature<NotesUploadFile | null>("paper-file", null);
  const { saveAttachment, removeAttachment } = usePreviewAttachments();
  const saveFile = useCallback(async (file: NotesUploadFile) => {
    const saved = await saveAttachment({ ...file, mimeType: file.mimeType ?? undefined, sizeBytes: file.sizeBytes ?? undefined });
    if (selectedFile?.id) await removeAttachment(selectedFile.id);
    setSelectedFile({ ...saved, kind: file.kind });
  }, [saveAttachment, removeAttachment, selectedFile, setSelectedFile]);
  const [isPicking, setIsPicking] = useState(false);
  const [error, setError] = useState<NotesUploadError | null>(null);

  const pickDocument = useCallback(async (): Promise<void> => {
    if (isPicking) {
      return;
    }

    setIsPicking(true);
    setError(null);

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [...ACCEPTED_NOTE_MIMES],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      const normalized = normalizePickerAsset(result.assets[0]);

      if (!isAcceptedNotesFile(normalized.name, normalized.mimeType)) {
        setError("unsupported_type");
        return;
      }

      const sizeError = validateSize(normalized.sizeBytes);
      if (sizeError) {
        setError(sizeError);
        return;
      }

      await saveFile(normalized);
    } catch {
      setError("pick_failed");
    } finally {
      setIsPicking(false);
    }
  }, [isPicking, saveFile]);

  const pickImage = useCallback(async (): Promise<void> => {
    if (isPicking) {
      return;
    }

    setIsPicking(true);
    setError(null);

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError("pick_failed");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.85,
        allowsEditing: false,
      });

      if (result.canceled || !result.assets[0]) {
        return;
      }

      const asset = result.assets[0];
      const normalized = normalizeImageAsset({
        uri: asset.uri,
        fileName: asset.fileName ?? `question-paper-${Date.now()}.jpg`,
        mimeType: asset.mimeType ?? "image/jpeg",
        sizeBytes: asset.fileSize ?? null,
      });

      const sizeError = validateSize(normalized.sizeBytes);
      if (sizeError) {
        setError(sizeError);
        return;
      }

      await saveFile(normalized);
    } catch {
      setError("pick_failed");
    } finally {
      setIsPicking(false);
    }
  }, [isPicking, saveFile]);

  const takePhoto = useCallback(async (): Promise<void> => {
    if (isPicking) {
      return;
    }

    setIsPicking(true);
    setError(null);

    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setError("pick_failed");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.85,
        allowsEditing: false,
      });

      if (result.canceled || !result.assets[0]) {
        return;
      }

      const asset = result.assets[0];
      const normalized = normalizeImageAsset({
        uri: asset.uri,
        fileName: asset.fileName ?? `question-paper-${Date.now()}.jpg`,
        mimeType: asset.mimeType ?? "image/jpeg",
        sizeBytes: asset.fileSize ?? null,
      });

      const sizeError = validateSize(normalized.sizeBytes);
      if (sizeError) {
        setError(sizeError);
        return;
      }

      await saveFile(normalized);
    } catch {
      setError("pick_failed");
    } finally {
      setIsPicking(false);
    }
  }, [isPicking, saveFile]);

  const clearFile = useCallback((): void => {
    if (selectedFile?.id) void removeAttachment(selectedFile.id).catch(() => setError("pick_failed"));
    setSelectedFile(null);
    setError(null);
  }, [removeAttachment, selectedFile, setSelectedFile]);

  const clearError = useCallback((): void => {
    setError(null);
  }, []);

  return {
    selectedFile,
    isPicking,
    error,
    pickDocument,
    pickImage,
    takePhoto,
    clearFile,
    clearError,
  };
}

export { MAX_NOTES_UPLOAD_BYTES };
