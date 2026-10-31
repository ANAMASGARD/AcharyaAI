import { BlurTargetView, BlurView, type BlurViewProps } from 'expo-blur';
import { useFocusEffect } from 'expo-router';
import { createContext, forwardRef, useCallback, useContext, useMemo, useRef, useState, type PropsWithChildren, type RefObject } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

type BlurTarget = RefObject<View | null>;
type BlurContextValue = {
  target: BlurTarget | undefined;
  register: (target: BlurTarget) => () => void;
};

const BlurContext = createContext<BlurContextValue | null>(null);

/** Shares the focused scene with SDK 57's Android blur renderer. */
export function AcharyaBlurProvider({ children }: PropsWithChildren): React.ReactElement {
  const [target, setTarget] = useState<BlurTarget>();
  const register = useCallback((next: BlurTarget) => {
    setTarget(next);
    return () => setTarget((current) => current === next ? undefined : current);
  }, []);
  const value = useMemo(() => ({ target, register }), [target, register]);
  return <BlurContext.Provider value={value}>{children}</BlurContext.Provider>;
}

/** Wrap screen content only, leaving the floating tab bar outside its own blur target. */
export function AcharyaBlurTarget({ children }: PropsWithChildren): React.ReactElement {
  const target = useRef<View>(null);
  const register = useContext(BlurContext)?.register;
  useFocusEffect(useCallback(() => register?.(target), [register]));
  return <BlurTargetView ref={target} style={styles.scene}>{children}</BlurTargetView>;
}

/** Forward the native ref so copied Reanimated blur overlays remain animatable. */
export const AcharyaBlurView = forwardRef<BlurView, BlurViewProps>(function AcharyaBlurView(props, ref) {
  const contextTarget = useContext(BlurContext)?.target;
  const { blurTarget = contextTarget, blurMethod, experimentalBlurMethod, ...viewProps } = props;
  // Focus effects register the scene after the initial commit. Android must use
  // its tinted fallback until then (and during any gap between focused scenes).
  const method = Platform.OS === 'android'
    ? blurTarget ? (blurMethod ?? experimentalBlurMethod ?? 'dimezisBlurViewSdk31Plus') : 'none'
    : blurMethod;
  return <BlurView
    ref={ref}
    {...viewProps}
    blurTarget={blurTarget}
    blurMethod={method}
  />;
});

const styles = StyleSheet.create({ scene: { flex: 1 } });
