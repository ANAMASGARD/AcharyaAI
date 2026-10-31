import { create } from 'zustand';
import type { CommunityComment, CommunityGroup, CommunityGroupDetail, CommunityPost, GroupMessage } from '@/types/community';

export type CommunityFeedPage = { ids: string[]; nextCursor: string | null; hasMore: boolean };
export type CommunityCache = {
  owner: string | null;
  invalidationRevision: number;
  posts: CommunityPost[];
  groups: CommunityGroup[];
  comments: Record<string, CommunityComment[]>;
  messages: Record<string, GroupMessage[]>;
  groupDetails: Record<string, CommunityGroupDetail>;
  feeds: Record<string, CommunityFeedPage>;
  blockedAuthors: Record<string, true>;
  deniedGroups: Record<string, true>;
  deniedPosts: Record<string, true>;
  revokedImages: Record<string, true>;
};
export type CommunityInvalidation = { postId?: string; groupId?: string; clerkId?: string; imageId?: string; commentId?: string; messageId?: string };
type RemoteState = CommunityCache & {
  setOwner: (owner: string | null) => void;
  update: (owner: string, update: (state: RemoteState) => Partial<RemoteState>) => void;
  invalidate: (owner: string, target: CommunityInvalidation) => void;
};
const empty = () => ({ invalidationRevision: 0, posts: [], groups: [], comments: {}, messages: {}, groupDetails: {}, feeds: {}, blockedAuthors: {}, deniedGroups: {}, deniedPosts: {}, revokedImages: {} });
export function communityFeedKey(groupId: string | null | undefined, limit: number): string { return JSON.stringify([groupId ?? null,limit]); }
export function applyCommunityFeedPage(state: Pick<CommunityCache,'posts' | 'feeds' | 'deniedPosts' | 'deniedGroups'>, key: string, response: { posts: CommunityPost[]; nextCursor: string | null; hasMore: boolean }, append: boolean): Pick<CommunityCache,'posts' | 'feeds' | 'deniedPosts' | 'deniedGroups'> {
  const posts = new Map(state.posts.map(post => [post.postId,post]));
  response.posts.forEach(post => posts.set(post.postId,post));
  const ids = [...new Set([...(append ? state.feeds[key]?.ids ?? [] : []),...response.posts.map(post => post.postId)])];
  const restoredIds = new Set(response.posts.map(post => post.postId));
  const [groupId] = JSON.parse(key) as [string | null,number];
  return { posts: [...posts.values()], deniedPosts: Object.fromEntries(Object.entries(state.deniedPosts).filter(([id]) => !restoredIds.has(id))), deniedGroups: groupId ? Object.fromEntries(Object.entries(state.deniedGroups).filter(([id]) => id !== groupId)) : state.deniedGroups, feeds: { ...state.feeds, [key]: { ids, nextCursor: response.nextCursor, hasMore: response.hasMore } } };
}
/** Remove revoked resources and prevent older in-flight responses from resurrecting them. */
export function sanitizeCommunityCache(state: CommunityCache): CommunityCache {
  const revokedImages = { ...state.revokedImages };
  const postIds = new Set(state.posts.filter(post => !state.deniedPosts[post.postId] && !state.blockedAuthors[post.authorClerkId] && !(post.groupId && state.deniedGroups[post.groupId])).map(post => post.postId));
  for (const post of state.posts) if (!postIds.has(post.postId)) post.images?.forEach(image => { revokedImages[image.imageId] = true; });
  const messages = Object.fromEntries(Object.entries(state.messages).filter(([id]) => !state.deniedGroups[id]).map(([id,items]) => [id,items.filter(message => {
    if (!state.blockedAuthors[message.authorClerkId]) return true;
    message.images?.forEach(image => { revokedImages[image.imageId] = true; }); return false;
  })]));
  for (const [id,items] of Object.entries(state.messages)) if (state.deniedGroups[id]) items.forEach(message => message.images?.forEach(image => { revokedImages[image.imageId] = true; }));
  return { ...state, posts: state.posts.filter(post => postIds.has(post.postId)), groups: state.groups.filter(group => !state.deniedGroups[group.groupId]),
    groupDetails: Object.fromEntries(Object.entries(state.groupDetails).filter(([id]) => !state.deniedGroups[id])),
    comments: Object.fromEntries(Object.entries(state.comments).filter(([id]) => postIds.has(id)).map(([id,items]) => [id,items.filter(comment => !state.blockedAuthors[comment.authorClerkId])])),
    messages, feeds: Object.fromEntries(Object.entries(state.feeds).map(([key,page]) => [key,{ ...page, ids: page.ids.filter(id => postIds.has(id)) }])), revokedImages };
}
export function invalidateCommunityCache(state: CommunityCache, target: CommunityInvalidation): CommunityCache {
  let next = { ...state, invalidationRevision: state.invalidationRevision + 1, revokedImages: { ...state.revokedImages }, blockedAuthors: { ...state.blockedAuthors }, deniedGroups: { ...state.deniedGroups }, deniedPosts: { ...state.deniedPosts } };
  if (target.imageId) next.revokedImages[target.imageId] = true;
  if (target.groupId) next.deniedGroups[target.groupId] = true;
  if (target.clerkId) next.blockedAuthors[target.clerkId] = true;
  if (target.postId) {
    next.deniedPosts[target.postId] = true;
    state.posts.find(post => post.postId === target.postId)?.images?.forEach(image => { next.revokedImages[image.imageId] = true; });
    next.posts = state.posts.filter(post => post.postId !== target.postId);
  }
  if (target.commentId) next.comments = Object.fromEntries(Object.entries(state.comments).map(([id,items]) => [id,items.filter(comment => comment.commentId !== target.commentId)]));
  if (target.messageId) next.messages = Object.fromEntries(Object.entries(state.messages).map(([id,items]) => [id,items.filter(message => {
    if (message.messageId !== target.messageId) return true;
    message.images?.forEach(image => { next.revokedImages[image.imageId] = true; }); return false;
  })]));
  next = sanitizeCommunityCache(next);
  return next;
}
export const useCommunityRemoteStore = create<RemoteState>((set) => ({ owner: null, ...empty(),
  setOwner: owner => set(state => state.owner === owner ? state : { ...empty(), owner }),
  update: (owner, update) => set(state => state.owner === owner ? sanitizeCommunityCache({ ...state, ...update(state) }) : state),
  invalidate: (owner,target) => set(state => state.owner === owner ? invalidateCommunityCache(state,target) : state),
}));
