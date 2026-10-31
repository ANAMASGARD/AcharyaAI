import { useThemeColors } from '@/theme/use-theme';
import type { PropsWithChildren } from 'react';
import { TopTabs } from 'expo-router/js-top-tabs';
import { useWindowDimensions } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { AcharyaTabBar, type AcharyaTabBarProps } from '@/components/navigation/acharya-tab-bar';
import { AcharyaBlurTarget } from '@/components/ui/acharya-blur';

export default function AcharyaTabs(): React.ReactElement {
  const colors = useThemeColors();

  const { width } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  return <TopTabs
    backBehavior="initialRoute"
    initialLayout={{ width }}
    tabBarPosition="bottom"
    keyboardDismissMode="on-drag"
    tabBar={(props: AcharyaTabBarProps) => <AcharyaTabBar {...props} />}
    screenLayout={({ children }: PropsWithChildren) => <AcharyaBlurTarget>{children}</AcharyaBlurTarget>}
    screenOptions={{ swipeEnabled: true, animationEnabled: !reducedMotion, lazy: true, sceneStyle: { backgroundColor: colors.cream } }}
  >
    <TopTabs.Screen name="home" options={{ title: 'Home' }} />
    <TopTabs.Screen name="calendar" options={{ title: 'Calendar' }} />
    <TopTabs.Screen name="recorder" options={{ title: 'Recorder' }} />
    <TopTabs.Screen name="chat" options={{ title: 'Chat' }} />
    <TopTabs.Screen name="profile" options={{ title: 'Profile' }} />
  </TopTabs>;
}
