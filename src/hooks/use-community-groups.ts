import { useCallback, useEffect, useState } from 'react';
import { useCommunity, useCommunitySession } from '@/hooks/use-community';
import { useCommunityRemoteStore } from '@/store/community-remote-store';
import type { CommunityGroup } from '@/types/community';

export function useCommunityGroups() {
  const community = useCommunity();
  const { request } = community;
  const session = useCommunitySession();
  const [status, setStatus] = useState({ owner: '', isLoading: false, error: null as string | null });
  const refresh = useCallback(async () => {
    if (!session) return;
    setStatus({ owner: session.owner, isLoading: true, error: null });
    try {
      const result = await request<{ groups: CommunityGroup[] }>('/groups');
      if (!Array.isArray(result.groups)) throw new Error('Invalid group response.');
      if (!session.isCurrent()) return;
      useCommunityRemoteStore.getState().update(session.owner, () => ({ groups: result.groups }));
      setStatus({ owner: session.owner, isLoading: false, error: null });
    } catch (cause) { if (session.isCurrent()) setStatus({ owner: session.owner, isLoading: false, error: cause instanceof Error ? cause.message : 'Could not load teacher groups.' }); }
  }, [request, session]);
  useEffect(() => { let active = true; void Promise.resolve().then(() => { if (active) void refresh(); }); return () => { active = false; }; }, [refresh]);
  return { groups: community.state.groups, isLoading: status.owner === session?.owner && status.isLoading, error: status.owner === session?.owner ? status.error : null,
    refresh, createGroup: community.createGroup, joinGroup: community.joinGroup };
}
