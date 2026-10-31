import { Pressable as NativePressable, type PressableProps } from 'react-native';
import type { ComponentProps } from 'react';

import { useTapSound } from './tap-sound-provider';

type FeedbackPressableProps = ComponentProps<typeof NativePressable> & {
  /** Disable for backdrop dismissal and non-control touch interception. */
  soundFeedback?: boolean;
};

/** Feedback follows completed control presses, never touch-down or scrolling. */
export function Pressable({ onPress, disabled, soundFeedback = true, ...props }: FeedbackPressableProps) {
  const play = useTapSound();
  const handlePress: PressableProps['onPress'] = onPress ? (event) => {
    if (disabled) return;
    if (soundFeedback) play();
    onPress(event);
  } : undefined;
  return <NativePressable {...props} disabled={disabled} onPress={handlePress} />;
}
