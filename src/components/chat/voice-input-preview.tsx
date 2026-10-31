import { useMicrophoneLevel } from '@/hooks/use-microphone-level';
import { Pressable } from '@/components/feedback/pressable';
import { useEffect, useState } from 'react';
import { AppState, BackHandler, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { useThemeColors, useThemeStyles } from '@/theme/use-theme';
import type { ThemeColors } from '@/theme/colors';
import { borderWidths } from '@/theme/tokens';
import { fontFamilies } from '@/theme/typography';

const BAR_COUNT = 28;

function WaveDot({ index, phase, levels, step, color }: { index: number; phase: SharedValue<number>; levels: SharedValue<number[]>; step: number; color: string }): React.ReactElement {
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: (index - phase.get()) * step },
      { scaleY: 1 + (levels.get()[index] ?? 0) * 9 },
    ],
  }));
  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
}

/** Local microphone levels only; no saved audio, transcription, or AI. */
export function VoiceInputPreview({ onClose }: { onClose: () => void }): React.ReactElement {
  const colors = useThemeColors();
  const themed = useThemeStyles(createStyles);
  const [stopped, setStopped] = useState(false);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const reducedMotion = useReducedMotion();
  const phase = useSharedValue(0);
  const levels = useSharedValue<number[]>(Array(BAR_COUNT + 1).fill(0));
  const [waveWidth, setWaveWidth] = useState(0);
  const mic = useMicrophoneLevel(!stopped && active);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      setActive(state === 'active');
      // Never resume capture automatically after leaving the app.
      if (state === 'background') setStopped(true);
    });
    const back = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => { subscription.remove(); back.remove(); };
  }, [onClose]);

  useEffect(() => {
    if (stopped || !active) {
      levels.set(Array(BAR_COUNT + 1).fill(0));
      return;
    }
    const timer = setInterval(() => {
      const sample = mic.latest.current;
      const level = mic.isStreaming && Date.now() - sample.at < 300 ? sample.level : 0;
      levels.set(reducedMotion ? Array(BAR_COUNT + 1).fill(level) : [...levels.get().slice(1), level]);
      cancelAnimation(phase);
      phase.set(0);
      if (!reducedMotion) phase.set(withTiming(1, { duration: 100, easing: Easing.linear }));
    }, 100);
    return () => { clearInterval(timer); cancelAnimation(phase); };
  }, [active, levels, mic.isStreaming, mic.latest, phase, reducedMotion, stopped]);

  return <View style={themed.panel}>
    <Text accessibilityLiveRegion="polite" style={themed.caption}>
      {stopped ? 'Microphone stopped · no audio saved' : mic.error ?? (mic.isStreaming ? 'Listening · audio stays on this device' : 'Opening microphone…')}
    </Text>
    <View style={styles.controls}>
      <Pressable accessibilityRole="button" accessibilityLabel="Cancel microphone" onPress={onClose} style={themed.control}>
        <MaterialCommunityIcons name="close" size={22} color={colors.foreground} />
      </Pressable>
      <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.wave} onLayout={(event) => setWaveWidth(event.nativeEvent.layout.width)}>
        {Array.from({ length: BAR_COUNT + 1 }, (_, index) => <WaveDot key={index} index={index} phase={phase} levels={levels} step={waveWidth / (BAR_COUNT - 1)} color={colors.mutedForeground} />)}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Stop microphone" accessibilityState={{ disabled: stopped }} disabled={stopped} onPress={() => setStopped(true)} style={[themed.control, themed.stop, stopped && styles.disabled]}>
        <MaterialCommunityIcons name="stop" size={22} color={colors.destructiveForeground} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Close microphone" onPress={onClose} style={themed.finish}>
        <MaterialCommunityIcons name="arrow-up" size={24} color={colors.onAccent} />
      </Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  controls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wave: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 44, overflow: 'hidden' },
  dot: { position: 'absolute', left: 0, width: 3, height: 3, borderRadius: 2 },
  disabled: { opacity: 0.4 },
});
const createStyles = (colors: ThemeColors) => StyleSheet.create({
  panel: { padding: 8, gap: 22, minHeight: 108, backgroundColor: colors.card },
  caption: { color: colors.mutedForeground, fontFamily: fontFamilies.sans, fontSize: 13, paddingHorizontal: 6, paddingTop: 6 },
  control: { borderColor: colors.onAccent, borderWidth: borderWidths.thin, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream },
  stop: { backgroundColor: colors.destructive },
  finish: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: "#FF8EC8" },
});
