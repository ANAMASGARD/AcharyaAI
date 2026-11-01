export const STT_REVISION = '5359861c739e955e79d9a303bcbc70fb988958b1';
export const STT_MODELS = [
  { id: 'whisper-small-q5_1-v1', label: 'Whisper small', filename: 'ggml-small-q5_1.bin', bytes: 190085487,
    sha256: 'ae85e4a935d7a567bd102fe55afc16bb595bdb618e11b2fc7591bc08120411bb' },
  { id: 'whisper-medium-q5_0-v1', label: 'Whisper medium', filename: 'ggml-medium-q5_0.bin', bytes: 539212467,
    sha256: '19fea4b380c3a618ec4723c3eef2eb785ffba0d0538cf43f8f235e7b3b34220f' },
] as const;
export type SttModelId = typeof STT_MODELS[number]['id'];
export function sttModel(id: string | null | undefined) { return STT_MODELS.find(model => model.id === id); }
export function modelUrl(id: SttModelId): string {
  return `https://huggingface.co/ggerganov/whisper.cpp/resolve/${STT_REVISION}/${sttModel(id)!.filename}`;
}
