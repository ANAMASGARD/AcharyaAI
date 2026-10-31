import { ProviderModelPicker } from '@/components/profile/provider-model-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable } from '@/components/feedback/pressable';
import { aiProviders, defaultOpenAiUrl, defaultModels, validateCredential } from '@/lib/ai-keys/providers';
import { getProviderSummary, getProviderCredential, setActiveProvider, removeProviderCredential, saveProviderCredential } from '@/lib/ai-keys/vault';
import { confirmAction } from '@/lib/confirm-action';
import type { ThemeColors } from '@/theme/colors';
import { fontFamilies } from '@/theme/typography';
import { useThemeStyles } from '@/theme/use-theme';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, TextInput, View } from 'react-native';

type Props = Readonly<{ owner: string; provider: typeof aiProviders[number] }>;

export function ProviderKeyCard({ owner, provider }: Props): React.ReactElement {
  const styles = useThemeStyles(createStyles);
  const [apiKey, setApiKey] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [model, setModel] = useState(provider.id === 'gnani' ? '' : defaultModels[provider.id]);
  const [baseUrl, setBaseUrl] = useState(defaultOpenAiUrl);
  const [savedBaseUrl, setSavedBaseUrl] = useState(defaultOpenAiUrl);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(false);
  const operation = useRef(false);

  useEffect(() => {
    mounted.current = true;
    let current = true;
    void getProviderSummary(owner, provider.id).then((summary) => {
      if (!current) return;
      setConfigured(summary.configured);
      if (summary.model) setModel(summary.model);
      setBaseUrl(summary.baseUrl ?? defaultOpenAiUrl);
      setSavedBaseUrl(summary.baseUrl ?? defaultOpenAiUrl);
    }).catch(() => {
      if (current) setError('Could not read the saved key. Unlock your device, or replace or remove the key.');
    }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; mounted.current = false; };
  }, [owner, provider.id]);

  const save = async (): Promise<void> => {
    if (operation.current || loading || !mounted.current) return;
    setError(null);
    setMessage(null);
    let credential;
    try { credential = validateCredential(provider.id, { apiKey, baseUrl, model }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Check your API key and endpoint.'); return; }
    operation.current = true;
    setBusy(true);
    try {
      await saveProviderCredential(owner, provider.id, credential);
      if (!mounted.current) return;
      setConfigured(true);
      setBaseUrl(credential.baseUrl ?? defaultOpenAiUrl);
      setSavedBaseUrl(credential.baseUrl ?? defaultOpenAiUrl);
      setMessage(provider.id === 'gnani' ? 'Saved locally.' : 'Saved · selected for chat.');
    } catch {
      if (mounted.current) setError('Could not save securely. Unlock your device and try again.');
    } finally {
      operation.current = false;
      if (mounted.current) { setApiKey(''); setRevealed(false); setBusy(false); }
    }
  };

  const remove = async (): Promise<void> => {
    if (operation.current || loading || !mounted.current) return;
    operation.current = true;
    setBusy(true);
    try {
      const confirmed = await confirmAction('Remove API key', `Remove the saved ${provider.name} key from this device? This does not revoke it at the provider.`, 'Remove');
      if (!confirmed || !mounted.current) return;
      setError(null);
      setMessage(null);
      await removeProviderCredential(owner, provider.id);
      if (!mounted.current) return;
      setConfigured(false);
      setApiKey('');
      setBaseUrl(defaultOpenAiUrl);
      setMessage('Key removed from this device.');
    } catch {
      if (mounted.current) setError('Could not remove the key. Unlock your device and try again.');
    } finally {
      operation.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const toggleVisibility = async (): Promise<void> => {
    if (operation.current || loading || !mounted.current) return;
    if (revealed) { setRevealed(false); return; }
    if (apiKey || !configured) { setRevealed(true); return; }
    operation.current = true;
    setBusy(true);
    setError(null);
    try {
      const saved = await getProviderCredential(owner, provider.id);
      if (mounted.current) { setApiKey(saved.apiKey); setRevealed(true); }
    } catch { if (mounted.current) setError('Could not reveal the key. Unlock your device and try again.'); }
    finally { operation.current = false; if (mounted.current) setBusy(false); }
  };
  const selectForChat = async (): Promise<void> => {
    if (provider.id === 'gnani' || operation.current || !mounted.current) return;
    operation.current = true;
    setBusy(true);
    try {
      await setActiveProvider(owner, provider.id);
      if (mounted.current) { setMessage('Selected for chat.'); setError(null); }
    } catch { if (mounted.current) setError('Could not select this provider. Save its key first.'); }
    finally { operation.current = false; if (mounted.current) setBusy(false); }
  };

  const openKeyPage = async (): Promise<void> => {
    setError(null);
    try { await Linking.openURL(provider.keyUrl); }
    catch { if (mounted.current) setError('Could not open the provider website. Please try again.'); }
  };

  const canBrowseModels = configured && !busy && !loading && (provider.id !== 'openai' || baseUrl.replace(/\/+$/, '') === savedBaseUrl);
  return <View style={styles.card}>
    <View style={styles.titleRow}>
      {configured ? <View style={styles.savedDot} /> : null}
      <Text accessibilityRole="header" style={styles.title}>{provider.name}</Text>
    </View>
    <Text style={styles.body}>{provider.description}</Text>
    <Pressable accessibilityRole="link" accessibilityLabel={`Open ${provider.name} official API key page`}
      accessibilityHint="Opens the provider website in your browser" onPress={() => void openKeyPage()} style={styles.keyLink}>
      <Text style={styles.linkText}>{provider.id === 'openai' ? 'Get an OpenAI API key' : 'Get API key'}</Text>
      <MaterialCommunityIcons name="open-in-new" size={18} color={styles.linkText.color} />
    </Pressable>
    {loading ? <ActivityIndicator accessibilityLabel={`Loading ${provider.name} key status`} />
      : <View style={styles.savedRow} accessibilityLabel={configured ? 'API key saved locally' : 'No key saved'}>
        {configured ? <MaterialCommunityIcons name="check-circle" size={18} color={styles.success.color} /> : null}
        <Text style={[styles.status, configured && styles.success]}>{configured ? 'Saved locally' : 'Not saved'}</Text>
      </View>}
    {provider.id === 'openai' ? <>
      <Text style={styles.label}>API base URL</Text>
      <TextInput accessibilityLabel="OpenAI-compatible API base URL" value={baseUrl} onChangeText={setBaseUrl}
        editable={!busy && !loading} autoCapitalize="none" autoCorrect={false} keyboardType="url"
        maxLength={512} style={styles.input} placeholder={defaultOpenAiUrl} placeholderTextColor={styles.placeholder.color} />
      <Text style={styles.body}>Custom endpoint? Use its own API key.</Text>
    </> : null}
    {provider.id !== 'gnani' ? <>
      <Text style={styles.label}>Chat model</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`Choose ${provider.name} chat model`} accessibilityState={{ disabled: !canBrowseModels }}
        disabled={!canBrowseModels} onPress={() => setPickerOpen(true)} style={[styles.modelButton, !canBrowseModels && styles.disabled]}>
        <Text style={styles.modelText} numberOfLines={1}>{model || 'Choose model'}</Text>
        <MaterialCommunityIcons name="chevron-down" size={22} color={styles.label.color} />
      </Pressable>
      {!canBrowseModels && !busy && !loading ? <Text style={styles.body}>Save your key and endpoint to browse models.</Text> : null}
      {pickerOpen ? <ProviderModelPicker owner={owner} provider={provider.id} title={provider.name} selected={model}
        onClose={() => setPickerOpen(false)} onSelect={(selected) => { setModel(selected); setPickerOpen(false); setMessage('Model saved.'); }} /> : null}
    </> : null}
    <Text style={styles.label}>API key</Text>
    <View style={styles.keyRow}>
    <TextInput accessibilityLabel={`${provider.name} ${configured ? 'replacement ' : ''}API key`}
      value={apiKey} onChangeText={setApiKey} secureTextEntry={!revealed} autoCapitalize="none" autoCorrect={false}
      autoComplete="off" textContentType="none" importantForAutofill="noExcludeDescendants" spellCheck={false}
      editable={!busy && !loading} maxLength={1024} style={[styles.input, styles.keyInput]}
      placeholder={configured ? 'Saved key · tap eye to view' : 'Paste your API key'} placeholderTextColor={styles.placeholder.color} />
      <Pressable accessibilityRole="button" accessibilityLabel={revealed ? `Hide ${provider.name} key` : `Show ${provider.name} key`}
        accessibilityState={{ disabled: busy || loading, checked: revealed }} disabled={busy || loading}
        onPress={() => void toggleVisibility()} style={styles.eye}>
        <MaterialCommunityIcons name={revealed ? 'eye-off-outline' : 'eye-outline'} color={styles.label.color} size={24} />
      </Pressable>
    </View>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {message ? <Text accessibilityLiveRegion="polite" style={styles.body}>{message}</Text> : null}
    {configured && provider.id !== 'gnani' ? <Pressable accessibilityRole="button" disabled={busy || loading}
      onPress={() => void selectForChat()} style={styles.button}><Text style={styles.label}>Use for chat</Text></Pressable> : null}
    <View style={styles.actions}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Save ${provider.name} key locally`}
        accessibilityState={{ disabled: busy || loading || !apiKey.trim() }} disabled={busy || loading || !apiKey.trim()}
        onPress={() => void save()} style={[styles.button, styles.save, (busy || loading || !apiKey.trim()) && styles.disabled]}>
        <Text style={styles.saveText}>{busy ? 'Working…' : configured ? 'Replace key' : 'Save locally'}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${provider.name} key`}
        accessibilityState={{ disabled: busy || loading }} disabled={busy || loading}
        onPress={() => void remove()} style={[styles.button, (busy || loading) && styles.disabled]}>
        <Text style={styles.label}>Remove</Text>
      </Pressable>
    </View>
  </View>;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  savedDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.success },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  success: { color: colors.success },
  modelButton: { minHeight: 48, borderWidth: 2, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  modelText: { flex: 1, color: colors.foreground, fontFamily: fontFamilies.sans, fontSize: 15 },
  keyLink: { minHeight: 44, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 8 },
  linkText: { fontFamily: fontFamilies.sansBold, fontSize: 15, color: colors.foreground, textDecorationLine: 'underline' },
  keyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  keyInput: { flex: 1 },
  eye: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.border, borderRadius: 8 },
  card: { backgroundColor: colors.card, borderWidth: 2, borderColor: colors.border, borderRadius: 12, padding: 16, gap: 12, boxShadow: `4px 4px 0 ${colors.border}` },
  title: { fontFamily: fontFamilies.head, fontSize: 20, color: colors.foreground, flex: 1 },
  body: { fontFamily: fontFamilies.sans, fontSize: 14, lineHeight: 21, color: colors.mutedForeground },
  status: { fontFamily: fontFamilies.sansBold, fontSize: 14, color: colors.foreground },
  label: { fontFamily: fontFamilies.sansBold, fontSize: 15, color: colors.foreground },
  input: { minHeight: 48, borderWidth: 2, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.input, color: colors.foreground, fontFamily: fontFamilies.sans, fontSize: 15 },
  placeholder: { color: colors.mutedForeground },
  error: { color: colors.destructive, fontFamily: fontFamilies.sansMedium, fontSize: 14, lineHeight: 21 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  button: { minHeight: 48, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 16 },
  save: { backgroundColor: colors.primary },
  saveText: { color: colors.primaryForeground, fontFamily: fontFamilies.sansBold, fontSize: 15 },
  disabled: { opacity: 0.5 },
});
