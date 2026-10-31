import Constants from 'expo-constants';
import { Platform } from 'react-native';

export function getRagApiOrigin(): string {
  const configured = process.env.EXPO_PUBLIC_RAG_API_URL?.trim().replace(/\/$/, '');
  if (configured) {
    const url = new URL(configured);
    if ((url.protocol !== 'https:' && !(__DEV__ && url.protocol === 'http:')) || url.username || url.password || url.search || url.hash)
      throw new Error('Configure an HTTPS RAG backend URL.');
    return configured;
  }
  if (Platform.OS === 'web') return '';
  if (__DEV__ && Constants.expoConfig?.hostUri) return `http://${Constants.expoConfig.hostUri}`;
  throw new Error('RAG backend is not configured in this build.');
}
