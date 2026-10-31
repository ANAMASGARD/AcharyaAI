import { ProfileAccountFallback } from "./profile-account-fallback";
import type { StyleProp, ViewStyle } from 'react-native';

type Props = Readonly<{
  style?: StyleProp<ViewStyle>;
}>;

/** The hosted Clerk account page works with both Expo Go and development builds. */
export function ProfileNativeAccountView({ style }: Props): React.ReactElement {
  return <ProfileAccountFallback style={style} />;
}
