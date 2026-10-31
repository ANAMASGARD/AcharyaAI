import { nanoid } from 'nanoid';

import { readRecordingBody } from '../recording/request-body';
import { communityOperation } from './db';
import { signCommunityImage, uploadCommunityImage } from './media';
import { CommunityMediaError } from './media-validation';
import { CommunityRequestError, communityBody, communityId, communityImages, communityLink, communityPage, communityText } from './validation';

export { deleteCommunityAccount } from './db';

function reply(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function communityErrorResponse(error: unknown): Response {
  if (error instanceof CommunityRequestError) return reply({ error: error.message, retryable: false }, error.status);
  if (error instanceof CommunityMediaError) return reply({ error: error.code, message: error.message, retryable: error.retryable }, error.status);
  const message = error instanceof Error ? error.message : '';
  const code = ['ACCOUNT_DELETED', 'UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'INVALID_MEDIA', 'INVALID_REQUEST', 'RATE_LIMIT', 'CONFLICT', 'COMMUNITY_NOT_CONFIGURED'].find(value => message.includes(value));
  const conflict = message.includes('duplicate key');
  const status = code === 'RATE_LIMIT' ? 429 : code === 'ACCOUNT_DELETED' || code === 'FORBIDDEN' ? 403 : code === 'UNAUTHORIZED' ? 401 : code === 'NOT_FOUND' ? 404
    : code === 'INVALID_MEDIA' || code === 'INVALID_REQUEST' || message.includes('check constraint') ? 400 : code === 'CONFLICT' || conflict ? 409 : 503;
  return reply({ error: code ?? (conflict ? 'CONFLICT' : status === 400 ? 'INVALID_REQUEST' : 'RETRY_LATER'), retryable: status === 503 || status === 429 }, status);
}

/** Mounted after Clerk verification. No caller-provided author/role fields are trusted. */
export async function handleCommunityRequest(request: Request, clerkUserId: string): Promise<Response> {
  try {
    const url = new URL(request.url);
    const marker = url.pathname.indexOf('/community');
    const route = marker < 0 ? [] : url.pathname.slice(marker + '/community'.length).split('/').filter(Boolean).map(decodeURIComponent);
    const method = request.method;
    if (route[0] === 'capabilities' && route.length === 1 && method === 'GET') return reply({ moderator: (process.env.COMMUNITY_MODERATOR_IDS ?? '').split(',').map(value => value.trim()).includes(clerkUserId) });
    if (route[0] === 'uploads' && route.length === 1 && method === 'POST') return reply(await uploadCommunityImage(request, clerkUserId));
    if (route[0] === 'images' && route.length === 2 && method === 'GET') return reply(await signCommunityImage(clerkUserId, communityId(route[1]), url.searchParams.get('width')));
    let data: Record<string, unknown> = {};
    if (method === 'POST' || method === 'PUT') {
      let parsed: unknown;
      try { parsed = JSON.parse(new TextDecoder().decode(await readRecordingBody(request, 100_000))); }
      catch { throw new CommunityRequestError(); }
      data = communityBody(parsed);
    }
    const displayName = () => communityText(data.displayName, 80);
    const groupId = () => data.groupId === undefined || data.groupId === null ? null : communityId(data.groupId);
    let action: string;
    let payload: Record<string, unknown>;
    if (route[0] === 'posts' && route.length === 1 && method === 'GET') {
      action = 'posts_list'; payload = { ...communityPage(url.searchParams), groupId: url.searchParams.has('groupId') ? communityId(url.searchParams.get('groupId')) : null };
    } else if (route[0] === 'posts' && route.length === 1 && method === 'POST') {
      action = 'post_create'; payload = { postId: communityId(data.postId), title: communityText(data.title, 200), body: communityText(data.body ?? '', 10000, false), subjectTag: communityText(data.subjectTag ?? 'General', 80),
        linkUrl: communityLink(data.linkUrl), groupId: groupId(), displayName: displayName(), images: communityImages(data.images) };
    } else if (route[0] === 'posts' && route.length === 2 && method === 'GET') {
      action = 'post_get'; payload = { id: communityId(route[1]), ...communityPage(url.searchParams) };
    } else if (route[0] === 'posts' && route.length === 2 && method === 'DELETE') {
      action = 'post_delete'; payload = { id: communityId(route[1]) };
    } else if (route[0] === 'posts' && route.length === 3 && route[2] === 'comments' && method === 'POST') {
      action = 'comment_create'; payload = { id: communityId(route[1]), commentId: communityId(data.commentId), body: communityText(data.body, 5000), displayName: displayName() };
    } else if (route[0] === 'posts' && route.length === 3 && route[2] === 'vote' && method === 'PUT') {
      if (data.value !== null && data.value !== 1 && data.value !== -1) throw new CommunityRequestError();
      action = 'post_vote'; payload = { id: communityId(route[1]), value: data.value };
    } else if (route[0] === 'posts' && route.length === 3 && route[2] === 'save' && method === 'PUT') {
      if (typeof data.save !== 'boolean') throw new CommunityRequestError();
      action = 'post_save'; payload = { id: communityId(route[1]), save: data.save };
    } else if (route[0] === 'groups' && route.length === 1 && method === 'GET') {
      action = 'groups_list'; payload = {};
    } else if (route[0] === 'groups' && route.length === 1 && method === 'POST') {
      action = 'group_create'; payload = { groupId: communityId(data.groupId), name: communityText(data.name, 100), description: communityText(data.description ?? '', 3000, false), subjectTag: data.subjectTag ? communityText(data.subjectTag, 80) : null, displayName: displayName(), joinCode: nanoid() };
    } else if (route[0] === 'groups' && route.length === 2 && route[1] === 'join' && method === 'POST') {
      action = 'group_join'; payload = { code: communityId(data.code), displayName: displayName() };
    } else if (route[0] === 'groups' && route.length === 2 && method === 'GET') {
      action = 'group_get'; payload = { groupId: communityId(route[1]) };
    } else if (route[0] === 'groups' && route.length === 4 && route[2] === 'members' && method === 'DELETE') {
      if (!/^user_[A-Za-z0-9]+$/.test(route[3]) || route[3].length > 100) throw new CommunityRequestError();
      action = 'member_remove'; payload = { groupId: communityId(route[1]), id: route[3], joinCode: nanoid() };
    } else if (route[0] === 'groups' && route.length === 3 && route[2] === 'messages' && method === 'GET') {
      action = 'messages_list'; payload = { groupId: communityId(route[1]), ...communityPage(url.searchParams) };
    } else if (route[0] === 'groups' && route.length === 3 && route[2] === 'messages' && method === 'POST') {
      const images = communityImages(data.images), body = communityText(data.body ?? '', 10000, false), linkUrl = communityLink(data.linkUrl);
      if (!body && !linkUrl && images.length === 0) throw new CommunityRequestError();
      action = 'message_create'; payload = { groupId: communityId(route[1]), messageId: communityId(data.messageId), body, linkUrl, displayName: displayName(), images };
    } else if (route[0] === 'groups' && route.length === 4 && route[2] === 'messages' && method === 'DELETE') {
      action = 'message_delete'; payload = { groupId: communityId(route[1]), id: communityId(route[3]) };
    } else if (route[0] === 'reports' && route.length === 1 && method === 'POST') {
      if (!['post', 'comment', 'message'].includes(String(data.targetType))) throw new CommunityRequestError();
      action = 'report_create'; payload = { reportId: communityId(data.reportId), targetType: data.targetType, targetId: communityId(data.targetId), reason: communityText(data.reason, 1000) };
    } else if (route[0] === 'blocks' && route.length === 1 && method === 'GET') {
      action = 'blocks_list'; payload = {};
    } else if (route[0] === 'blocks' && route.length === 2 && (method === 'PUT' || method === 'DELETE')) {
      if (!/^user_[A-Za-z0-9]+$/.test(route[1]) || route[1].length > 100 || route[1] === clerkUserId) throw new CommunityRequestError();
      action = method === 'PUT' ? 'block' : 'unblock'; payload = { id: route[1] };
    } else if (route[0] === 'moderation' && route.length === 1 && method === 'GET') {
      action = 'moderation_list'; payload = {};
    } else if (route[0] === 'moderation' && route.length === 2 && method === 'POST') {
      if (data.action !== 'dismiss' && data.action !== 'remove') throw new CommunityRequestError();
      action = 'moderation_action'; payload = { id: communityId(route[1]), action: data.action };
    } else return reply({ error: 'NOT_FOUND' }, 404);
    const result = await communityOperation(clerkUserId, action, payload);
    // The mobile contract treats cursors as opaque strings; SQL keeps their tuple structured.
    if (result.nextCursor && typeof result.nextCursor === 'object') result.nextCursor = JSON.stringify(result.nextCursor);
    return reply(result);
  } catch (error) { return communityErrorResponse(error); }
}
