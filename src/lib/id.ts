import { nanoid } from 'nanoid';

export type AcharyaId = string;

/** Default 21-char URL-safe NanoID — generate once at record creation. */
export function createId(): AcharyaId {
  return nanoid(21);
}
