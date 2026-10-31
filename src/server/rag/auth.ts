import { requireClerkUserId } from '../db/auth';

export class ApiAuthError extends Error {
  constructor(message: string, public readonly status = 401) { super(message); this.name = 'ApiAuthError'; }
}
export function authErrorResponse(error: unknown): Response {
  return Response.json({ error: error instanceof ApiAuthError ? error.message : 'Request failed.' }, { status: error instanceof ApiAuthError ? error.status : 500 });
}
export async function requireAuth(request: Request): Promise<{ userId: string }> {
  const auth = await requireClerkUserId(request, {
    ...process.env,
    APP_ENV: process.env.RAG_APP_ENV || process.env.APP_ENV,
    CLERK_SECRET_KEY: process.env.RAG_CLERK_SECRET_KEY || process.env.CLERK_SECRET_KEY,
    CLERK_ISSUER: process.env.RAG_CLERK_ISSUER || process.env.CLERK_ISSUER,
    CLERK_AUTHORIZED_PARTIES: process.env.RAG_CLERK_AUTHORIZED_PARTIES || process.env.CLERK_AUTHORIZED_PARTIES,
  });
  if (!auth.ok) throw new ApiAuthError(auth.response.status === 401 ? 'Unauthorized' : 'RAG authentication is not configured.', auth.response.status);
  return { userId: auth.clerkUserId };
}
