import type { RecorderController } from './controller';
import { recordingRepository } from './repository';

const controllers = new Map<string, Set<RecorderController>>();
const closing = new Map<string, Promise<void>>();
function trackCleanup(owner: string, task: Promise<void>): Promise<void> {
  const next = Promise.all([closing.get(owner), task]).then(() => {});
  closing.set(owner, next);
  void next.then(() => { if (closing.get(owner) === next) closing.delete(owner); }, () => {});
  return next;
}
export function registerRecorder(owner: string, controller: RecorderController): () => void {
  const set = controllers.get(owner) ?? new Set<RecorderController>();
  const previous = [...set];
  controllers.set(owner, set); set.add(controller);
  // A recreated screen must not restore stale chunk state while its predecessor is draining.
  if (previous.length) void trackCleanup(owner, Promise.all(previous.map(item => item.close().finally(() => set.delete(item)))).then(() => {}));
  return () => { void trackCleanup(owner, controller.close().finally(() => set.delete(controller))); };
}
export async function waitForRecorderCleanup(owner: string): Promise<void> {
  let task: Promise<void> | undefined;
  while ((task = closing.get(owner))) await task;
}
export async function stopRecorderAccount(owner: string): Promise<void> {
  await Promise.all([...(controllers.get(owner) ?? [])].map((controller) => controller.close()));
}
export function clearRecorderAccount(owner: string): Promise<void> {
  const previous = closing.get(owner) ?? Promise.resolve();
  const active = [...(controllers.get(owner) ?? [])];
  const next = previous.catch(() => {}).then(async () => {
    await Promise.all(active.map((controller) => controller.close()));
    await recordingRepository.clearAccount(owner);
    active.forEach((controller) => controllers.get(owner)?.delete(controller));
  });
  closing.set(owner, next);
  void next.then(() => { if (closing.get(owner) === next) closing.delete(owner); }, () => {});
  return next;
}
