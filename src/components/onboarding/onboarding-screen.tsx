import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ListRenderItem,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { onboardingSlides, type OnboardingSlide } from '@/data/onboarding-slides';
import { colors } from '@/theme/colors';
import { fontFamilies } from '@/theme/typography';
import { borderWidths, radii, shadows, spacing } from '@/theme/tokens';

const LAST_PAGE_INDEX = onboardingSlides.length - 1;

export function OnboardingScreen(): React.ReactElement {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const listRef = useRef<FlatList<OnboardingSlide>>(null);
  const [pageIndex, setPageIndex] = useState(0);

  const isLastPage = pageIndex === LAST_PAGE_INDEX;

  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>): void => {
      const nextIndex = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
      setPageIndex(nextIndex);
    },
    [screenWidth],
  );

  const handlePrimaryAction = (): void => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (isLastPage) {
      router.replace('/sign-up');
      return;
    }

    const nextIndex = pageIndex + 1;
    listRef.current?.scrollToIndex({ animated: true, index: nextIndex });
    setPageIndex(nextIndex);
  };

  const renderSlide: ListRenderItem<OnboardingSlide> = useCallback(
    ({ item }) => (
      <View style={[styles.slide, { width: screenWidth }]}>
        <Image
          accessibilityLabel={item.mascotLabel}
          contentFit="contain"
          source={item.mascot}
          style={styles.mascot}
        />

        <View style={styles.titleBlock}>
          <Text style={styles.titleLine}>{item.titleLine1}</Text>
          <Text style={styles.titleLine}>{item.titleLine2}</Text>
        </View>

        <Text style={styles.description}>{item.description}</Text>
      </View>
    ),
    [screenWidth],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />

      <View style={styles.container}>
        <FlatList
          ref={listRef}
          style={styles.list}
          data={[...onboardingSlides]}
          getItemLayout={(_, index) => ({
            index,
            length: screenWidth,
            offset: screenWidth * index,
          })}
          horizontal
          keyExtractor={(item) => item.id}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          pagingEnabled
          renderItem={renderSlide}
          showsHorizontalScrollIndicator={false}
        />

        <View style={styles.footer}>
          <View style={styles.dotsRow}>
            {onboardingSlides.map((slide, index) => (
              <View
                key={slide.id}
                style={[
                  styles.dot,
                  index === pageIndex ? styles.dotActive : styles.dotInactive,
                ]}
              />
            ))}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isLastPage ? 'Get Started' : 'Next'}
            style={({ pressed }) => [styles.primaryButton, pressed ? styles.primaryButtonPressed : null]}
            onPress={handlePrimaryAction}
          >
            <Text style={styles.primaryButtonLabel}>{isLastPage ? 'Get Started' : 'Next'}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  container: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl + spacing.sm,
  },
  mascot: {
    height: 240,
    width: 220,
  },
  titleBlock: {
    marginTop: spacing.xl + spacing.sm,
    alignItems: 'center',
    gap: spacing.xs,
  },
  titleLine: {
    fontFamily: fontFamilies.head,
    fontSize: 34,
    lineHeight: 40,
    color: colors.foreground,
    textAlign: 'center',
  },
  description: {
    marginTop: spacing.lg,
    maxWidth: 300,
    fontFamily: fontFamilies.sans,
    fontSize: 15,
    lineHeight: 22,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  footer: {
    gap: spacing.lg + spacing.xs,
    paddingHorizontal: spacing.xl + spacing.sm,
    paddingBottom: spacing.xl,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  dot: {
    height: 10,
    borderRadius: radii.lg,
  },
  dotActive: {
    width: 24,
    backgroundColor: colors.foreground,
  },
  dotInactive: {
    width: 10,
    backgroundColor: colors.muted,
  },
  primaryButton: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.lg,
    borderWidth: borderWidths.default,
    borderColor: colors.border,
    backgroundColor: colors.primary,
    ...shadows.md,
  },
  primaryButtonPressed: {
    transform: [{ translateX: 2 }, { translateY: 2 }],
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  primaryButtonLabel: {
    fontFamily: fontFamilies.head,
    fontSize: 16,
    color: colors.primaryForeground,
  },
});
