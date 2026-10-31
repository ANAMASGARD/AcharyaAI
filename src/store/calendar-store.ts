import { usePreviewFeature } from '@/components/preview/preview-provider';

type BookmarkState = { bookmarkedSessionIds: string[]; toggleBookmark: (id: string) => void };

export function useCalendarStore<T>(selector: (state: BookmarkState) => T): T {
  const [ids, setIds] = usePreviewFeature<string[]>('calendar-bookmarks', []);
  return selector({ bookmarkedSessionIds: ids, toggleBookmark: (id) => {
    setIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  } });
}
