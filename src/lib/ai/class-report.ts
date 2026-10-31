import { getActiveProvider } from '@/lib/ai-keys/vault';
import { buildTeachingAnalysisPrompt, TEACHING_ANALYSIS_SYSTEM_PROMPT } from '@/lib/prompts/teaching-analysis';
import { buildClassNotesPrompt, CLASS_NOTES_SYSTEM_PROMPT } from '@/lib/prompts/class-notes';
import type { TeachingReport } from '@/types/recorder';
import { AiRequestError, checkAborted, isRecord, providerFetch, readJson, withProvider } from './transport';

export const CLASS_REPORT_MODEL = 'gpt-6-luna';
export type ClassReportInput = { transcript: string; topic: string; subject: string; classLevel: string };
export type ClassReportResult = { report: TeachingReport; classNotes: string; model: string };
export type ReportPhase = 'feedback' | 'notes';
const fields = ['classroomEnvironment', 'whatWentWrong', 'areasToImprove', 'topicSpecificFeedback'] as const;

export function parseTeachingReport(content: string): TeachingReport {
  let value: unknown;
  try { value = JSON.parse(content); } catch { throw new AiRequestError('The model returned an unreadable report. Tap Send to retry.'); }
  if (!isRecord(value) || !fields.every((key) => typeof value[key] === 'string' && value[key].trim().length > 0 && value[key].length <= 20_000) ||
      typeof value.overallScore !== 'number' || !Number.isInteger(value.overallScore) || value.overallScore < 0 || value.overallScore > 100) {
    throw new AiRequestError('The model returned an incomplete report. Tap Send to retry.');
  }
  return { classroomEnvironment: value.classroomEnvironment as string, whatWentWrong: value.whatWentWrong as string,
    areasToImprove: value.areasToImprove as string, topicSpecificFeedback: value.topicSpecificFeedback as string, overallScore: value.overallScore };
}

export async function generateClassReport(owner: string, input: ClassReportInput, signal: AbortSignal,
  onPhase: (phase: ReportPhase) => void): Promise<ClassReportResult> {
  if (!input.transcript.trim() || input.transcript.length > 240_000) {
    throw new AiRequestError('The transcript must contain speech and be under 240,000 characters. Nothing was sent.');
  }
  const provider = await getActiveProvider(owner);
  checkAborted(signal);
  let selectedModel = '';
  const complete = (instruction: string, prompt: string, json: boolean) => withProvider(owner, provider, signal, async (credential, requestSignal) => {
    const model = credential.model ?? CLASS_REPORT_MODEL;
    if (selectedModel && selectedModel !== model) throw new AiRequestError('The selected model changed. Tap Send to retry.');
    selectedModel = model;
    let url: string; let headers: Record<string, string>; let body: unknown;
    if (provider === 'gemini') {
      url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
      headers = { 'x-goog-api-key': credential.apiKey };
      body = { systemInstruction: { parts: [{ text: instruction }] }, contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 8192, ...(json ? { responseMimeType: 'application/json' } : {}) } };
    } else if (provider === 'claude') {
      url = 'https://api.anthropic.com/v1/messages';
      headers = { 'x-api-key': credential.apiKey, 'anthropic-version': '2023-06-01' };
      body = { model, max_tokens: 8192, system: instruction, messages: [{ role: 'user', content: prompt }] };
    } else {
      url = `${credential.baseUrl}/chat/completions`;
      headers = { Authorization: `Bearer ${credential.apiKey}` };
      body = { model, ...(/^gpt-6|^o[1-9]/.test(model) ? { reasoning_effort: 'low', max_completion_tokens: 8192 } : { max_tokens: 8192 }),
        ...(json ? { response_format: { type: 'json_object' } } : {}),
        messages: [{ role: 'system', content: instruction }, { role: 'user', content: prompt }] };
    }
    const response = await providerFetch(url, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, requestSignal);
    const data = await readJson(response);
    let text = '';
    if (isRecord(data)) {
      if (provider === 'gemini' && Array.isArray(data.candidates)) {
        const candidate: unknown = data.candidates[0];
        if (isRecord(candidate) && candidate.finishReason === 'STOP' && isRecord(candidate.content) && Array.isArray(candidate.content.parts)) {
          text = candidate.content.parts.filter((part: unknown) => isRecord(part) && part.thought !== true && typeof part.text === 'string').map((part: { text: string }) => part.text).join('');
        }
      } else if (provider === 'claude' && data.stop_reason === 'end_turn' && Array.isArray(data.content)) {
        text = data.content.filter((part: unknown) => isRecord(part) && part.type === 'text' && typeof part.text === 'string').map((part: { text: string }) => part.text).join('');
      } else if (provider === 'openai' && Array.isArray(data.choices)) {
        const choice: unknown = data.choices[0];
        if (isRecord(choice) && choice.finish_reason === 'stop' && isRecord(choice.message) && !choice.message.refusal && typeof choice.message.content === 'string') text = choice.message.content;
      }
    }
    if (!text.trim()) throw new AiRequestError('The model did not finish the report. Tap Send to retry.');
    return text.trim();
  });
  checkAborted(signal);
  onPhase('feedback');
  const report = parseTeachingReport(await complete(TEACHING_ANALYSIS_SYSTEM_PROMPT,
    buildTeachingAnalysisPrompt(input.transcript, input.subject, input.topic, input.classLevel), true));
  checkAborted(signal);
  onPhase('notes');
  const classNotes = await complete(CLASS_NOTES_SYSTEM_PROMPT,
    buildClassNotesPrompt(input.transcript, input.subject, input.topic, input.classLevel), false);
  checkAborted(signal);
  return { report, classNotes, model: selectedModel };
}
