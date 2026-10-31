import { requireClerkUserId } from '@/server/db/auth';
import { SttError } from '@/server/recording/validation';
export async function recordingOwner(request: Request): Promise<string> {
  const auth = await requireClerkUserId(request);
  if (!auth.ok) throw new SttError('UNAUTHORIZED', 'Sign in to use recording', auth.response.status, auth.response.status >= 500);
  return auth.clerkUserId;
}
