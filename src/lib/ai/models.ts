import type { ReasoningProvider } from '@/lib/ai-keys/providers';
import { withProvider, providerFetch, readJson, isRecord, AiRequestError, checkAborted } from './transport';

export type ProviderModel = Readonly<{ id: string; name: string; description: string; selectable: boolean }>;
const short = (value: unknown): string => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, 240) : '';
const context = (value: unknown): string => typeof value === 'number' && value > 0 ? `${value.toLocaleString()} input tokens` : '';

/** Fetch every page; never present a truncated or failed catalog as complete. */
export async function listProviderModels(owner: string, provider: ReasoningProvider, signal: AbortSignal): Promise<ProviderModel[]> {
  return withProvider(owner, provider, signal, async (credential, requestSignal) => {
    const models = new Map<string, ProviderModel>();
    const cursors = new Set<string>();
    let cursor = '';
    for (let page = 0; page < 100; page++) {
      checkAborted(requestSignal);
      let url: string;
      let headers: Record<string, string>;
      if (provider === 'gemini') {
        url = `https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000${cursor ? `&pageToken=${encodeURIComponent(cursor)}` : ''}`;
        headers = { 'x-goog-api-key': credential.apiKey };
      } else if (provider === 'claude') {
        url = `https://api.anthropic.com/v1/models?limit=1000${cursor ? `&after_id=${encodeURIComponent(cursor)}` : ''}`;
        headers = { 'x-api-key': credential.apiKey, 'anthropic-version': '2023-06-01' };
      } else {
        url = `${credential.baseUrl}/models${cursor ? `?after=${encodeURIComponent(cursor)}` : ''}`;
        headers = { Authorization: `Bearer ${credential.apiKey}` };
      }
      const data = await readJson(await providerFetch(url, { method: 'GET', headers }, requestSignal));
      if (!isRecord(data)) throw new AiRequestError('The provider returned an invalid model list.');
      const items = provider === 'gemini' ? data.models : data.data;
      if (!Array.isArray(items)) throw new AiRequestError('The provider returned an invalid model list.');
      for (const item of items) {
        if (!isRecord(item)) throw new AiRequestError('The provider returned an invalid model entry.');
        const id = provider === 'gemini' ? short(item.name).replace(/^models\//, '') : short(item.id);
        if (!id) throw new AiRequestError('The provider returned a model without an ID.');
        const supported = provider !== 'gemini' || !Array.isArray(item.supportedGenerationMethods) || item.supportedGenerationMethods.includes('generateContent');
        const selectable = supported && item.lifecycle !== 'retired' && /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,127}$/.test(id);
        const name = short(provider === 'gemini' ? item.displayName : item.display_name) || id;
        const description = !supported ? 'Not available for text chat'
          : item.lifecycle === 'retired' ? 'Retired model'
            : short(item.description) || (provider === 'claude' ? [short(item.line), context(item.max_input_tokens), short(item.lifecycle)].filter(Boolean).join(' · ') || 'Claude text model'
              : provider === 'gemini' ? context(item.inputTokenLimit) || 'Gemini content generation'
                : `${short(item.owned_by) || 'Provider'} · chat compatibility varies`);
        models.set(id, { id, name, description, selectable });
      }
      if (models.size > 10_000) throw new AiRequestError('The model catalog is too large. Enter a model ID instead.');
      let next = '';
      if (provider === 'gemini') {
        if (data.nextPageToken != null && typeof data.nextPageToken !== 'string') throw new AiRequestError('The provider returned invalid model pagination.');
        next = typeof data.nextPageToken === 'string' ? data.nextPageToken : '';
      } else if (data.has_more === true) {
        if (typeof data.last_id !== 'string' || !data.last_id) throw new AiRequestError('The provider returned invalid model pagination.');
        next = data.last_id;
      }
      if (!next) return [...models.values()].sort((a, b) => Number(b.selectable) - Number(a.selectable) || a.name.localeCompare(b.name));
      if (cursors.has(next)) throw new AiRequestError('The provider repeated a model page. Please refresh.');
      cursors.add(next); cursor = next;
    }
    throw new AiRequestError('The model catalog could not be completed. Please refresh or enter a model ID.');
  });
}
