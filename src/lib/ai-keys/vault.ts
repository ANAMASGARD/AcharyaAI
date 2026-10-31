import { cancelAiRequests } from '@/lib/ai/cancellation';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { aiProviders, validateCredential, type AiProvider, type ProviderCredential, type ReasoningProvider, type ProviderSummary } from './providers';

const options: SecureStore.SecureStoreOptions = {
  keychainService: 'acharya.byok.v1',
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

// Serialize writes and cleanup: a queued save cannot resurrect a key after deletion.
let pending: Promise<unknown> = Promise.resolve();
function serialized<T>(operation: () => Promise<T>): Promise<T> {
  const next = pending.then(operation, operation);
  pending = next.catch(() => undefined);
  return next;
}

async function storageKey(owner: string, provider: AiProvider | 'active'): Promise<string> {
  if (!owner) throw new Error('Sign in to manage your API keys.');
  if (Platform.OS === 'web' || !(await SecureStore.isAvailableAsync())) {
    throw new Error('Encrypted API key storage is available only in the Android and iOS app.');
  }
  const scope = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, owner);
  return `byok.v1.${scope}.${provider}`;
}

export function saveProviderCredential(owner: string, provider: AiProvider, input: ProviderCredential): Promise<void> {
  return serialized(async () => {
    const credential = validateCredential(provider, input);
    if (JSON.stringify(credential).length > 2048) throw new Error('API configuration is too large for secure storage.');
    const key = await storageKey(owner, provider);
    try {
      await SecureStore.setItemAsync(key, JSON.stringify(credential), options);
      if (provider !== 'gnani') await SecureStore.setItemAsync(await storageKey(owner, 'active'), provider, options);
    }
    catch { throw new Error('Could not save the key securely. Unlock your device and try again.'); }
  });
}

/** Settings reads only status unless the user explicitly reveals a saved key. */
export function getProviderSummary(owner: string, provider: AiProvider): Promise<ProviderSummary> {
  return serialized(async () => {
    const key = await storageKey(owner, provider);
    try {
      const stored = await SecureStore.getItemAsync(key, options);
      if (stored === null) return { configured: false };
      const credential = validateCredential(provider, JSON.parse(stored) as ProviderCredential);
      return { configured: true, baseUrl: credential.baseUrl, model: credential.model };
    } catch { throw new Error('Could not read the saved key. Unlock your device, or replace or remove the key.'); }
  });
}

export function removeProviderCredential(owner: string, provider: AiProvider): Promise<void> {
  return serialized(async () => {
    const key = await storageKey(owner, provider);
    try { await SecureStore.deleteItemAsync(key, options); }
    catch { throw new Error('Could not remove the saved key. Unlock your device and try again.'); }
  });
}

export async function clearProviderCredentials(owner: string): Promise<void> {
  cancelAiRequests(owner);
  if (Platform.OS === 'web') return;
  // Attempt every provider even if one deletion fails; never touch Clerk's keychain service.
  const results = await Promise.allSettled([
    ...aiProviders.map(({ id }) => removeProviderCredential(owner, id)),
    serialized(async () => SecureStore.deleteItemAsync(await storageKey(owner, 'active'), options)),
  ]);
  if (results.some((result) => result.status === 'rejected')) {
    throw new Error('Could not remove all API keys. Unlock your device and retry before leaving this account.');
  }
}

/** Read only at explicit reveal or immediately before a direct provider request. Never persist elsewhere. */
export function getProviderCredential(owner: string, provider: AiProvider): Promise<ProviderCredential> {
  return serialized(async () => {
    const key = await storageKey(owner, provider);
    let stored: string | null;
    try { stored = await SecureStore.getItemAsync(key, options); }
    catch { throw new Error('Could not open encrypted API keys. Unlock your device and try again.'); }
    if (stored === null) throw new Error(`Add your ${aiProviders.find((item) => item.id === provider)?.name ?? 'AI'} key in Profile → AI API keys.`);
    try { return validateCredential(provider, JSON.parse(stored) as ProviderCredential); }
    catch { throw new Error('The saved API configuration is invalid. Replace it in AI API keys.'); }
  });
}

export function setActiveProvider(owner: string, provider: ReasoningProvider): Promise<void> {
  return serialized(async () => {
    if (!['gemini', 'openai', 'claude'].includes(provider)) throw new Error('Select a supported chat provider.');
    try {
      if (!(await SecureStore.getItemAsync(await storageKey(owner, provider), options))) throw new Error();
      await SecureStore.setItemAsync(await storageKey(owner, 'active'), provider, options);
    } catch { throw new Error('Save a key for this provider before selecting it.'); }
  });
}

export function getActiveProvider(owner: string): Promise<ReasoningProvider> {
  return serialized(async () => {
    let selected: string | null;
    try { selected = await SecureStore.getItemAsync(await storageKey(owner, 'active'), options); }
    catch { throw new Error('Could not read your chat provider. Open AI API keys to configure it.'); }
    if (selected === 'gemini' || selected === 'openai' || selected === 'claude') return selected;
    // Older saved keys predate provider selection. Choose the first configured provider once.
    for (const provider of ['gemini', 'openai', 'claude'] as const) {
      if (await SecureStore.getItemAsync(await storageKey(owner, provider), options)) return provider;
    }
    throw new Error('Save a Gemini, OpenAI-compatible, or Claude key in Profile → AI API keys to chat.');
  });
}

/** Model-only updates stay inside SecureStore; UI never needs to retrieve the saved secret. */
export function updateProviderModel(owner: string, provider: ReasoningProvider, model: string): Promise<void> {
  return serialized(async () => {
    const key = await storageKey(owner, provider);
    try {
      const stored = await SecureStore.getItemAsync(key, options);
      if (!stored) throw new Error();
      const current = validateCredential(provider, JSON.parse(stored) as ProviderCredential);
      const updated = validateCredential(provider, { ...current, model });
      if (JSON.stringify(updated).length > 2048) throw new Error();
      await SecureStore.setItemAsync(key, JSON.stringify(updated), options);
    } catch { throw new Error('Could not save the model. Check the ID and your saved key.'); }
  });
}
