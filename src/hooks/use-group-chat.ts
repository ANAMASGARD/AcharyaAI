import { useCommunityPreview } from '@/hooks/use-community-preview';
import type { CreateGroupMessageInput } from '@/types/community';

export function useGroupChat(groupId: string) {
  const community = useCommunityPreview();
  return { messages: community.state.messages[groupId] ?? [], isLoading: false, error: community.state.groups.some((group) => group.groupId === groupId) ? null : 'This local group is no longer available.',
    sendMessage: (input: CreateGroupMessageInput) => community.sendGroupMessage(groupId, input.body, input.displayName, input.linkUrl) };
}
