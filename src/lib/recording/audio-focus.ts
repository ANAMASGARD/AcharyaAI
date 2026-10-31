let active = false;
const listeners = new Set<() => void>();
export const isRecorderMicrophoneActive = (): boolean => active;
export const subscribeRecorderMicrophone = (listener: () => void): (() => void) => {
  listeners.add(listener); return () => listeners.delete(listener);
};
export function setRecorderMicrophoneActive(value: boolean): void {
  if (active === value) return;
  active = value;
  listeners.forEach((listener) => listener());
}
