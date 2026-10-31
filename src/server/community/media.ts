import { communityOperation } from './db';
import { createImageKitProvider, type CommunityImageProvider } from './imagekit';
import { CommunityMediaError, imageWidth, mediaId, readImageBody, validateImageBytes } from './media-validation';

export { CommunityMediaError } from './media-validation';

type Operation = (clerkUserId: string, action: string, payload: Record<string, unknown>) => Promise<Record<string, unknown>>;

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new CommunityMediaError('MEDIA_STATE', 'Photo state is unavailable; retry', 503, true);
  return value as Record<string, unknown>;
}

export interface CommunityMediaServices {
  operation?: Operation;
  provider?: CommunityImageProvider;
}

/** The owner and group are authorized by Neon both before the upload and at registration. */
export async function uploadCommunityImage(request: Request, clerkUserId: string, services: CommunityMediaServices = {}): Promise<Record<string, unknown>> {
  const operation = services.operation ?? communityOperation;
  const imageId = mediaId(request.headers.get('X-Community-Image-Id'));
  const rawGroupId = request.headers.get('X-Community-Group-Id');
  const groupId = rawGroupId ? mediaId(rawGroupId) : undefined;
  const bytes = await readImageBody(request);
  const format = validateImageBytes(bytes, request.headers.get('content-type'));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const contentHash = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
  // Reservation and cleanup intent are committed before any external file can exist.
  const prepared = await operation(clerkUserId, 'media_prepare', { imageId, groupId, format, contentHash, sizeBytes: bytes.length });
  const image = record(prepared.image);
  if (image.status === 'deleting') throw new CommunityMediaError('IMAGE_EXPIRED', 'This photo expired; select it again', 409);
  try {
    const provider = services.provider ?? createImageKitProvider();
    // Reconcile uploads whose response was lost without creating file versions.
    const stored = await provider.upload(bytes, imageId, format, contentHash);
    // A failed registration leaves the durable reservation available to retry or clean up.
    return await operation(clerkUserId, 'media_register', { imageId, ...stored });
  } catch (error) {
    try {
      // Account deletion may have completed cleanup while an upload was still in flight.
      // This internal operation accepts the original owner even after its tombstone,
      // requeues deleting images, and leaves active-owner draft reservations pending.
      await operation(clerkUserId, 'media_upload_failed', { imageId });
    } catch {
      throw new CommunityMediaError('IMAGE_FINALIZATION_RETRY', 'Photo could not be finalized; keep your draft and retry', 503, true);
    }
    throw error;
  }
}

/** Authorize each refresh. Never return provider paths or permanent delivery URLs to the client. */
export async function signCommunityImage(clerkUserId: string, id: string, width: string | null, services: CommunityMediaServices = {}): Promise<{ url: string; expiresAt: string }> {
  const operation = services.operation ?? communityOperation;
  const imageId = mediaId(id);
  const targetWidth = imageWidth(width);
  const result = await operation(clerkUserId, 'media_access', { imageId });
  const image = record(result.image);
  if (typeof image.filePath !== 'string' || typeof image.fileId !== 'string' || image.status === 'deleting') throw new CommunityMediaError('IMAGE_UNAVAILABLE', 'Photo is no longer available', 404);
  return (services.provider ?? createImageKitProvider()).sign(image.filePath, targetWidth);
}

/** Bounded worker; claim/complete/fail are lease-fenced in Neon. Never expose it without auth. */
export async function cleanupCommunityMedia(clerkUserId: string, limit = 5, services: CommunityMediaServices = {}): Promise<{ completed: number; failed: number }> {
  const operation = services.operation ?? communityOperation;
  if (!Number.isInteger(limit) || limit < 1 || limit > 5) throw new CommunityMediaError('INVALID_LIMIT', 'Invalid cleanup batch size');
  const result = await operation(clerkUserId, 'media_cleanup_claim', { limit });
  if (!Array.isArray(result.jobs) || result.jobs.length > limit) throw new CommunityMediaError('MEDIA_STATE', 'Photo cleanup state is unavailable', 503, true);
  let completed = 0, failed = 0;
  if (!result.jobs.length) return { completed, failed };
  const provider = services.provider ?? createImageKitProvider();
  const jobs = result.jobs.map(value => {
    const job = record(value);
    if (typeof job.jobId !== 'string' || typeof job.leaseToken !== 'string' || typeof job.filePath !== 'string' || (job.fileId !== null && job.fileId !== undefined && typeof job.fileId !== 'string')) throw new CommunityMediaError('MEDIA_STATE', 'Photo cleanup job is invalid', 503, true);
    return { jobId: job.jobId, leaseToken: job.leaseToken, filePath: job.filePath, fileId: typeof job.fileId === 'string' ? job.fileId : null };
  });
  let next = 0;
  const acknowledgementErrors: unknown[] = [];
  async function processJob(job: (typeof jobs)[number]): Promise<void> {
    const payload = { jobId: job.jobId, leaseToken: job.leaseToken };
    try {
      await provider.remove(job.fileId, job.filePath);
      await operation(clerkUserId, 'media_cleanup_complete', payload);
      completed++;
    } catch {
      // No provider raw errors, filenames, credentials, or delivery URLs in job logs.
      await operation(clerkUserId, 'media_cleanup_fail', { ...payload, error: 'MEDIA_DELETE_FAILED' });
      failed++;
    }
  }
  async function worker(): Promise<void> {
    while (next < jobs.length) {
      const job = jobs[next++];
      try { await processJob(job); }
      catch (error) {
        // A stale lease or unavailable acknowledgement leaves that job retryable.
        // Finish the other claims before surfacing the failure to the scheduler.
        acknowledgementErrors.push(error);
      }
    }
  }
  // At most two independent jobs run at once, keeping five claims within their lease.
  await Promise.all([worker(), worker()]);
  if (acknowledgementErrors.length) throw acknowledgementErrors[0];
  return { completed, failed };
}
