import { confirmAction } from '@/lib/confirm-action';

export function confirmDeletePost(
  options: Readonly<{ isWelcomePost?: boolean; onConfirm: () => void }>,
): void {
  void confirmAction(
    'Delete local post',
    options.isWelcomePost
      ? 'Remove this welcome guide from your feed?'
      : 'Delete this post from this device?',
    'Delete',
  ).then((confirmed) => { if (confirmed) options.onConfirm(); });
}
