import { Tabs } from 'expo-router';

import { AcharyaTabBar } from '@/components/navigation/acharya-tab-bar';
import { AcharyaBlurTarget } from '@/components/ui/acharya-blur';
import { colors } from '@/theme/colors';

export default function AcharyaTabs(): React.ReactElement {
  return <Tabs
    initialRouteName="recorder"
    tabBar={(props) => <AcharyaTabBar {...props} />}
    screenLayout={({ children }) => <AcharyaBlurTarget>{children}</AcharyaBlurTarget>}
    screenOptions={{ headerShown: false, lazy: false, sceneStyle: { backgroundColor: colors.cream } }}
  >
    <Tabs.Screen name="home" options={{ title: 'Home' }} />
    <Tabs.Screen name="calendar" options={{ title: 'Calendar' }} />
    <Tabs.Screen name="recorder" options={{ title: 'Recorder' }} />
    <Tabs.Screen name="chat" options={{ title: 'Chat' }} />
    <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
  </Tabs>;
}
