import { createContext, use, useCallback, useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { createAudioPlayer, preload, setAudioModeAsync } from 'expo-audio';

import { isRecorderMicrophoneActive, subscribeRecorderMicrophone } from '@/lib/recording/audio-focus';

import { createTapSound } from '@/lib/tap-sound';

const dropSound = require('../../../assets/audio/drop.mp3');
// Start buffering before the account UI mounts. Playback still requires a tap.
void Promise.resolve(preload(dropSound)).catch(() => {});

const TapSoundContext = createContext<() => void>(() => {});

/** One bundled player for the hydrated account; no capture or background playback. */
export function TapSoundProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const microphoneActive = useSyncExternalStore(subscribeRecorderMicrophone, isRecorderMicrophoneActive, () => false);
  const playback = useRef<ReturnType<typeof createTapSound> | null>(null);
  const play = useCallback(() => { if (!isRecorderMicrophoneActive()) playback.current?.play(); }, []);

  useEffect(() => {
    if (!enabled || microphoneActive) return;
    let disposed = false;
    let release: (() => void) | undefined;
    const configure = async () => {
      try {
        await setAudioModeAsync({
          playsInSilentMode: false,
          allowsRecording: false,
          shouldPlayInBackground: false,
          interruptionMode: 'mixWithOthers',
        });
        if (disposed) return;
        const player = createAudioPlayer(dropSound, { keepAudioSessionActive: true });
        player.volume = 1;
        const sound = createTapSound(player);
        sound.setActive(AppState.currentState === 'active');
        playback.current = sound;
        const subscription = AppState.addEventListener('change', (state) => sound.setActive(state === 'active'));
        release = () => {
          playback.current = null;
          sound.setActive(false);
          subscription.remove();
          player.remove();
        };
      } catch {
        // Devices without available audio continue working silently.
      }
    };
    void configure();
    return () => { disposed = true; release?.(); };
  }, [enabled, microphoneActive]);

  return <TapSoundContext value={play}>{children}</TapSoundContext>;
}

export function useTapSound(): () => void {
  return use(TapSoundContext);
}
