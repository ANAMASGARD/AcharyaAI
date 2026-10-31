import { verifyToken } from '@clerk/backend';

export type ClerkAuthResult =
  | { ok: true; clerkUserId: string }
  | { ok: false; response: Response };

export async function requireClerkUserId(request: Request): Promise<ClerkAuthResult> {
  const secretKey = process.env.CLERK_SECRET_KEY;
  const issuer = process.env.CLERK_ISSUER;
  const parties = process.env.CLERK_AUTHORIZED_PARTIES?.split(',').map((value) => value.trim()).filter(Boolean);
  if (!secretKey || !issuer || !parties?.length ||
      (process.env.APP_ENV === 'production' && (!secretKey.startsWith('sk_live_') || issuer !== 'https://clerk.superacharya.com'))) {
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
    // Native sessions may omit azp. A present claim must match an explicit origin.
    // Pin the issuer as well as the signature: development tokens are never production identities.
    if (!clerkUserId?.startsWith('user_') || !verified.sid?.startsWith('sess_') ||
        verified.iss !== issuer || (verified.azp !== undefined && !parties.includes(verified.azp))) {
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
