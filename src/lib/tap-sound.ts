type TapPlayer = {
  pause: () => void;
  seekTo: (seconds: number) => Promise<void>;
  play: () => void;
};

/** Dispatch replay immediately; optional feedback must never delay the action. */
export function createTapSound(player: TapPlayer) {
  let active = true;
  return {
    play() {
      if (!active) return;
      try {
        // Android's isLoaded getter becomes false at STATE_ENDED. Do not use it
        // to gate replay. Issue seek and play together, as Expo's replay API
        // recommends, without waiting for a JS promise round trip or throttling.
        void player.seekTo(0).catch(() => {});
        player.play();
      } catch {
        // Unavailable audio must never prevent a button's action.
      }
    },
    setActive(value: boolean) {
      active = value;
      if (!value) {
        try { player.pause(); } catch { /* Player may already be released. */ }
      }
    },
  };
}
