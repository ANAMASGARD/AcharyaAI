import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useCommunity, useCommunitySession, type CommunityMessagePage } from '@/hooks/use-community';
import { mergeCommunityItems } from '@/lib/community/client';
import { useCommunityRemoteStore } from '@/store/community-remote-store';
import type { CreateGroupMessageInput } from '@/types/community';

export function useGroupChat(groupId: string) {
  const community = useCommunity();
  const { request } = community;
  const session = useCommunitySession();
  const flight = useRef<object | null>(null);
  const [status, setStatus] = useState({ owner: '', groupId: '', isLoading: false, error: null as string | null, cursor: null as string | null, hasMore: false, hasFetched: false });
  const refresh = useCallback(async (cursor?: string | null, signal?: AbortSignal) => {
    if (!session || flight.current || signal?.aborted) return;
    const requestId = {};
    flight.current = requestId;
    setStatus(current => current.owner === session.owner && current.groupId === groupId ? { ...current, isLoading: !current.hasFetched, error: null } : { owner: session.owner, groupId, isLoading: true, error: null, cursor: null, hasMore: false, hasFetched: false });
    try {
      const result = await request<CommunityMessagePage>(`/groups/${groupId}/messages?limit=30${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, { signal });
      if (!session.isCurrent() || signal?.aborted || flight.current !== requestId) return;
      if (!Array.isArray(result.messages) || (result.hasMore && !result.nextCursor)) throw new Error('Invalid chat page.');
      useCommunityRemoteStore.getState().update(session.owner, current => {
        const previous = current.messages[groupId] ?? [];
        const oldest = result.messages[0];
        // Latest-page refresh also removes content deleted or hidden since the last poll.
        const retained = cursor ? previous : result.hasMore && oldest ? previous.filter(message => message.createdAt < oldest.createdAt || (message.createdAt === oldest.createdAt && message.messageId < oldest.messageId)) : [];
        return { messages: { ...current.messages, [groupId]: mergeCommunityItems(retained, result.messages, message => message.messageId).sort((a,b) => a.createdAt.localeCompare(b.createdAt) || a.messageId.localeCompare(b.messageId)) } };
      });
      setStatus(current => ({ owner: session.owner, groupId, isLoading: false, error: null, hasFetched: true,
        cursor: cursor || current.groupId !== groupId || current.owner !== session.owner || !current.hasFetched ? result.nextCursor : current.cursor, hasMore: cursor || current.groupId !== groupId || current.owner !== session.owner || !current.hasFetched ? result.hasMore : current.hasMore }));
    } catch (cause) { if (session.isCurrent() && !signal?.aborted && flight.current === requestId) setStatus(current => ({ ...current, isLoading: false, error: cause instanceof Error ? cause.message : 'Could not load group chat.' })); }
    finally { if (flight.current === requestId) flight.current = null; }
  }, [request, groupId, session]);
  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    flight.current = null;
    const poll = () => { if (AppState.currentState === 'active') void refresh(undefined, controller.signal); };
    poll();
    const timer = setInterval(poll, 5_000);
    const listener = AppState.addEventListener('change', state => { if (state === 'active') poll(); });
    return () => { controller.abort(); flight.current = null; clearInterval(timer); listener.remove(); };
  }, [refresh]));
  const current = status.owner === session?.owner && status.groupId === groupId;
  return { messages: community.state.messages[groupId] ?? [], isLoading: current && status.isLoading, error: current ? status.error : null,
    refresh: () => refresh(), loadMore: () => current && status.hasMore ? refresh(status.cursor) : Promise.resolve(), hasMore: current && status.hasMore,
    sendMessage: (input: CreateGroupMessageInput) => community.sendGroupMessage(groupId,input.body,input.displayName,input.linkUrl,input.images ?? [],input.messageId) };
}
