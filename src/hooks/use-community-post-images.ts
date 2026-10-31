import { usePreviewFeature, usePreviewAttachments } from "@/components/preview/preview-provider";
import {
  ACCEPTED_COMMUNITY_IMAGE_MIMES,
  COMMUNITY_POST_IMAGE_MAX_COUNT,
  isAcceptedCommunityImage,
  isWithinCommunityImageSizeLimit,
} from "@/lib/community/image-validation";
import { normalizeImageAsset } from "@/lib/notes-file-validation";
import type { CommunityPostImageDraft } from "@/types/community";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useState } from "react";

type CommunityPostImageError =
  | "unsupported_type"
  | "pick_failed"
  | "too_large"
  | "max_count";

type UseCommunityPostImagesResult = Readonly<{
  selectedImages: readonly CommunityPostImageDraft[];
  isPicking: boolean;
  error: CommunityPostImageError | null;
  canAddMore: boolean;
  pickImages: () => Promise<void>;
  pickFromFiles: () => Promise<void>;
  takePhoto: () => Promise<void>;
  removeImage: (id: string) => void;
  clearImages: () => void;
  clearError: () => void;
}>;

function getErrorMessage(error: CommunityPostImageError): string {
  switch (error) {
    case "unsupported_type":
      return "Choose a JPEG, PNG, WebP, or GIF photo. HEIC and other formats need conversion first.";
    case "too_large":
      return "One or more images are too large. Try smaller photos.";
    case "max_count":
      return `You can attach up to ${COMMUNITY_POST_IMAGE_MAX_COUNT} images per post.`;
    case "pick_failed":
    default:
      return "Could not open the image picker. Please try again.";
  }
}

function validateAndNormalize(input: {
  uri: string;
  fileName: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
}): CommunityPostImageDraft | CommunityPostImageError {
  const normalized = normalizeImageAsset({
    uri: input.uri,
    fileName: input.fileName,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
  });

  if (!isAcceptedCommunityImage(normalized.name, normalized.mimeType)) {
    return "unsupported_type";
  }

  if (!isWithinCommunityImageSizeLimit(normalized.sizeBytes)) {
    return "too_large";
  }

  return {
    uri: normalized.uri,
    name: normalized.name,
    mimeType: normalized.mimeType ?? "image/jpeg",
    sizeBytes: normalized.sizeBytes,
  };
}

export function useCommunityPostImages(draftKey = "community-images"): UseCommunityPostImagesResult {
  const [selectedImages, setSelectedImages] = usePreviewFeature<CommunityPostImageDraft[]>(draftKey, []);
  const { saveAttachment, removeAttachment } = usePreviewAttachments();
  const [isPicking, setIsPicking] = useState(false);
  const [error, setError] = useState<CommunityPostImageError | null>(null);

  const canAddMore = selectedImages.length < COMMUNITY_POST_IMAGE_MAX_COUNT;

  const appendImages = useCallback(async (candidates: readonly CommunityPostImageDraft[]): Promise<void> => {
    const remaining = COMMUNITY_POST_IMAGE_MAX_COUNT - selectedImages.length;
    if (remaining <= 0) { setError('max_count'); return; }
    const saved: CommunityPostImageDraft[] = [];
    try {
      for (const candidate of candidates.slice(0, remaining)) {
        const attachment = await saveAttachment({ ...candidate, sizeBytes: candidate.sizeBytes ?? undefined });
        saved.push(attachment);
      }
      setSelectedImages((current) => [...current, ...saved]);
    } catch (cause) {
      await Promise.all(saved.map((image) => image.id ? removeAttachment(image.id) : Promise.resolve()));
      throw cause;
    }
  }, [saveAttachment, removeAttachment, selectedImages.length, setSelectedImages]);

  const pickImages = useCallback(async (): Promise<void> => {
    if (isPicking || !canAddMore) {
      if (!canAddMore) {
        setError("max_count");
      }

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
        allowsMultipleSelection: true,
        selectionLimit: COMMUNITY_POST_IMAGE_MAX_COUNT,
      });

      if (result.canceled || result.assets.length === 0) {
        return;
      }

      const normalized: CommunityPostImageDraft[] = [];

      for (const asset of result.assets) {
        const validated = validateAndNormalize({
          uri: asset.uri,
          fileName: asset.fileName ?? `post-image-${Date.now()}.jpg`,
          mimeType: asset.mimeType,
          sizeBytes: asset.fileSize ?? null,
        });

        if (typeof validated === "string") {
          setError(validated);
          return;
        }

        normalized.push(validated);
      }

      await appendImages(normalized);
    } catch {
      setError("pick_failed");
    } finally {
      setIsPicking(false);
    }
  }, [appendImages, canAddMore, isPicking]);

  const pickFromFiles = useCallback(async (): Promise<void> => {
    if (isPicking || !canAddMore) {
      if (!canAddMore) {
        setError("max_count");
      }

      return;
    }

    setIsPicking(true);
    setError(null);

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [...ACCEPTED_COMMUNITY_IMAGE_MIMES, "image/*"],
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const normalized: CommunityPostImageDraft[] = [];

      for (const asset of result.assets) {
        const validated = validateAndNormalize({
          uri: asset.uri,
          fileName: asset.name,
          mimeType: asset.mimeType,
          sizeBytes: asset.size ?? null,
        });

        if (typeof validated === "string") {
          setError(validated);
          return;
        }

        normalized.push(validated);
      }

      await appendImages(normalized);
    } catch {
      setError("pick_failed");
    } finally {
      setIsPicking(false);
    }
  }, [appendImages, canAddMore, isPicking]);

  const takePhoto = useCallback(async (): Promise<void> => {
    if (isPicking || !canAddMore) {
      if (!canAddMore) {
        setError("max_count");
      }

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
      const validated = validateAndNormalize({
        uri: asset.uri,
        fileName: asset.fileName ?? `post-camera-${Date.now()}.jpg`,
        mimeType: asset.mimeType,
        sizeBytes: asset.fileSize ?? null,
      });

      if (typeof validated === "string") {
        setError(validated);
        return;
      }

      await appendImages([validated]);
    } catch {
      setError("pick_failed");
    } finally {
      setIsPicking(false);
    }
  }, [appendImages, canAddMore, isPicking]);

  const removeImage = useCallback((id: string): void => {
    const selected = selectedImages.find((item) => (item.id ?? item.uri) === id);
    if (selected?.id) void removeAttachment(selected.id).catch(() => setError("pick_failed"));
    setSelectedImages((current) => current.filter((item) => (item.id ?? item.uri) !== id));
  }, [selectedImages, removeAttachment, setSelectedImages]);

  const clearImages = useCallback((): void => {
    setSelectedImages([]);
    setError(null);
  }, [setSelectedImages]);

  const clearError = useCallback((): void => {
    setError(null);
  }, []);

  return {
    selectedImages,
    isPicking,
    error,
    canAddMore,
    pickImages,
    pickFromFiles,
    takePhoto,
    removeImage,
    clearImages,
    clearError,
  };
}

export function getCommunityPostImagesErrorMessage(
  error: CommunityPostImageError,
): string {
  return getErrorMessage(error);
}
