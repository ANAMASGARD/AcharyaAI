import { getActiveProvider } from '@/lib/ai-keys/vault';
import type { ChatMessage } from '@/types/chat';
import { withProvider, providerFetch, readJson, isRecord, AiRequestError, checkAborted } from './transport';
const instruction = 'You are Acharya, a helpful teaching coach. Be clear and practical. Do not claim access to curriculum, files, classroom recordings, or student data unless included in this conversation. Respond in the language requested by the teacher.';

export async function generateChatReply(owner: string, messages: readonly ChatMessage[], signal: AbortSignal): Promise<string> {
  const provider = await getActiveProvider(owner);
  checkAborted(signal);
  const history = messages.filter((message) => message.role === 'user' || message.role === 'assistant').slice(-30)
    .map(({ role, content }) => ({ role, content }));
  while (history[0]?.role === 'assistant') history.shift();
  if (!history.length || history.reduce((count, item) => count + item.content.length, 0) > 60_000) {
    throw new AiRequestError('This chat is too long. Start a new conversation.');
  }
  return withProvider(owner, provider, signal, async (credential, requestSignal) => {
    let url: string;
    let headers: Record<string, string>;
    let body: unknown;
    if (provider === 'gemini') {
      url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(credential.model!)}:generateContent`;
      headers = { 'x-goog-api-key': credential.apiKey };
      body = { systemInstruction: { parts: [{ text: instruction }] },
        contents: history.map((message) => ({ role: message.role === 'assistant' ? 'model' : 'user', parts: [{ text: message.content }] })) };
    } else if (provider === 'claude') {
      url = 'https://api.anthropic.com/v1/messages';
      headers = { 'x-api-key': credential.apiKey, 'anthropic-version': '2023-06-01' };
      body = { model: credential.model, max_tokens: 4096, system: instruction, messages: history };
    } else {
      url = `${credential.baseUrl}/chat/completions`;
      headers = { Authorization: `Bearer ${credential.apiKey}` };
      body = { model: credential.model, messages: [{ role: 'system', content: instruction }, ...history] };
    }
    const response = await providerFetch(url, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, requestSignal);
    const data = await readJson(response);
    let text = '';
    if (isRecord(data)) {
      if (provider === 'gemini' && Array.isArray(data.candidates)) {
        const candidate: unknown = data.candidates[0];
        if (isRecord(candidate) && isRecord(candidate.content) && Array.isArray(candidate.content.parts)) {
          text = candidate.content.parts.filter((part: unknown) => isRecord(part) && part.thought !== true && typeof part.text === 'string').map((part: { text: string }) => part.text).join('');
        }
      } else if (provider === 'claude' && Array.isArray(data.content)) {
        text = data.content.filter((part: unknown) => isRecord(part) && part.type === 'text' && typeof part.text === 'string').map((part: { text: string }) => part.text).join('');
      } else if (provider === 'openai' && Array.isArray(data.choices)) {
        const choice: unknown = data.choices[0];
        if (isRecord(choice) && isRecord(choice.message) && typeof choice.message.content === 'string') text = choice.message.content;
      }
    }
    if (!text.trim()) throw new AiRequestError('The model returned no text. Check model access or try another prompt.');
    return text.trim();
  });
}
