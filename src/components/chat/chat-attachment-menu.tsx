import { Pressable } from '@/components/feedback/pressable';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AcharyaBlurView } from '@/components/ui/acharya-blur';
import { useColorMode, useThemeColors, useThemeStyles } from '@/theme/use-theme';
import type { ThemeColors } from '@/theme/colors';
import type { ChatAttachmentSource } from '@/hooks/use-chat-attachments';
import { fontFamilies } from '@/theme/typography';

const OPTIONS = [
  { id: 'camera', title: 'Camera', icon: 'camera', accent: 'apricot' },
  { id: 'photos', title: 'Photos', icon: 'images', accent: 'lavender' },
  { id: 'files', title: 'Files', icon: 'folder-open', accent: 'sky' },
] as const;

export function ChatAttachmentMenu({ visible, onClose, onSelect }: {
  visible: boolean; onClose: () => void; onSelect: (source: ChatAttachmentSource) => void;
}): React.ReactElement {
  const colors = useThemeColors();
  const mode = useColorMode();
  const styles = useThemeStyles(createStyles);
  return <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
    <View style={styles.backdrop}>
      <AcharyaBlurView pointerEvents="none" intensity={30} tint={mode} style={StyleSheet.absoluteFill} />
      <Pressable soundFeedback={false} accessibilityLabel="Close attachment menu" accessibilityRole="button" style={[StyleSheet.absoluteFill, styles.scrim]} onPress={onClose} />
      <View accessibilityViewIsModal style={styles.menu}>
        <View style={styles.header}>
          <Ionicons name="attach" size={26} color={colors.onAccent} />
          <Text accessibilityRole="header" style={styles.title}>Add attachment</Text>
        </View>
        <View style={styles.body}>
          {OPTIONS.map((option) => <Pressable key={option.id} accessibilityRole="button" onPress={() => onSelect(option.id)} style={({ pressed }) => [styles.option, pressed && styles.pressed]}>
            <View style={[styles.iconBadge, { backgroundColor: colors[option.accent] }]}>
              <Ionicons name={option.icon} size={26} color={colors.onAccent} />
            </View>
            <Text style={styles.label}>{option.title}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
          </Pressable>)}
          <Pressable accessibilityRole="button" onPress={onClose} style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}>
            <Ionicons name="close-circle-outline" size={22} color={colors.destructiveForeground} />
            <Text style={styles.cancelLabel}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </View>
  </Modal>;
}
const createStyles = (colors: ThemeColors) => StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  scrim: { backgroundColor: 'rgba(0,0,0,0.22)' },
  menu: { width: '100%', maxWidth: 340, backgroundColor: colors.card, borderRadius: 24, borderWidth: 2, borderColor: colors.border, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 20, backgroundColor: colors.apricot, borderBottomWidth: 2, borderBottomColor: colors.onAccent },
  title: { flex: 1, color: colors.onAccent, fontFamily: fontFamilies.sansBold, fontSize: 20 },
  body: { padding: 14, gap: 8 },
  option: { minHeight: 64, flexDirection: 'row', gap: 14, alignItems: 'center', paddingHorizontal: 6, paddingVertical: 6 },
  iconBadge: { width: 48, height: 48, borderRadius: 16, borderWidth: 2, borderColor: colors.onAccent, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, color: colors.foreground, fontFamily: fontFamilies.sansMedium, fontSize: 17 },
  cancel: { minHeight: 48, borderRadius: 16, borderWidth: 2, borderColor: colors.onAccent, backgroundColor: colors.destructive, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, marginTop: 6 },
  cancelLabel: { color: colors.destructiveForeground, fontFamily: fontFamilies.sansBold, fontSize: 16 },
  pressed: { opacity: 0.7 },
});
