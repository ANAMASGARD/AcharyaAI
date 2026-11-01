import { createModelDownloads } from '@/lib/local-models/downloads';
import { offlineSttAvailable, sttNative } from './bridge';
import { STT_MODELS, STT_REVISION, modelUrl } from './models';
export { validPaused, validRange } from '@/lib/local-models/downloads';
export type { DownloadState } from '@/lib/local-models/downloads';
const downloads = createModelDownloads(STT_MODELS, STT_REVISION, 'offline-stt-download', offlineSttAvailable, sttNative, modelUrl);
export const { getState: getSttDownloads, subscribe: subscribeSttDownloads, check: checkSttDownloads,
  download: downloadSttModel, pause: pauseSttDownload, cancel: cancelSttDownload, remove: removeSttModel } = downloads;
