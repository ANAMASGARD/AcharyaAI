import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { useCommunity, useCommunitySession, type CommunityPostPage } from '@/hooks/use-community';
import { applyCommunityFeedPage, communityFeedKey, useCommunityRemoteStore } from '@/store/community-remote-store';

export function useCommunityFeed(options: { limit?: number; groupId?: string | null; autoFetch?: boolean } = {}) {
  const community = useCommunity();
  const { request } = community;
  const session = useCommunitySession();
  const [status, setStatus] = useState({ owner: '', key: '', hasFetched: false, isLoading: false, error: null as string | null });
  const flight = useRef<object | null>(null);
  const limit = Math.min(50,Math.max(1,options.limit ?? 20));
  const groupId = options.groupId ?? null;
  const key = communityFeedKey(groupId,limit);
  const page = useCommunityRemoteStore(state => session && state.owner === session.owner ? state.feeds[key] : undefined);
  const refresh = useCallback(async (cursor?: string | null, signal?: AbortSignal) => {
    if (!session || flight.current || signal?.aborted) return;
    const requestId = {}; flight.current = requestId;
    setStatus({ owner: session.owner, key, hasFetched: false, isLoading: true, error: null });
    try {
      const query = new URLSearchParams({ limit: String(limit) });
      if (groupId) query.set('groupId',groupId);
      if (cursor) query.set('cursor',cursor);
      const response = await request<CommunityPostPage>(`/posts?${query}`, { signal });
      if (!Array.isArray(response.posts) || (response.hasMore && !response.nextCursor)) throw new Error('Invalid community feed page.');
      if (!session.isCurrent() || flight.current !== requestId || signal?.aborted) return;
      useCommunityRemoteStore.getState().update(session.owner,current => applyCommunityFeedPage(current,key,response,!!cursor));
      setStatus({ owner: session.owner, key, hasFetched: true, isLoading: false, error: null });
    } catch (cause) {
      if (session.isCurrent() && flight.current === requestId && !signal?.aborted) setStatus({ owner: session.owner, key, hasFetched: true, isLoading: false, error: cause instanceof Error ? cause.message : 'Could not load the community.' });
    } finally { if (flight.current === requestId) flight.current = null; }
  }, [request,groupId,key,limit,session]);
  useFocusEffect(useCallback(() => {
    const controller = new AbortController(); flight.current = null;
    if (options.autoFetch !== false) void refresh(undefined,controller.signal);
    return () => { controller.abort(); flight.current = null; };
  }, [options.autoFetch,refresh]));
  const current = status.owner === session?.owner && status.key === key;
  const ids = new Set(page?.ids ?? []);
  const posts = community.state.posts.filter(post => ids.has(post.postId)).sort((a,b) => b.createdAt.localeCompare(a.createdAt) || b.postId.localeCompare(a.postId));
  return { ...community, posts, isLoading: current && status.isLoading, hasFetched: current && status.hasFetched, error: current ? status.error : null,
    refresh: () => refresh(), hasMore: page?.hasMore ?? false, loadMore: () => page?.hasMore && !(current && status.isLoading) ? refresh(page.nextCursor) : Promise.resolve() };
}
