export const SYNC_ENTITIES = ['teaching_sessions'] as const;
export type SyncEntity = (typeof SYNC_ENTITIES)[number];

export const SYNC_OPS = ['create', 'update', 'delete'] as const;
export type SyncOp = (typeof SYNC_OPS)[number];

export type TeachingSessionPayload = {
  title: string;
  grade?: string | null;
  subject?: string | null;
  status?: string;
  localAudioUri?: string | null;
  uploadStatus?: string;
};

export type SyncPushOperation = {
  operationId: string;
  entity: SyncEntity;
  op: SyncOp;
  recordId: string;
  baseRevision: number;
  payload: TeachingSessionPayload;
};

export type SyncPushRequest = {
  operations: SyncPushOperation[];
};

export type SyncPushResultItem = {
  operationId: string;
  status: 'applied' | 'duplicate' | 'conflict' | 'forbidden';
  recordId: string;
  revision?: number;
  serverRecord?: TeachingSessionRecord | null;
};

export type SyncPushResponse = {
  results: SyncPushResultItem[];
};

export type TeachingSessionRecord = {
  id: string;
  ownerClerkId: string;
  title: string;
  grade: string | null;
  subject: string | null;
  status: string;
  localAudioUri: string | null;
  uploadStatus: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type SyncPullChange = {
  seq: number;
  entity: SyncEntity;
  op: SyncOp;
  recordId: string;
  revision: number;
  record: TeachingSessionRecord | null;
};

export type SyncPullResponse = {
  changes: SyncPullChange[];
  nextCursor: string;
  hasMore: boolean;
};

export function isSyncEntity(value: string): value is SyncEntity {
  return (SYNC_ENTITIES as readonly string[]).includes(value);
}

export function isSyncOp(value: string): value is SyncOp {
  return (SYNC_OPS as readonly string[]).includes(value);
}
