import { usePreviewFeature } from '@/components/preview/preview-provider';

type CommunityDraft = { postId?: string; title: string; body: string; subjectTag: string; linkUrl: string; groupId: string };
const EMPTY_DRAFT: CommunityDraft = { postId: '', title: '', body: '', subjectTag: 'General', linkUrl: '', groupId: '' };

export function useCommunityStore(draftKey = 'community-post-draft') {
  const [draftPost, setDraft] = usePreviewFeature(draftKey, EMPTY_DRAFT);
  return { draftPost, setDraftPost: (patch: Partial<CommunityDraft>) => setDraft((current) => ({ ...current, ...patch })), clearDraftPost: () => setDraft(EMPTY_DRAFT) };
}
