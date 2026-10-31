import { Pressable } from '@/components/feedback/pressable';
import { listProviderModels, type ProviderModel } from '@/lib/ai/models';
import { updateProviderModel } from '@/lib/ai-keys/vault';
import type { ReasoningProvider } from '@/lib/ai-keys/providers';
import { useThemeStyles } from '@/theme/use-theme';
import type { ThemeColors } from '@/theme/colors';
import { fontFamilies } from '@/theme/typography';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = { owner: string; provider: ReasoningProvider; title: string; selected: string; onSelect: (model: string) => void; onClose: () => void };
export function ProviderModelPicker({ owner, provider, title, selected, onSelect, onClose }: Props): React.ReactElement {
  const styles = useThemeStyles(createStyles);
  const [models, setModels] = useState<ProviderModel[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const [modelId, setModelId] = useState(selected);
  const [saving, setSaving] = useState(false);
  const request = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const writing = useRef(false);
  const load = useCallback(() => {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    return listProviderModels(owner, provider, controller.signal).then((result) => {
      if (alive.current && !controller.signal.aborted) setModels(result);
    }).catch((cause: unknown) => {
      if (alive.current && !controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load models.');
    }).finally(() => {
      if (alive.current && !controller.signal.aborted) setLoading(false);
    });
  }, [owner, provider]);
  useEffect(() => {
    alive.current = true;
    void load();
    return () => { alive.current = false; request.current?.abort(); };
  }, [load]);
  const choose = async (id: string) => {
    if (writing.current || !alive.current) return;
    writing.current = true; setSaving(true); setError(null);
    try {
      await updateProviderModel(owner, provider, id);
      if (alive.current) onSelect(id);
    } catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : 'Could not save model.'); }
    finally { writing.current = false; if (alive.current) setSaving(false); }
  };
  const close = () => { if (!writing.current) { alive.current = false; request.current?.abort(); onClose(); } };
  const search = query.trim().toLowerCase();
  const filtered = models.filter((model) => `${model.name} ${model.id} ${model.description}`.toLowerCase().includes(search));
  return <Modal visible animationType="slide" onRequestClose={close} presentationStyle="pageSheet">
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>{title} models</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Close model picker" disabled={saving} onPress={close} style={styles.iconButton}>
          <MaterialCommunityIcons name="close" size={24} color={styles.text.color} />
        </Pressable>
      </View>
      <Text style={styles.hint}>Live provider catalog · availability and chat support vary.</Text>
      <View style={styles.controls}>
        <TextInput accessibilityLabel="Search models" placeholder="Search models" placeholderTextColor={styles.hint.color} value={query} onChangeText={setQuery} style={styles.input} autoCorrect={false} />
        <Pressable accessibilityRole="button" accessibilityLabel="Refresh models" disabled={loading || saving} onPress={() => { setLoading(true); setError(null); setModels([]); void load(); }} style={styles.iconButton}>
          <MaterialCommunityIcons name="refresh" size={24} color={styles.text.color} />
        </Pressable>
      </View>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator accessibilityLabel="Loading models" style={styles.loader} /> : null}
      {saving ? <Text accessibilityLiveRegion="polite" style={styles.hint}>Saving model…</Text> : null}
      <FlatList data={filtered} keyExtractor={(item) => item.id} keyboardShouldPersistTaps="handled" style={styles.list}
        ListEmptyComponent={!loading && !error ? <Text style={styles.hint}>{query ? 'No matching models.' : 'No models returned. Try Refresh or enter an ID.'}</Text> : null}
        renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`${item.name}. ${item.description}`}
          accessibilityState={{ selected: item.id === selected, disabled: saving || !item.selectable }} disabled={saving || !item.selectable}
          onPress={() => void choose(item.id)} style={[styles.row, item.id === selected && styles.selected, !item.selectable && styles.disabled]}>
          <View style={styles.itemText}>
            <Text style={styles.name}>{item.name}</Text>
            {item.name !== item.id ? <Text style={styles.detail} numberOfLines={1}>{item.id}</Text> : null}
            <Text style={styles.detail} numberOfLines={2}>{item.description}</Text>
          </View>
          {item.id === selected ? <MaterialCommunityIcons name="check-circle" size={22} color={styles.success.color} /> : null}
        </Pressable>} />
      <View style={styles.footer}>
        <Pressable accessibilityRole="button" onPress={() => setManual(!manual)} style={styles.manualButton}><Text style={styles.text}>{manual ? 'Hide custom ID' : 'Enter a model ID manually'}</Text></Pressable>
        {manual ? <View style={styles.controls}>
          <TextInput accessibilityLabel="Custom model ID" value={modelId} onChangeText={setModelId} editable={!saving} autoCapitalize="none" autoCorrect={false} maxLength={128} style={styles.input} />
          <Pressable accessibilityRole="button" disabled={saving || !modelId.trim()} onPress={() => void choose(modelId.trim())} style={styles.iconButton}><Text style={styles.text}>Save</Text></Pressable>
        </View> : null}
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </Modal>;
}
const createStyles = (colors: ThemeColors) => StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1, backgroundColor: colors.cream },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, gap: 8 },
  title: { fontFamily: fontFamilies.head, fontSize: 22, color: colors.foreground, flex: 1 },
  text: { color: colors.foreground, fontFamily: fontFamilies.sansMedium, fontSize: 15 },
  hint: { color: colors.mutedForeground, fontFamily: fontFamilies.sans, fontSize: 13, paddingHorizontal: 20, paddingVertical: 8 },
  controls: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, gap: 8, paddingVertical: 8 },
  input: { flex: 1, minHeight: 48, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.input, color: colors.foreground, borderRadius: 8, padding: 12, fontFamily: fontFamilies.sans },
  iconButton: { minWidth: 48, minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  error: { padding: 20, fontFamily: fontFamilies.sans, fontSize: 14, color: colors.destructive },
  loader: { padding: 12 },
  list: { flex: 1 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 16, marginHorizontal: 20, marginBottom: 10, borderWidth: 2, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.card },
  selected: { borderColor: colors.success },
  disabled: { opacity: 0.5 },
  itemText: { flex: 1, gap: 4 },
  name: { color: colors.foreground, fontFamily: fontFamilies.sansBold, fontSize: 16 },
  detail: { color: colors.mutedForeground, fontFamily: fontFamilies.sans, fontSize: 13, lineHeight: 18 },
  success: { color: colors.success },
  footer: { paddingBottom: 8 },
  manualButton: { minHeight: 44, paddingHorizontal: 20, justifyContent: 'center' },
});
