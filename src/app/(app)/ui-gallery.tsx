import { Redirect } from 'expo-router';

import { UiGalleryScreen } from '@/components/preview/ui-gallery-screen';
import { SIGNED_IN_HOME } from '@/lib/routes';

export default function UiGalleryRoute(): React.ReactElement {
  if (!__DEV__) return <Redirect href={SIGNED_IN_HOME} />;
  return <UiGalleryScreen />;
}
