import { useCommunityPreview } from '@/hooks/use-community-preview';

export function useCommunityFeed(options: { limit?: number; groupId?: string | null; autoFetch?: boolean } = {}) {
  const community = useCommunityPreview();
  const filtered = community.state.posts.filter((post) => !options.groupId || post.groupId === options.groupId);
  return { ...community, posts: options.limit ? filtered.slice(0, options.limit) : filtered,
    isLoading: false, hasFetched: true, error: null as string | null, refresh: async () => {} };
}
