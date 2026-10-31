import { useEffect, useRef, useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { usePreviewAttachments } from '@/components/preview/preview-provider';
import { useLocalChat } from '@/hooks/use-local-chat';
import { ACCEPTED_NOTE_MIMES, isAcceptedNotesFile, isWithinSizeLimit } from '@/lib/notes-file-validation';
import type { AttachmentInput } from '@/lib/ui-preview/types';

export type ChatAttachmentSource = 'camera' | 'photos' | 'files';

export function useChatAttachments() {
  const [chat, setChat] = useLocalChat();
  const { saveAttachment, removeAttachment } = usePreviewAttachments();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  async function pick(source: ChatAttachmentSource): Promise<void> {
    if (locked.current) return;
    if ((chat.attachments?.length ?? 0) >= 5) { setError('You can attach up to five files per message.'); return; }
    locked.current = true;
    setBusy(true);
    setError(null);
    try {
      let input: AttachmentInput;
      if (source === 'files') {
        const result = await DocumentPicker.getDocumentAsync({ type: [...ACCEPTED_NOTE_MIMES], multiple: false, copyToCacheDirectory: true });
        if (result.canceled) return;
        const asset = result.assets[0];
        input = { uri: asset.uri, name: asset.name, mimeType: asset.mimeType, sizeBytes: asset.size, file: asset.file };
      } else {
        if (source === 'camera') {
          const permission = await ImagePicker.requestCameraPermissionsAsync();
          if (!permission.granted) throw new Error('Camera access is needed to take a photo. You can choose Photos or Files instead.');
        }
        const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.85 };
        const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
        if (result.canceled) return;
        const asset = result.assets[0];
        input = { uri: asset.uri, name: asset.fileName ?? `photo-${Date.now()}.jpg`, mimeType: asset.mimeType ?? 'image/jpeg', sizeBytes: asset.fileSize, file: asset.file };
      }
      if (!mounted.current) return;
      if (!isAcceptedNotesFile(input.name, input.mimeType)) throw new Error('Choose a photo, PDF, or Word document.');
      if (!isWithinSizeLimit(input.sizeBytes)) throw new Error('Choose a file smaller than 10 MB.');
      const attachment = await saveAttachment(input);
      if (!mounted.current) return;
      setChat((current) => ({ ...current, attachments: [...(current.attachments ?? []), attachment] }));
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : 'Could not select this file. Please try again.');
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function remove(id: string): Promise<void> {
    try {
      await removeAttachment(id);
      if (mounted.current) setChat((current) => ({ ...current, attachments: (current.attachments ?? []).filter((file) => file.id !== id) }));
    } catch { if (mounted.current) setError('Could not remove this attachment. Please try again.'); }
  }
  return { attachments: chat.attachments ?? [], busy, error, pick, remove };
}
