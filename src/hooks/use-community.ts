import { useAuth } from '@clerk/expo';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { assertCommunitySession, cancelCommunityRequests, communityAccessDenied, communityCreation, communityRequest, mergeCommunityItems, uploadCommunityImages, type CommunitySession } from '@/lib/community/client';
import { useCommunityRemoteStore } from '@/store/community-remote-store';
import type { CommunityComment, CommunityGroup, CommunityGroupDetail, CommunityPost, CommunityPostImageDraft, CommunityModerationReport, CreateGroupInput, GroupMessage, VoteValue } from '@/types/community';

const EMPTY = { feeds: {}, posts: [] as CommunityPost[], groups: [] as CommunityGroup[], comments: {} as Record<string, CommunityComment[]>, messages: {} as Record<string, GroupMessage[]> };
export type CommunityPostPage = { posts: CommunityPost[]; nextCursor: string | null; hasMore: boolean; count: number };
export type CommunityMessagePage = { messages: GroupMessage[]; nextCursor: string | null; hasMore: boolean };
export type CommunityPostDetailPage = { post: CommunityPost; comments: CommunityComment[]; nextCursor: string | null; hasMore: boolean };
export type RemoteCreatePostInput = { postId?: string; title: string; body: string; subjectTag: string; linkUrl?: string | null; groupId?: string | null; displayName: string; images?: readonly CommunityPostImageDraft[] };
export type CommunityReportInput = { targetType: 'post' | 'comment' | 'message'; targetId: string; reason: string; groupId?: string };

function activate(owner: string | null): void {
  const store = useCommunityRemoteStore.getState();
  if (store.owner !== owner) { cancelCommunityRequests(); store.setOwner(owner); }
}
export function CommunityLifecycle(): null {
  const { userId } = useAuth();
  useEffect(() => { activate(userId ?? null); }, [userId]);
  useEffect(() => () => { activate(null); }, []);
  return null;
}
export function useCommunitySession(): CommunitySession | null {
  const { userId, getToken } = useAuth();
  const owner = userId ?? null;
  const tokenProvider = useRef(getToken);
  const activeSession = useRef<CommunitySession | null>(null);
  // Clerk's Expo token callback changes each render. Keep the session stable
  // while using the latest committed callback for token refreshes.
  useLayoutEffect(() => { tokenProvider.current = getToken; }, [getToken]);
  const session = useMemo(() => {
    if (!owner) return null;
    const current: CommunitySession = { owner, getToken: () => tokenProvider.current(),
      isCurrent: () => activeSession.current === current && useCommunityRemoteStore.getState().owner === owner };
    return current;
  }, [owner]);
  useLayoutEffect(() => {
    activeSession.current = session; activate(owner);
    return () => { activeSession.current = null; };
  }, [owner, session]);
  return session;
}
export function useCommunity() {
  const session = useCommunitySession();
  const remote = useCommunityRemoteStore();
  const state = session && remote.owner === session.owner ? remote : EMPTY;
  const methods = useMemo(() => {
    const requireSession = () => { if (!session) throw new Error('Sign in to use the community.'); assertCommunitySession(session); return session; };
    const invalidate = (target: Parameters<ReturnType<typeof useCommunityRemoteStore.getState>['invalidate']>[1]) => {
      const current = requireSession(); useCommunityRemoteStore.getState().invalidate(current.owner,target);
    };
    const request = async <T,>(path: string, options?: Parameters<typeof communityRequest>[2]): Promise<T> => {
      const revision = useCommunityRemoteStore.getState().invalidationRevision;
      try {
        const result = await communityRequest<T>(requireSession(),path,options);
        if (useCommunityRemoteStore.getState().invalidationRevision !== revision) throw new Error('Community access changed. Please refresh and retry.');
        if (options?.method === 'DELETE' && path.startsWith('/blocks/')) {
          const clerkId = decodeURIComponent(path.slice('/blocks/'.length));
          useCommunityRemoteStore.getState().update(requireSession().owner,current => ({ blockedAuthors: Object.fromEntries(Object.entries(current.blockedAuthors).filter(([id]) => id !== clerkId)) }));
        }
        return result;
      }
      catch (cause) {
        if (session?.isCurrent() && communityAccessDenied(cause)) {
          const url = new URL(`https://community.invalid${path}`);
          const parts = url.pathname.split('/').filter(Boolean);
          if ((!options?.method || options.method === 'GET') && parts[0] === 'groups' && parts[1] && parts[1] !== 'join') invalidate({ groupId: parts[1] });
          if (parts[0] === 'posts' && parts[1]) {
            const post = useCommunityRemoteStore.getState().posts.find(item => item.postId === parts[1]);
            invalidate({ postId: parts[1], ...(post?.groupId && 'status' in cause && cause.status === 403 ? { groupId: post.groupId } : {}) });
          }
          if (parts[0] === 'posts' && url.searchParams.has('groupId')) invalidate({ groupId: url.searchParams.get('groupId')! });
          if (parts[0] === 'images' && parts[1]) {
            const cache = useCommunityRemoteStore.getState();
            const groupId = cache.posts.find(post => post.images?.some(image => image.imageId === parts[1]))?.groupId ?? Object.entries(cache.messages).find(([,messages]) => messages.some(message => message.images?.some(image => image.imageId === parts[1])))?.[0];
            invalidate({ imageId: parts[1], ...(cause.status === 403 && groupId ? { groupId } : {}) });
          }
        }
        throw cause;
      }
    };
    const update = (fn: Parameters<ReturnType<typeof useCommunityRemoteStore.getState>['update']>[1]) => { const current = requireSession(); useCommunityRemoteStore.getState().update(current.owner, fn); };
    const moderationReports = new Map<string,CommunityModerationReport>();
    const putPost = (post: CommunityPost, published = false) => update(current => ({
      deniedPosts: Object.fromEntries(Object.entries(current.deniedPosts).filter(([id]) => id !== post.postId)),
      posts: mergeCommunityItems(current.posts,[post],item => item.postId).sort((a,b) => b.createdAt.localeCompare(a.createdAt)),
      ...(published ? { feeds: Object.fromEntries(Object.entries(current.feeds).map(([key,page]) => {
        const [groupId] = JSON.parse(key) as [string | null,number];
        return [key, groupId === post.groupId ? { ...page, ids: [post.postId,...page.ids.filter(id => id !== post.postId)] } : page];
      })) } : {}),
    }));
    const putGroup = (group: CommunityGroupDetail) => update(current => ({ deniedGroups: Object.fromEntries(Object.entries(current.deniedGroups).filter(([id]) => id !== group.groupId)), groups: mergeCommunityItems(current.groups, [group], item => item.groupId), groupDetails: { ...current.groupDetails, [group.groupId]: group } }));
    return {
      request,
      createPost: (input: RemoteCreatePostInput) => communityCreation(requireSession(), 'post', input, async postId => {
        const images = await uploadCommunityImages(requireSession(), input.images ?? [], postId, input.groupId);
        const result = await request<{ post: CommunityPost }>('/posts', { method: 'POST', body: { ...input, postId, images } });
        if (result.post?.postId !== postId) throw new Error('Post acknowledgement was invalid. Please retry your draft.');
        putPost(result.post,true); return result.post;
      }, input.postId),
      votePost: async (postId: string, value: VoteValue) => {
        const result = await request<{ score: number; viewerVote: VoteValue | null }>(`/posts/${postId}/vote`, { method: 'PUT', body: { value } });
        if (!Number.isFinite(result.score) || ![1,-1,null].includes(result.viewerVote)) throw new Error('Invalid vote acknowledgement.');
        update(current => ({ posts: current.posts.map(post => post.postId === postId ? { ...post, ...result } : post) }));
      },
      removeVote: async (postId: string) => {
        const result = await request<{ score: number; viewerVote: VoteValue | null }>(`/posts/${postId}/vote`, { method: 'PUT', body: { value: null } });
        if (!Number.isFinite(result.score) || result.viewerVote !== null) throw new Error('Invalid vote acknowledgement.');
        update(current => ({ posts: current.posts.map(post => post.postId === postId ? { ...post, ...result } : post) }));
      },
      toggleSave: async (postId: string, save: boolean) => {
        const result = await request<{ viewerSaved: boolean }>(`/posts/${postId}/save`, { method: 'PUT', body: { save } });
        if (result.viewerSaved !== save) throw new Error('Invalid saved-post acknowledgement.');
        update(current => ({ posts: current.posts.map(post => post.postId === postId ? { ...post, viewerSaved: result.viewerSaved } : post) }));
      },
      deletePost: async (postId: string) => {
        await request(`/posts/${postId}`, { method: 'DELETE' });
        invalidate({ postId });
      },
      addComment: (postId: string, body: string, displayName: string, commentId?: string) => communityCreation(requireSession(), `comment:${postId}`, { body, displayName }, async commentId => {
        const result = await request<{ comment: CommunityComment }>(`/posts/${postId}/comments`, { method: 'POST', body: { commentId, body, displayName } });
        if (result.comment?.commentId !== commentId) throw new Error('Comment acknowledgement was invalid. Please retry.');
        update(current => {
          const previous = current.comments[postId] ?? [];
          const exists = previous.some(comment => comment.commentId === commentId);
          return { comments: { ...current.comments, [postId]: mergeCommunityItems(previous, [result.comment], item => item.commentId) },
            posts: current.posts.map(post => post.postId === postId && !exists ? { ...post, commentCount: post.commentCount + 1 } : post) };
        }); return result.comment;
      }, commentId),
      getPost: async (postId: string, cursor?: string | null, signal?: AbortSignal) => {
        const result = await request<CommunityPostDetailPage>(`/posts/${postId}${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, { signal });
        putPost(result.post);
        update(current => ({ comments: { ...current.comments, [postId]: cursor ? mergeCommunityItems(current.comments[postId] ?? [], result.comments, item => item.commentId) : result.comments } }));
        return result;
      },
      createGroup: (input: CreateGroupInput & { groupId?: string }) => communityCreation(requireSession(), 'group', input, async groupId => {
        const result = await request<{ group: CommunityGroupDetail }>('/groups', { method: 'POST', body: { ...input, groupId } });
        if (result.group?.groupId !== groupId) throw new Error('Group acknowledgement was invalid. Please retry.');
        putGroup(result.group); return result.group;
      }, input.groupId),
      joinGroup: async (code: string, displayName = 'Teacher') => {
        const result = await request<{ group: CommunityGroupDetail }>('/groups/join', { method: 'POST', body: { code: code.trim(), displayName } });
        putGroup(result.group); return result.group;
      },
      getGroup: async (groupId: string, signal?: AbortSignal) => {
        const result = await request<{ group: CommunityGroupDetail }>(`/groups/${groupId}`, { signal }); putGroup(result.group); return result.group;
      },
      sendGroupMessage: (groupId: string, body: string, displayName: string, linkUrl?: string | null, images: readonly CommunityPostImageDraft[] = [], explicitMessageId?: string) => communityCreation(requireSession(), `message:${groupId}`, { body, displayName, linkUrl, images }, async messageId => {
        const uploaded = await uploadCommunityImages(requireSession(), images, messageId, groupId);
        const result = await request<{ message: GroupMessage }>(`/groups/${groupId}/messages`, { method: 'POST', body: { messageId, body, displayName, linkUrl, images: uploaded } });
        if (result.message?.messageId !== messageId) throw new Error('Message acknowledgement was invalid. Your draft is safe.');
        update(current => ({ messages: { ...current.messages, [groupId]: mergeCommunityItems(current.messages[groupId] ?? [], [result.message], item => item.messageId).sort((a,b) => a.createdAt.localeCompare(b.createdAt) || a.messageId.localeCompare(b.messageId)) } }));
        return result.message;
      }, explicitMessageId),
      deleteMessage: async (groupId: string, messageId: string) => {
        await request(`/groups/${groupId}/messages/${messageId}`, { method: 'DELETE' });
        invalidate({ messageId });
      },
      removeMember: async (groupId: string, clerkId: string) => {
        await request(`/groups/${groupId}/members/${encodeURIComponent(clerkId)}`, { method: 'DELETE' });
        const result = await request<{ group: CommunityGroupDetail }>(`/groups/${groupId}`); putGroup(result.group);
      },
      imageUrl: async (imageId: string, width: 360 | 900 | 1600 = 900) => {
        const result = await request<{ url: string; expiresAt: string }>(`/images/${imageId}?width=${width}`);
        if (typeof result.url !== 'string' || !result.url.startsWith('https://') || !Number.isFinite(new Date(result.expiresAt).getTime()) || new Date(result.expiresAt).getTime() <= Date.now()) throw new Error('Photo access expired. Please refresh.');
        update(current => ({ revokedImages: Object.fromEntries(Object.entries(current.revokedImages).filter(([id]) => id !== imageId)) })); return result;
      },
      report: (targetType: CommunityReportInput['targetType'], targetId: string, reason: string) => { const input = { targetType, targetId, reason }; return communityCreation(requireSession(), 'report', input, reportId => request('/reports', { method: 'POST', body: { ...input, reportId } })); },
      block: async (clerkId: string) => {
        await request(`/blocks/${encodeURIComponent(clerkId)}`, { method: 'PUT', body: {} });
        invalidate({ clerkId });
      },
      getModeration: async () => { const result = await request<{ reports: readonly CommunityModerationReport[] }>('/moderation'); result.reports.forEach(report => moderationReports.set(report.reportId,report)); return result; },
      resolveReport: async (reportId: string, action: 'dismiss' | 'remove') => {
        const result = await request(`/moderation/${reportId}`, { method: 'POST', body: { action } });
        const report = moderationReports.get(reportId);
        if (action === 'remove' && report) invalidate({ ...(report.targetType === 'post' ? { postId: report.targetId } : report.targetType === 'comment' ? { commentId: report.targetId } : { messageId: report.targetId }) });
        return result;
      },
    };
  }, [session]);
  return { state, ...methods };
}

export function useCommunityPost(postId: string) {
  const { state, getPost } = useCommunity();
  const [status, setStatus] = useState({ owner: '', postId: '', loading: false, error: null as string | null, nextCursor: null as string | null, hasMore: false });
  const session = useCommunitySession();
  const generation = useRef(0);
  useLayoutEffect(() => { generation.current++; }, [postId, session]);
  const refresh = useCallback(async (cursor?: string | null, signal?: AbortSignal) => {
    const version = ++generation.current;
    if (!session) return;
    setStatus(current => current.owner === session.owner && current.postId === postId ? { ...current, loading: true, error: null } : { owner: session.owner, postId, loading: true, error: null, nextCursor: null, hasMore: false });
    try {
      const result = await getPost(postId,cursor,signal);
      if (session.isCurrent() && version === generation.current && !signal?.aborted) setStatus({ owner: session.owner, postId, loading: false, error: null, nextCursor: result.nextCursor, hasMore: result.hasMore });
    } catch (cause) { if (session.isCurrent() && version === generation.current && !signal?.aborted) setStatus(current => ({ ...current, loading: false, error: cause instanceof Error ? cause.message : 'Could not load this post.' })); }
  }, [getPost, postId, session]);
  useFocusEffect(useCallback(() => { const controller = new AbortController(); void refresh(undefined,controller.signal); return () => controller.abort(); }, [refresh]));
  const current = status.owner === session?.owner && status.postId === postId;
  return { post: state.posts.find(post => post.postId === postId) ?? null, comments: state.comments[postId] ?? [], isLoading: current && status.loading,
    error: current ? status.error : null, refresh: () => refresh(), hasMore: current && status.hasMore, loadMore: () => current && status.hasMore && !status.loading ? refresh(status.nextCursor) : Promise.resolve() };
}
export function useCommunityGroup(groupId: string) {
  const { getGroup } = useCommunity();
  const session = useCommunitySession();
  const [status, setStatus] = useState({ owner: '', groupId: '', loading: false, error: null as string | null });
  const generation = useRef(0);
  useLayoutEffect(() => { generation.current++; }, [groupId,session]);
  const group = useCommunityRemoteStore(state => session && state.owner === session.owner ? state.groupDetails[groupId] : undefined);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const version = ++generation.current;
    if (!session) return;
    setStatus({ owner: session.owner, groupId, loading: true, error: null });
    try { await getGroup(groupId,signal); if (session.isCurrent() && version === generation.current && !signal?.aborted) setStatus({ owner: session.owner, groupId, loading: false, error: null }); }
    catch (cause) { if (session.isCurrent() && version === generation.current && !signal?.aborted) setStatus({ owner: session.owner, groupId, loading: false, error: cause instanceof Error ? cause.message : 'Could not load this group.' }); }
  }, [getGroup, groupId, session]);
  useFocusEffect(useCallback(() => { const controller = new AbortController(); void refresh(controller.signal); return () => controller.abort(); }, [refresh]));
  const current = status.owner === session?.owner && status.groupId === groupId;
  return { group: group ?? null, isLoading: current && status.loading, error: current ? status.error : null, refresh: () => refresh() };
}
export function useCommunityImage(imageId: string, width: 360 | 900 | 1600 = 900) {
  const { imageUrl } = useCommunity();
  const session = useCommunitySession();
  const [image, setImage] = useState<{ owner: string; imageId: string; uri: string; expiresAt: string } | null>(null);
  const [failure, setFailure] = useState<{ owner: string; imageId: string; message: string } | null>(null);
  const revoked = useCommunityRemoteStore(state => !!(session && state.owner === session.owner && state.revokedImages[imageId]));
  const generation = useRef(0);
  useLayoutEffect(() => { generation.current++; }, [imageId,width,session]);
  const refresh = useCallback(async () => {
    if (!session) return;
    const version = ++generation.current;
    try { const result = await imageUrl(imageId,width); if (session.isCurrent() && version === generation.current) { setImage({ owner: session.owner, imageId, uri: result.url, expiresAt: result.expiresAt }); setFailure(null); } }
    catch (cause) { if (session.isCurrent() && version === generation.current) { setImage(null); setFailure({ owner: session.owner, imageId, message: cause instanceof Error ? cause.message : 'Could not load photo.' }); } }
  }, [imageId, imageUrl, session, width]);
  useEffect(() => { let active = true; void Promise.resolve().then(() => { if (active) void refresh(); }); return () => { active = false; }; }, [refresh]);
  useEffect(() => { if (!image || image.owner !== session?.owner) return; const delay = new Date(image.expiresAt).getTime() - Date.now() - 30_000; if (!Number.isFinite(delay)) return; const timer = setTimeout(() => { void refresh(); }, Math.max(10_000,delay)); return () => clearTimeout(timer); }, [image, refresh, session?.owner]);
  useEffect(() => {
    if (!image) return;
    const expiresAt = new Date(image.expiresAt).getTime();
    if (!Number.isFinite(expiresAt)) return;
    const timer = setTimeout(() => { setImage(current => current?.expiresAt === image.expiresAt && current.imageId === image.imageId ? null : current); },Math.max(0,expiresAt-Date.now()));
    return () => clearTimeout(timer);
  }, [image]);
  const uri = !revoked && image?.owner === session?.owner && image?.imageId === imageId ? image.uri : null;
  const error = failure?.owner === session?.owner && failure?.imageId === imageId ? failure?.message ?? null : revoked ? 'Photo is no longer available. Refresh to check access again.' : null;
  return { uri, isLoading: !uri && !error, error, refresh };
}
