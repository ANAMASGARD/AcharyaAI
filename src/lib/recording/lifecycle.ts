import type { RecorderController } from './controller';
import { recordingRepository } from './repository';

const controllers = new Map<string, Set<RecorderController>>();
const closing = new Map<string, Promise<void>>();
export function registerRecorder(owner: string, controller: RecorderController): () => void {
  const set = controllers.get(owner) ?? new Set<RecorderController>();
  controllers.set(owner, set); set.add(controller);
  return () => { void controller.close().finally(() => set.delete(controller)); };
}
export async function waitForRecorderCleanup(owner: string): Promise<void> {
  await closing.get(owner);
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
