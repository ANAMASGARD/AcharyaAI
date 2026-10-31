import { useCommunityPreview } from '@/hooks/use-community-preview';

export function useCommunityGroups() {
  const community = useCommunityPreview();
  return { groups: community.state.groups, isLoading: false, error: null as string | null,
    refresh: async () => {}, createGroup: community.createGroup,
    joinGroup: (code: string, _displayName: string) => community.joinGroup(code) };
}
