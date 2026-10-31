import { usePreviewFeature } from '@/components/preview/preview-provider';

type CommunityDraft = { title: string; body: string; subjectTag: string; linkUrl: string; groupId: string };
const EMPTY_DRAFT: CommunityDraft = { title: '', body: '', subjectTag: 'General', linkUrl: '', groupId: '' };

export function useCommunityStore() {
  const [draftPost, setDraft] = usePreviewFeature('community-post-draft', EMPTY_DRAFT);
  return { draftPost, setDraftPost: (patch: Partial<CommunityDraft>) => setDraft((current) => ({ ...current, ...patch })), clearDraftPost: () => setDraft(EMPTY_DRAFT) };
}
