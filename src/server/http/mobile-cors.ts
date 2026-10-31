const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];
const HEADERS = ['authorization', 'content-type', 'x-community-image-id', 'x-community-file-name', 'x-community-group-id'];

/** Browser testing uses the same bearer-token API as Expo Go and installed apps. */
export function mobileCors(request: Request): Headers | Response {
  const headers = new Headers({ Vary: 'Origin' });
  const origin = request.headers.get('Origin');
  if (!origin) return request.method === 'OPTIONS' ? new Response(null, { status: 204, headers }) : headers;
  const allowed = (process.env.CLERK_AUTHORIZED_PARTIES ?? '').split(',').map(value => value.trim());
  if (!allowed.includes(origin)) return Response.json({ error: 'Origin not allowed' }, { status: 403, headers });
  headers.set('Access-Control-Allow-Origin', origin);
  if (request.method !== 'OPTIONS') return headers;
  const method = request.headers.get('Access-Control-Request-Method') ?? '';
  const requested = (request.headers.get('Access-Control-Request-Headers') ?? '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
  if (!METHODS.includes(method) || requested.some(value => !HEADERS.includes(value))) {
    return Response.json({ error: 'Preflight not allowed' }, { status: 403, headers });
  }
  headers.set('Access-Control-Allow-Methods', METHODS.join(', '));
  headers.set('Access-Control-Allow-Headers', HEADERS.join(', '));
  headers.set('Access-Control-Max-Age', '300');
  return new Response(null, { status: 204, headers });
}
