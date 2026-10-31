import { useEffect, useState } from 'react';
import { AppState, BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';
import { useThemeColors, useThemeStyles } from '@/theme/use-theme';
import type { ThemeColors } from '@/theme/colors';
import { borderWidths } from '@/theme/tokens';
import { fontFamilies } from '@/theme/typography';

const BAR_COUNT = 28;

function WaveDot({ index, phase, color }: { index: number; phase: SharedValue<number>; color: string }): React.ReactElement {
  const style = useAnimatedStyle(() => {
    const distance = index / (BAR_COUNT - 1) - phase.get();
    const envelope = Math.exp(-distance * distance * 100);
    return { transform: [{ scaleY: 1 + envelope * (2 + 4 * Math.abs(Math.sin(index * 2.4))) }] };
  });
  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
}

/** Decorative preview only. No audio capture, permission request, or transcription. */
export function VoiceInputPreview({ onClose }: { onClose: () => void }): React.ReactElement {
  const colors = useThemeColors();
  const themed = useThemeStyles(createStyles);
  const [stopped, setStopped] = useState(false);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const reducedMotion = useReducedMotion();
  const phase = useSharedValue(-0.2);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    const back = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => { subscription.remove(); back.remove(); };
  }, [onClose]);

  useEffect(() => {
    if (!stopped && active && !reducedMotion) {
      phase.set(withRepeat(withTiming(1.2, { duration: 2400, easing: Easing.linear }), -1, false));
    }
    return () => cancelAnimation(phase);
  }, [active, phase, reducedMotion, stopped]);

  return <View style={themed.panel}>
    <Text accessibilityLiveRegion="polite" style={themed.caption}>
      {stopped ? 'Preview stopped · no audio recorded' : 'Voice preview · microphone is off'}
    </Text>
    <View style={styles.controls}>
      <Pressable accessibilityRole="button" accessibilityLabel="Cancel voice preview" onPress={onClose} style={themed.control}>
        <MaterialCommunityIcons name="close" size={22} color={colors.foreground} />
      </Pressable>
      <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.wave}>
        {Array.from({ length: BAR_COUNT }, (_, index) => <WaveDot key={index} index={index} phase={phase} color={colors.mutedForeground} />)}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Stop voice preview" accessibilityState={{ disabled: stopped }} disabled={stopped} onPress={() => setStopped(true)} style={[themed.control, themed.stop, stopped && styles.disabled]}>
        <MaterialCommunityIcons name="stop" size={22} color={colors.destructiveForeground} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Finish voice preview" onPress={onClose} style={themed.finish}>
        <MaterialCommunityIcons name="arrow-up" size={24} color={colors.onAccent} />
      </Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  controls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wave: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 44, overflow: 'hidden' },
  dot: { width: 3, height: 3, borderRadius: 2 },
  disabled: { opacity: 0.4 },
});
const createStyles = (colors: ThemeColors) => StyleSheet.create({
  panel: { padding: 8, gap: 22, minHeight: 108, backgroundColor: colors.card },
  caption: { color: colors.mutedForeground, fontFamily: fontFamilies.sans, fontSize: 13, paddingHorizontal: 6, paddingTop: 6 },
  control: { borderColor: colors.onAccent, borderWidth: borderWidths.thin, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream },
  stop: { backgroundColor: colors.destructive },
  finish: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: "#FF8EC8" },
});
