import { Pressable } from '@/components/feedback/pressable';
import { useCommunity } from '@/hooks/use-community';
import { useThemeColors } from '@/theme/use-theme';
import { useAuth } from '@clerk/expo';
import { BottomSheet, Host } from '@expo/ui';
import { useState } from 'react';
import { Text, View } from 'react-native';

type Props = {
  targetType: 'post' | 'comment' | 'message';
  targetId: string;
  authorClerkId: string;
  onChanged?: () => void;
  onDelete?: () => Promise<void>;
};

/** The server checks the actor and target; these controls never grant permission. */
export function CommunitySafetyActions({ targetType, targetId, authorClerkId, onChanged, onDelete }: Props): React.ReactElement {
  const colors = useThemeColors();
  const { userId } = useAuth();
  const community = useCommunity();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const perform = async (action: () => Promise<unknown>, success: string): Promise<void> => {
    if (pending) return;
    setPending(true);
    setMessage(null);
    try { await action(); setMessage(success); onChanged?.(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Please try again.'); }
    finally { setPending(false); }
  };
  const button = (label: string, action: () => void, destructive = false) => (
    <Pressable key={label} accessibilityRole="button" disabled={pending} onPress={action}
      style={{ minHeight: 44, padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 8, opacity: pending ? 0.5 : 1 }}>
      <Text style={{ color: destructive ? colors.destructive : colors.foreground }}>{label}</Text>
    </Pressable>
  );
  return <View>
    <Pressable accessibilityRole="button" accessibilityLabel="Community safety actions" onPress={() => { setMessage(null); setOpen(true); }} style={{ minHeight: 44, justifyContent: 'center' }}>
      <Text style={{ color: colors.mutedForeground }}>More options ···</Text>
    </Pressable>
    {open ? <Host matchContents>
      <BottomSheet isPresented={open} onDismiss={() => setOpen(false)} snapPoints={['half', 'full']} containerColor={colors.cream}>
        <View style={{ padding: 20, gap: 10 }}>
          <Text style={{ color: colors.foreground, fontSize: 20, fontWeight: '700' }}>Community safety</Text>
          {message ? <Text selectable accessibilityRole="alert" style={{ color: colors.foreground }}>{message}</Text> : null}
          {userId !== authorClerkId ? <>
            {['Spam', 'Harassment', 'Unsafe or inappropriate content'].map(reason => button(`Report: ${reason}`, () => void perform(() => community.report(targetType, targetId, reason), 'Report sent for review.')))}
            {button('Block this teacher', () => void perform(() => community.block(authorClerkId), 'Teacher blocked.'), true)}
          </> : null}
          {onDelete ? button('Remove this content', () => void perform(onDelete, 'Content removed.'), true) : null}
          {button('Close', () => setOpen(false))}
        </View>
      </BottomSheet>
    </Host> : null}
  </View>;
}
