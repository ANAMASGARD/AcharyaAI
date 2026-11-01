import { isRunningInExpoGo, requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import type { SttModelId } from './models';

export type SttFileState = { downloaded: boolean; partialBytes: number; uri: string };
type Bridge = {
  sttAvailable: boolean;
  inspectSttModel(id: SttModelId): Promise<SttFileState>;
  prepareSttDownload(id: SttModelId, restart: boolean): Promise<string>;
  finishSttDownload(id: SttModelId): Promise<void>;
  discardSttDownload(id: SttModelId): Promise<void>;
  removeSttModel(id: SttModelId): Promise<void>;
  sttModelPath(id: SttModelId): Promise<string>;
  acquireSttResidency(token: string): Promise<void>;
  releaseSttResidency(token: string): Promise<void>;
};
export const sttNative = Platform.OS === 'android' && !isRunningInExpoGo()
  ? requireOptionalNativeModule<Bridge>('AcharyaEmbeddings') : null;
export const offlineSttAvailable = Boolean(sttNative?.sttAvailable);
