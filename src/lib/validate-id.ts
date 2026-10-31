import type { AcharyaId } from '@/lib/id';

const NANOID_PATTERN = /^[A-Za-z0-9_-]{21}$/;

export function isAcharyaId(value: string): value is AcharyaId {
  return NANOID_PATTERN.test(value);
}

export function assertAcharyaId(value: string): AcharyaId {
  if (!isAcharyaId(value)) {
    throw new Error('Invalid Acharya ID');
  }
  return value;
}
