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
  try { value = JSON.parse(content); } catch { throw new AiRequestError('OpenAI returned an unreadable report. Tap Send to retry.'); }
  if (!isRecord(value) || !fields.every((key) => typeof value[key] === 'string' && value[key].trim().length > 0 && value[key].length <= 20_000) ||
      typeof value.overallScore !== 'number' || !Number.isInteger(value.overallScore) || value.overallScore < 0 || value.overallScore > 100) {
    throw new AiRequestError('OpenAI returned an incomplete report. Tap Send to retry.');
  }
  return { classroomEnvironment: value.classroomEnvironment as string, whatWentWrong: value.whatWentWrong as string,
    areasToImprove: value.areasToImprove as string, topicSpecificFeedback: value.topicSpecificFeedback as string, overallScore: value.overallScore };
}

export async function generateClassReport(owner: string, input: ClassReportInput, signal: AbortSignal,
  onPhase: (phase: ReportPhase) => void): Promise<ClassReportResult> {
  if (!input.transcript.trim() || input.transcript.length > 240_000) {
    throw new AiRequestError('The transcript must contain speech and be under 240,000 characters. Nothing was sent.');
  }
  const complete = (instruction: string, prompt: string, json: boolean) => withProvider(owner, 'openai', signal, async (credential, requestSignal) => {
    const response = await providerFetch(`${credential.baseUrl}/chat/completions`, {
      method: 'POST', headers: { Authorization: `Bearer ${credential.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: CLASS_REPORT_MODEL, reasoning_effort: 'low', max_completion_tokens: 8192,
        ...(json ? { response_format: { type: 'json_object' } } : {}),
        messages: [{ role: 'system', content: instruction }, { role: 'user', content: prompt }] }),
    }, requestSignal);
    const data = await readJson(response);
    const choice: unknown = isRecord(data) && Array.isArray(data.choices) ? data.choices[0] : null;
    if (!isRecord(choice) || choice.finish_reason !== 'stop' || !isRecord(choice.message) || choice.message.refusal ||
        typeof choice.message.content !== 'string' || !choice.message.content.trim()) {
      throw new AiRequestError('OpenAI did not finish the report. Tap Send to retry.');
    }
    return choice.message.content.trim();
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
  return { report, classNotes, model: CLASS_REPORT_MODEL };
}
