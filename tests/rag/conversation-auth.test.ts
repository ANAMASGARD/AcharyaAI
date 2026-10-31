import { expect, it, vi } from 'vitest';
import { GET, POST, PATCH, DELETE } from '@/app/api/chat/conversations+api';
import { ApiAuthError } from '@/server/rag/auth';
vi.mock('@/server/db/auth', () => ({ requireClerkUserId: async () => ({ ok: false, response: Response.json({ error: 'Unauthorized' }, { status: 401 }) }) }));
vi.mock('@/server/rag/chat', () => ({}));
it('all conversation methods return an authentication response without invoking data access', async () => {
  expect(new ApiAuthError('Unauthorized').status).toBe(401);
  for (const [method, handler] of [['GET', GET], ['POST', POST], ['PATCH', PATCH], ['DELETE', DELETE]] as const) {
    const response = await handler(new Request('https://test/api/chat/conversations', { method }));
    expect(response.status).toBe(401);
  }
});
