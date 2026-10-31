import { usePreviewFeature } from '@/components/preview/preview-provider';
import { createId } from '@/lib/id';
import type { CommunityComment, CommunityGroupDetail, CommunityPost, CommunityPostImageDraft, CreateGroupInput, GroupMessage, VoteValue } from '@/types/community';
import { useUser } from '@clerk/expo';

type CommunityPreview = { posts: CommunityPost[]; groups: CommunityGroupDetail[]; comments: Record<string, CommunityComment[]>; messages: Record<string, GroupMessage[]> };
const INITIAL: CommunityPreview = { posts: [], groups: [], comments: {}, messages: {} };

/** Local drafts only; this module has no transport or remote publication operation. */
export function useCommunityPreview() {
  const [state, setState] = usePreviewFeature('community', INITIAL);
  const { user } = useUser();
  const authorClerkId = user?.id ?? '';
  const updatePost = (id: string, update: (post: CommunityPost) => CommunityPost) => {
    setState((current) => ({ ...current, posts: current.posts.map((post) => post.postId === id ? update(post) : post) }));
  };
  const setVote = async (id: string, value: VoteValue | null) => updatePost(id, (post) => ({ ...post, viewerVote: value, score: post.score - (post.viewerVote ?? 0) + (value ?? 0) }));
  return {
    state,
    votePost: (id: string, value: VoteValue) => setVote(id, value),
    removeVote: (id: string) => setVote(id, null),
    toggleSave: async (id: string, save: boolean) => updatePost(id, (post) => ({ ...post, viewerSaved: save })),
    deletePost: async (id: string) => setState((current) => ({ ...current, posts: current.posts.filter((post) => post.postId !== id), comments: Object.fromEntries(Object.entries(current.comments).filter(([postId]) => postId !== id)) })),
    createPost: async (input: { title: string; body: string; subjectTag: string; linkUrl?: string; displayName: string; images: readonly CommunityPostImageDraft[] }) => {
      const post: CommunityPost = {
        postId: createId(), title: input.title.trim(), body: input.body.trim(), subjectTag: input.subjectTag,
        linkUrl: input.linkUrl?.trim() || null, images: input.images.map((image, index) => ({ ...image, imageId: image.id ?? createId(), fileName: image.name, sortOrder: index })),
        demoSeed: false, demoWelcome: false, score: 0, commentCount: 0, createdAt: new Date().toISOString(),
        authorClerkId, authorDisplayName: input.displayName, authorAvatarLetter: input.displayName.charAt(0), authorImageUrl: user?.imageUrl ?? null,
        groupId: null, groupName: null, viewerVote: null, viewerSaved: false,
      };
      setState((current) => ({ ...current, posts: [post, ...current.posts] }));
      return post;
    },
    addComment: async (postId: string, body: string, displayName: string) => {
      const comment: CommunityComment = { commentId: createId(), body: body.trim(), createdAt: new Date().toISOString(), authorClerkId, authorDisplayName: displayName, authorAvatarLetter: displayName.charAt(0) };
      setState((current) => ({ ...current, comments: { ...current.comments, [postId]: [...(current.comments[postId] ?? []), comment] }, posts: current.posts.map((post) => post.postId === postId ? { ...post, commentCount: post.commentCount + 1 } : post) }));
    },
    createGroup: async (input: CreateGroupInput) => {
      const groupId = createId();
      const group: CommunityGroupDetail = { groupId, name: input.name.trim(), description: input.description.trim(), subjectTag: input.subjectTag ?? null,
        joinCode: groupId.slice(0, 6).toUpperCase(), createdAt: new Date().toISOString(), memberCount: 1, isMember: true,
        members: [{ clerkId: authorClerkId, displayName: input.displayName, avatarLetter: input.displayName.charAt(0), role: 'owner', joinedAt: new Date().toISOString() }] };
      setState((current) => ({ ...current, groups: [group, ...current.groups] }));
      return group;
    },
    joinGroup: async (code: string) => {
      const group = state.groups.find((item) => item.joinCode.toUpperCase() === code.trim().toUpperCase());
      if (!group) throw new Error('No local group draft has this code. Online groups are not connected yet.');
      return group;
    },
    sendGroupMessage: async (groupId: string, body: string, displayName: string, linkUrl?: string | null) => {
      const message: GroupMessage = { messageId: createId(), body: body.trim(), linkUrl: linkUrl?.trim() || null, createdAt: new Date().toISOString(), authorClerkId, authorDisplayName: displayName, authorAvatarLetter: displayName.charAt(0) };
      setState((current) => ({ ...current, messages: { ...current.messages, [groupId]: [...(current.messages[groupId] ?? []), message] } }));
    },
  };
}
