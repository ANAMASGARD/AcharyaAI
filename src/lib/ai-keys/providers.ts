export const aiProviders = [
  { id: 'gnani', keyUrl: 'https://app.gnani.ai/voice/', name: 'Gnani AI', description: 'Speech-to-text & read aloud' },
  { id: 'openai', keyUrl: 'https://platform.openai.com/api-keys', name: 'OpenAI / compatible', description: 'Text chat · compatible APIs' },
  { id: 'gemini', keyUrl: 'https://aistudio.google.com/apikey', name: 'Google Gemini', description: 'Text chat · Google' },
  { id: 'claude', keyUrl: 'https://platform.claude.com/settings/keys', name: 'Anthropic Claude', description: 'Text chat · Anthropic' },
] as const;

export type AiProvider = typeof aiProviders[number]['id'];
export type ReasoningProvider = Exclude<AiProvider, 'gnani'>;
export const defaultModels: Record<ReasoningProvider, string> = { openai: 'gpt-4.1-mini', gemini: 'gemini-3.8-flash', claude: 'claude-sonnet-5-5' };
export type ProviderCredential = Readonly<{ apiKey: string; baseUrl?: string; model?: string }>;
export type ProviderSummary = Readonly<{ configured: boolean; baseUrl?: string; model?: string }>;
export const defaultOpenAiUrl = 'https://api.openai.com/v1';

export function validateCredential(provider: AiProvider, input: ProviderCredential): ProviderCredential {
  if (!aiProviders.some((item) => item.id === provider)) throw new Error('Unknown provider.');
  const apiKey = input.apiKey.trim();
  if (!apiKey || apiKey.length > 1024 || !/^[\x21-\x7e]+$/.test(apiKey)) {
    throw new Error('Enter an API key of up to 1,024 characters, without spaces.');
  }
  if (provider === 'gnani') return { apiKey };
  const model = input.model?.trim() || defaultModels[provider];
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,127}$/.test(model)) throw new Error('Enter a valid model ID (up to 128 characters).');
  if (provider !== 'openai') return { apiKey, model };
  let url: URL;
  try { url = new URL(input.baseUrl?.trim() || defaultOpenAiUrl); }
  catch { throw new Error('Enter a valid HTTPS base URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.href.length > 512) {
    throw new Error('Use an HTTPS base URL without credentials, query parameters, or a fragment.');
  }
  return { apiKey, model, baseUrl: url.href.replace(/\/+$/, '') };
}
