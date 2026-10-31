import Constants from 'expo-constants';

import type { SyncPullResponse, SyncPushRequest, SyncPushResponse } from '@/lib/sync/types';

function getApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
  if (fromEnv) {
    return fromEnv;
  }

  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    return `http://${hostUri}`;
  }

  return '';
}

export async function syncPush(
  token: string,
  body: SyncPushRequest,
): Promise<SyncPushResponse> {
  const base = getApiBaseUrl();
  if (!base) {
    throw new Error('API base URL is not configured');
  }

  const response = await fetch(`${base}/api/sync/push`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok && response.status !== 409) {
    throw new Error(`Sync push failed (${response.status})`);
  }

  return (await response.json()) as SyncPushResponse;
}

export async function syncPull(
  token: string,
  cursor: string,
  limit = 50,
): Promise<SyncPullResponse> {
  const base = getApiBaseUrl();
  if (!base) {
    throw new Error('API base URL is not configured');
  }

  const url = new URL(`${base}/api/sync/pull`);
  url.searchParams.set('cursor', cursor);
  url.searchParams.set('limit', String(limit));

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Sync pull failed (${response.status})`);
  }

  return (await response.json()) as SyncPullResponse;
}
