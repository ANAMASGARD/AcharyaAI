import { LogBox } from 'react-native';

import { classifyClerkPublishableKey } from '@/lib/clerk-config';

let configured = false;

/**
 * In local development with pk_test_, Clerk warns about dev keys. That is expected.
 * Suppress only that message in __DEV__ so LogBox stays usable; production uses pk_live_.
 */
export function configureClerkDevLogBox(publishableKey: string): void {
  if (configured || !__DEV__) {
    return;
  }

  if (classifyClerkPublishableKey(publishableKey) !== 'development') {
    return;
  }

  LogBox.ignoreLogs(['Clerk has been loaded with development keys']);
  configured = true;
}
