import { requireClerkUserId } from '@/server/db/auth';
import { handleSyncPull } from '@/server/sync/pull';

export async function GET(request: Request) {
  const auth = await requireClerkUserId(request);
  if (!auth.ok) {
    return auth.response;
  }

  const url = new URL(request.url);
  const cursor = url.searchParams.get('cursor');
  const limit = url.searchParams.get('limit');

  const result = await handleSyncPull(auth.clerkUserId, cursor, limit);
  return Response.json(result);
}
