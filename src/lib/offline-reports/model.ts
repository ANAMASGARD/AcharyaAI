import manifest from '../../../assets/models/gemma-report.json';
export const REPORT_MODELS = manifest;
export const REPORT_MODEL = REPORT_MODELS[0];
export function reportModel(id: string | null | undefined) {
  return REPORT_MODELS.find(model => model.id === id);
}
export const reportDownloadPublished = REPORT_MODELS.every(model => model.distributionApproved &&
  /^[a-f0-9]{64}$/.test(model.sha256) && model.url.startsWith('https://huggingface.co/') && model.url.includes(`/resolve/${model.revision}/`));
export const REPORT_PROMPT_VERSION = 'classroom-gguf-v2';
