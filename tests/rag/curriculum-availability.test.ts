import { expect, it, vi } from 'vitest';
import { useCurriculumAvailability } from '@/hooks/use-curriculum-availability';
const state = vi.hoisted(() => ({ values: [] as unknown[], index: 0, effects: [] as (() => unknown)[] }));
vi.mock('react', () => ({
  useRef: (value: unknown) => ({ current: value }), useCallback: (callback: unknown) => callback,
  useState: (initial: unknown) => { const at = state.index++; if (!(at in state.values)) state.values[at] = initial; return [state.values[at], (value: unknown) => { state.values[at] = value; }]; },
  useLayoutEffect: (callback: () => unknown) => state.effects.push(callback),
  useEffect: (callback: () => unknown) => state.effects.push(callback),
}));
vi.mock('@clerk/expo', () => ({ useAuth: () => ({ userId: 'user_a', getToken: async () => 'token_a' }) }));
vi.mock('@/lib/api-client', () => ({ apiFetch: async () => ({ slots: [{ classLevel: 'class-2', subject: 'English' }] }) }));
it('enables only published curriculum choices returned by the authenticated API', async () => {
  state.index = 0;
  useCurriculumAvailability(true);
  for (const effect of state.effects) effect();
  await new Promise(resolve => setTimeout(resolve, 0));
  state.index = 0;
  const ready = useCurriculumAvailability(true);
  expect(ready.isReady('class-2', 'english')).toBe(true);
  expect(ready.isReady('class-6', 'science')).toBe(false);
});
