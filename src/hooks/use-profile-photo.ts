import { isClerkAPIResponseError, useUser } from '@clerk/expo';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';

type UseProfilePhotoResult = {
  isUploading: boolean;
  error: string | null;
  pickAndUpload: () => Promise<void>;
};

/** Account photos use the existing Clerk account; classroom files stay local. */
export function useProfilePhoto(): UseProfilePhotoResult {
  const { user } = useUser();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickAndUpload = useCallback(async (): Promise<void> => {
    if (!user || isUploading) return;
    setError(null);
    setIsUploading(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError('Photo library permission is required.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1],
        quality: 0.8, base64: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset?.base64) {
        setError('This photo could not be read. Please choose another image.');
        return;
      }
      const dataUrl = `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`;
      await user.setProfileImage({ file: dataUrl });
      await user.reload();
    } catch (cause) {
      setError(isClerkAPIResponseError(cause)
        ? cause.errors[0]?.longMessage ?? cause.errors[0]?.message ?? 'Upload failed.'
        : 'Could not update your profile photo. Please try again.');
    } finally {
      setIsUploading(false);
    }
  }, [isUploading, user]);

  return { isUploading, error, pickAndUpload };
}
