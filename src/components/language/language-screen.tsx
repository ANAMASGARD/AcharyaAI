import { fontFamilies } from "@/theme/typography";
import { LanguageListItem } from "@/components/language/language-list-item";
import { LanguageSearchBar } from "@/components/language/language-search-bar";
import { allLanguages, filterLanguages, popularLanguages } from "@/data/languages";
import { useLanguageGate } from "@/hooks/use-language-gate";
import { images } from "@/constants/images";
import { usePreferencesStore } from "@/store/preferences-store";
import { colors } from "@/theme/colors";
import { borderWidths, radii, spacing } from "@/theme/tokens";
import type { TeachingLanguage } from "@/types/language";
import { useAuth } from "@clerk/expo";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { Redirect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type LanguageSection = {
  title: string;
  data: TeachingLanguage[];
};

const CONFIRM_HEIGHT = 52;
const FOOTER_INNER_GAP = 6;

export function LanguageSelectionScreen(): React.ReactElement {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const { isLoaded, isSignedIn } = useAuth();
  const { isReady, needsLanguageSelection } = useLanguageGate();
  const storedLanguageId = usePreferencesStore(
    (state) => state.selectedLanguageId,
  );
  const setSelectedLanguage = usePreferencesStore(
    (state) => state.setSelectedLanguageId,
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [draftSelectionId, setDraftSelectionId] = useState<string | null>(
    storedLanguageId,
  );

  const EARTH_WIDTH = 480;
  const EARTH_HEIGHT = 300;
  const earthWidth = Math.min(screenWidth, EARTH_WIDTH);
  const earthHeight = Math.round((EARTH_HEIGHT / EARTH_WIDTH) * earthWidth);

  const filtered = useMemo(
    () => filterLanguages(searchQuery),
    [searchQuery],
  );

  const sections = useMemo((): LanguageSection[] => {
    if (searchQuery.trim()) {
      return filtered.length > 0
        ? [{ title: "Results", data: filtered }]
        : [];
    }

    const popularIds = new Set(popularLanguages.map((l) => l.id));
    const other = filtered.filter((l) => !popularIds.has(l.id));

    return [
      { title: "Popular", data: [...popularLanguages] },
      { title: "All languages", data: other },
    ].filter((section) => section.data.length > 0);
  }, [filtered, searchQuery]);

  const showBack = !needsLanguageSelection;
  const canConfirm = draftSelectionId !== null;

  const handleToggleLanguage = useCallback((languageId: string): void => {
    setDraftSelectionId((current) =>
      current === languageId ? null : languageId,
    );
  }, []);

  const handleConfirm = (): void => {
    if (!draftSelectionId) {
      return;
    }

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedLanguage(draftSelectionId);
    router.back();
  };

  if (!isLoaded || !isReady) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator color={colors.foreground} size="large" />
      </SafeAreaView>
    );
  }

  if (!isSignedIn) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <StatusBar style="dark" />

      <View style={styles.main}>
      <View style={styles.header}>
        {showBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <MaterialCommunityIcons
              color={colors.foreground}
              name="arrow-left"
              size={26}
            />
          </Pressable>
        ) : (
          <View style={styles.backPlaceholder} />
        )}
        <Text style={styles.title}>
          Choose a language
        </Text>
        <View style={styles.backPlaceholder} />
      </View>

      <View style={styles.searchWrap}>
        <LanguageSearchBar value={searchQuery} onChangeText={setSearchQuery} />
      </View>

      <SectionList<TeachingLanguage, LanguageSection>
        style={styles.list}
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            No languages match your search.
          </Text>
        }
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionTitle}>
            {section.title}
          </Text>
        )}
        renderItem={({ item }) => {
          const badgeIndex = allLanguages.findIndex((l) => l.id === item.id);

          return (
            <LanguageListItem
              badgeIndex={badgeIndex >= 0 ? badgeIndex : 0}
              isSelected={draftSelectionId === item.id}
              language={item}
              onPress={() => handleToggleLanguage(item.id)}
            />
          );
        }}
      />
      </View>

      <SafeAreaView style={styles.footer} edges={["bottom"]}>
        <View style={styles.confirmEarthGroup}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Confirm language"
            accessibilityState={{ disabled: !canConfirm }}
            disabled={!canConfirm}
            onPress={handleConfirm}
            style={({ pressed }) => [styles.confirmButton, styles.confirmVisual, !canConfirm && { opacity: 0.5 }, pressed && { transform: [{ translateX: 2 }, { translateY: 2 }] }]}
          >
            <Text style={styles.confirmLabel}>
              Confirm
            </Text>
          </Pressable>

          <Image
            accessibilityLabel="Earth with landmarks illustration"
            contentFit="contain"
            source={images.earth}
            style={{
              width: earthWidth,
              height: earthHeight,
              marginTop: FOOTER_INNER_GAP,
              alignSelf: "center",
            }}
          />
        </View>
      </SafeAreaView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title: { flex: 1, textAlign: 'center', fontFamily: fontFamilies.head, fontSize: 24, color: colors.foreground },
  emptyText: { paddingVertical: 32, textAlign: 'center', fontFamily: fontFamilies.sans, fontSize: 15, color: colors.mutedForeground },
  sectionTitle: { paddingBottom: 8, paddingTop: 4, fontFamily: fontFamilies.sansBold, fontSize: 16, color: colors.foreground },
  confirmLabel: { fontFamily: fontFamilies.head, fontSize: 17, color: colors.primaryForeground },
  confirmVisual: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderWidth: 3, borderColor: colors.border, borderRadius: 12 },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cream,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  main: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
  },
  backButton: {
    width: 44,
    height: 44,
    borderWidth: borderWidths.default,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  backPlaceholder: {
    width: 44,
    height: 44,
  },
  searchWrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
  },
  footer: {
    flexShrink: 0,
    paddingHorizontal: 0,
    paddingTop: spacing.xs,
    borderTopWidth: borderWidths.default,
    borderTopColor: colors.border,
    backgroundColor: colors.cream,
  },
  confirmEarthGroup: {
    width: "100%",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
  },
  confirmButton: {
    alignSelf: "stretch",
    borderRadius: radii.lg,
    minHeight: CONFIRM_HEIGHT,
    height: CONFIRM_HEIGHT,
    justifyContent: "center",
  },
});
