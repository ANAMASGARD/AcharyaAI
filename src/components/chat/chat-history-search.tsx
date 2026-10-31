import { Pressable } from '@/components/feedback/pressable';
import { useState } from 'react';
import { Keyboard, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors, useThemeStyles } from '@/theme/use-theme';
import type { ThemeColors } from '@/theme/colors';
import { fontFamilies } from '@/theme/typography';

/** Search presentation only; no filtering, history lookup, or network requests. */
export function ChatHistorySearch({ onClose }: { onClose: () => void }): React.ReactElement {
  const [query, setQuery] = useState('');
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);
  return <View style={styles.page}>
    <View style={styles.toolbar}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to chat history" onPress={() => { Keyboard.dismiss(); onClose(); }} style={styles.back}>
        <MaterialCommunityIcons name="arrow-left" size={24} color={colors.foreground} />
      </Pressable>
      <View style={styles.field}>
        <MaterialCommunityIcons name="magnify" size={22} color={colors.mutedForeground} />
        <TextInput
          autoFocus
          accessibilityLabel="Search chats"
          placeholder="Search chats"
          placeholderTextColor={colors.mutedForeground}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          onSubmitEditing={Keyboard.dismiss}
          autoCorrect={false}
          style={styles.input}
        />
        {query.length > 0 && <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery('')} style={styles.clear}>
          <MaterialCommunityIcons name="close-circle" size={20} color={colors.mutedForeground} />
        </Pressable>}
      </View>
    </View>
    <View style={styles.hint}>
      <MaterialCommunityIcons name="text-search" size={34} color={colors.mutedForeground} />
      <Text style={styles.title}>Find a conversation</Text>
      <Text style={styles.caption}>Search by a word or phrase from a past chat.</Text>
      <Text style={styles.caption}>Search preview · results are not connected yet.</Text>
    </View>
  </View>;
}
const createStyles = (colors: ThemeColors) => StyleSheet.create({
  page: { flex: 1 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  field: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.cream, borderWidth: 2, borderColor: colors.border, borderRadius: 24, paddingLeft: 10 },
  input: { flex: 1, minWidth: 0, minHeight: 44, paddingHorizontal: 6, color: colors.foreground, fontFamily: fontFamilies.sans, fontSize: 15 },
  clear: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  hint: { alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingTop: 32 },
  title: { color: colors.foreground, fontFamily: fontFamilies.sansBold, fontSize: 17 },
  caption: { color: colors.mutedForeground, fontFamily: fontFamilies.sans, fontSize: 14, textAlign: 'center' },
});
