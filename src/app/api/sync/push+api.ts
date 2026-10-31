import { requireClerkUserId } from '@/server/db/auth';
import type { SyncPushOperation, SyncPushRequest } from '@/lib/sync/types';
import { handleSyncPush } from '@/server/sync/push';

export async function POST(request: Request) {
  const auth = await requireClerkUserId(request);
  if (!auth.ok) {
    return auth.response;
  }

  let body: SyncPushRequest;
  try {
    body = (await request.json()) as SyncPushRequest;
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!Array.isArray(body.operations)) {
    return Response.json({ error: 'operations must be an array' }, { status: 400 });
  }

  const operations = body.operations as SyncPushOperation[];
  const result = await handleSyncPush(auth.clerkUserId, operations);
  const hasConflict = result.results.some((item) => item.status === 'conflict');
  return Response.json(result, { status: hasConflict ? 409 : 200 });
}
