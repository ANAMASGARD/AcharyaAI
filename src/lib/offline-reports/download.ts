import { createModelDownloads } from '@/lib/local-models/downloads';
import { reportNative, reportRuntimeAvailable } from './bridge';
import { REPORT_MODELS, reportDownloadPublished } from './model';
export const reportDownloads = createModelDownloads(REPORT_MODELS, REPORT_MODELS.map(model => `${model.id}@${model.revision}`).join('|'), 'offline-report-download',
  reportRuntimeAvailable && reportDownloadPublished, reportNative ? {
    inspectSttModel: id => reportNative!.inspectReportModel(id),
    prepareSttDownload: (id, restart) => reportNative!.prepareReportDownload(id, restart),
    finishSttDownload: id => reportNative!.finishReportDownload(id),
    discardSttDownload: id => reportNative!.discardReportDownload(id),
    removeSttModel: id => reportNative!.removeReportModel(id),
  } : null, id => {
    const model = REPORT_MODELS.find(value => value.id === id);
    if (!reportDownloadPublished || !model?.url) throw new Error('Model download is not published yet.');
    return model.url;
  });
