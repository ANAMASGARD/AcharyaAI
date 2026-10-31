import Constants from 'expo-constants';

export function getApiOrigin(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
  if (configured) {
    const url = new URL(configured);
    if (url.protocol !== 'https:' && !(__DEV__ && url.protocol === 'http:')) throw new Error('API URL must use HTTPS');
    if (url.username || url.password || url.search || url.hash) throw new Error('Invalid API URL');
    return configured;
  }
  const host = Constants.expoConfig?.hostUri;
  if (__DEV__ && host) return `http://${host}`;
  throw new Error('API URL is not configured');
}
