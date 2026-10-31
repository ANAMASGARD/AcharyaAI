import { Pressable } from '@/components/feedback/pressable';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { PreviewAttachment } from '@/lib/ui-preview/types';
import { useThemeColors, useThemeStyles } from '@/theme/use-theme';
import type { ThemeColors } from '@/theme/colors';

export function ChatAttachments({ files, onRemove }: { files: PreviewAttachment[]; onRemove?: (id: string) => void }): React.ReactElement {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);
  return <View style={styles.list}>{files.map((file) => <View key={file.id} style={styles.item}>
    {file.uri && file.mimeType.startsWith('image/') ? <Image source={{ uri: file.uri }} style={styles.image} contentFit="cover" /> : <MaterialCommunityIcons name="file-document-outline" color={colors.foreground} size={24} />}
    <Text numberOfLines={2} style={styles.name}>{file.name}{!file.uri ? ' · select again' : ''}</Text>
    {onRemove && <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${file.name}`} onPress={() => onRemove(file.id)} style={styles.remove}><MaterialCommunityIcons name="close" size={20} color={colors.foreground} /></Pressable>}
  </View>)}</View>;
}
const createStyles = (colors: ThemeColors) => StyleSheet.create({
  list: { gap: 6, padding: 8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 4 },
  image: { width: 44, height: 44, borderRadius: 8 },
  name: { flex: 1, color: colors.foreground, fontSize: 13 },
  remove: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
