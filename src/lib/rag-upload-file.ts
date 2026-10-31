import { File } from 'expo-file-system';

export type RagUploadAsset = { uri: string; name: string; mimeType?: string };
export function appendNativeRagFile(form: FormData, asset: RagUploadAsset): void {
  // Expo fetch accepts File's bytes() interface, not React Native URI descriptors.
  form.append('file', new File(asset.uri), asset.name);
}
