import { isRunningInExpoGo, requireOptionalNativeModule } from 'expo';
import { File } from 'expo-file-system';
import { PermissionsAndroid, Platform } from 'react-native';
import type { RecorderController } from './controller';

type NativeChunk = { index: number; uri: string; durationMs: number };
type Bridge = {
  recordingAvailable: boolean;
  startClassRecording(owner: string, session: string): Promise<void>;
  stopClassRecording(owner: string, session: string): Promise<void>;
  classRecordingStatus(owner: string, session: string): Promise<{ active: boolean; error: string | null; chunks: NativeChunk[] }>;
  ackClassChunk(owner: string, session: string, index: number): Promise<void>;
  clearClassCapture(owner: string): Promise<void>;
};
const native = Platform.OS === 'android' && !isRunningInExpoGo() ? requireOptionalNativeModule<Bridge>('AcharyaEmbeddings') : null;
export const backgroundCaptureAvailable = Boolean(native?.recordingAvailable);
export async function clearNativeCapture(owner: string): Promise<void> { await native?.clearClassCapture(owner); }

/** Files are acknowledged only after the controller commits their metadata and audio. */
export function createNativeCapture(owner: string, getController: () => RecorderController) {
  let timer: ReturnType<typeof setInterval> | null = null;
  let tail = Promise.resolve();
  const drain = () => {
    tail = tail.catch(() => {}).then(async () => {
      const controller = getController();
      const session = controller.getSnapshot().snapshot?.session;
      if (!native || !session || session.ownerClerkId !== owner) return;
      const status = await native.classRecordingStatus(owner, session.id);
      for (const chunk of status.chunks) {
        const bytes = await new File(chunk.uri).bytes();
        await controller.ingestNativeChunk(chunk.index, bytes, chunk.durationMs);
        await native.ackClassChunk(owner, session.id, chunk.index);
      }
      if ((!status.active || status.error) && controller.getSnapshot().snapshot?.session.status === 'recording') {
        // Schedule outside this drain promise: stop performs one final drain itself.
        setTimeout(() => { void controller.stop(status.error ?? 'Microphone recording was interrupted. Saved audio is retained.'); }, 0);
      }
    });
    return tail;
  };
  return {
    durable: true,
    recover: drain,
    start: async () => {
      if (!native) throw new Error('Background recording needs the Android app build.');
      if (Number(Platform.Version) >= 33) {
        const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) throw new Error('Allow recording notifications to record with the screen locked.');
      }
      const session = getController().getSnapshot().snapshot?.session;
      if (!session || session.ownerClerkId !== owner || session.status !== 'starting') throw new Error('Recording start was cancelled.');
      await native.startClassRecording(owner, session.id);
      timer = setInterval(() => { void drain().catch(() => { void getController().stop('Could not save captured audio. Native files are retained for recovery.'); }); }, 1000);
    },
    stop: async () => {
      if (timer) clearInterval(timer);
      timer = null;
      const session = getController().getSnapshot().snapshot?.session;
      if (native && session) await native.stopClassRecording(owner, session.id);
      await drain();
    },
  };
}
