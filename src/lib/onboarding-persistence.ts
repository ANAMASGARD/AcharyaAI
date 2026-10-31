import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ONBOARDING_COMPLETED_KEY = 'acharya_onboarding_completed';
const COMPLETED_VALUE = '1';

function readWebFlag(): boolean {
  if (typeof localStorage === 'undefined') {
    return false;
  }
  return localStorage.getItem(ONBOARDING_COMPLETED_KEY) === COMPLETED_VALUE;
}

function writeWebFlag(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(ONBOARDING_COMPLETED_KEY, COMPLETED_VALUE);
  }
}

export async function getOnboardingCompleted(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return readWebFlag();
  }

  try {
    const value = await SecureStore.getItemAsync(ONBOARDING_COMPLETED_KEY);
    return value === COMPLETED_VALUE;
  } catch {
    return false;
  }
}

export async function setOnboardingCompleted(): Promise<void> {
  if (Platform.OS === 'web') {
    writeWebFlag();
    return;
  }

  try {
    await SecureStore.setItemAsync(ONBOARDING_COMPLETED_KEY, COMPLETED_VALUE);
  } catch {
    // Non-fatal: user can still auth; gate may show slides again on next launch
  }
}
