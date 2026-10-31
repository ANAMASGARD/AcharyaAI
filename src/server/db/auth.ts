import { verifyToken } from '@clerk/backend';

export type ClerkAuthResult =
  | { ok: true; clerkUserId: string }
  | { ok: false; response: Response };

export async function requireClerkUserId(request: Request): Promise<ClerkAuthResult> {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    return {
      ok: false,
      response: Response.json({ error: 'Server auth is not configured' }, { status: 500 }),
    };
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return {
      ok: false,
      response: Response.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const token = authorization.slice('Bearer '.length).trim();
  if (!token) {
    return {
      ok: false,
      response: Response.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  try {
    const verified = await verifyToken(token, { secretKey });
    const clerkUserId = verified.sub;
    if (!clerkUserId) {
      return {
        ok: false,
        response: Response.json({ error: 'Unauthorized' }, { status: 401 }),
      };
    }
    return { ok: true, clerkUserId };
  } catch {
    return {
      ok: false,
      response: Response.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }
}
