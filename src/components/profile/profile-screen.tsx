import { getTabBarOverlayHeight } from "@/components/navigation/tab-bar-constants";
import { ProfileEditNameModal } from "@/components/profile/profile-edit-name-modal";
import { ProfileHeader } from "@/components/profile/profile-header";
import { ProfileMenuCard } from "@/components/profile/profile-menu-card";
import { ProfileMenuRow } from "@/components/profile/profile-menu-row";
import { ProfileSummaryCard } from "@/components/profile/profile-summary-card";
import { ProfileToggleRow } from "@/components/profile/profile-toggle-row";
import { legalLinks } from "@/constants/legal";
import { useProfileAccount } from "@/hooks/use-profile-account";
import { useProfilePhoto } from "@/hooks/use-profile-photo";
import { useProfileSummary } from "@/hooks/use-profile-summary";
import { formatTeachingClassesSummary } from "@/lib/teaching-classes";
import { usePreferencesStore } from "@/store/preferences-store";
import { colors } from "@/theme/colors";
import { borderWidths, radii, spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import { useAuth, useUser } from "@clerk/expo";
import Constants from "expo-constants";
import * as Haptics from "expo-haptics";
import { Redirect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

const TAB_BAR_CLEARANCE = 100;

export function ProfileScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const dockClearance = Math.max(TAB_BAR_CLEARANCE, getTabBarOverlayHeight(insets.bottom) + spacing.lg);
  const router = useRouter();
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const { isLoaded: isUserLoaded, user } = useUser();
  const summary = useProfileSummary();
  const { isUploading, error: photoError, pickAndUpload } = useProfilePhoto();
  const { signOut, openAccountPortal, hasAccountPortal, actionError } = useProfileAccount();

  const pushEnabled = usePreferencesStore(
    (state) => state.pushNotificationsEnabled,
  );
  const setPushEnabled = usePreferencesStore(
    (state) => state.setPushNotificationsEnabled,
  );
  const teachingClassIds = usePreferencesStore((state) => state.teachingClassIds);
  const teachingClassesSummary = formatTeachingClassesSummary(teachingClassIds);

  const [linkError, setLinkError] = useState<string | null>(null);
  const [editNameVisible, setEditNameVisible] = useState(false);

  const appVersion =
    Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? "1.0.0";

  const goToAccount = (): void => {
    router.push("/profile/account");
  };

  const openUrl = async (url: string): Promise<void> => {
    setLinkError(null);
    if (!url) { setLinkError("This page is not available yet."); return; }
    try { await WebBrowser.openBrowserAsync(url); }
    catch { setLinkError("Could not open this page. Please try again."); }
  };

  const openSupport = (): void => {
    setLinkError(null);
    if (!legalLinks.supportEmail) { setLinkError("Support contact details are not available yet."); return; }
    const mailto = `mailto:${legalLinks.supportEmail}?subject=Acharya%20Support`;
    void Linking.openURL(mailto).catch(() => setLinkError("Could not open your email app."));
  };

  if (!isAuthLoaded || !isUserLoaded) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator color={colors.foreground} size="large" />
      </SafeAreaView>
    );
  }

  if (!isSignedIn || !user) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: dockClearance + spacing.lg }]}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        <ProfileHeader
          displayName={summary.displayName}
          imageUrl={user.imageUrl}
          isUploadingPhoto={isUploading}
          onPickPhoto={() => {
            void pickAndUpload();
          }}
          photoError={photoError}
        />

        {actionError || linkError ? <Text accessibilityRole="alert" style={styles.actionError}>{actionError ?? linkError}</Text> : null}

        <View style={styles.section}>
          <ProfileSummaryCard
            connectedProviders={summary.connectedProviders}
            memberSince={summary.memberSince}
            teachingLanguageLabel={summary.teachingLanguageLabel}
            twoFactorEnabled={summary.twoFactorEnabled}
          />
        </View>

        <View style={styles.section}>
          <Pressable
            accessibilityRole="button"
            onPress={goToAccount}
            style={({ pressed }) => [
              styles.primaryCta,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={styles.primaryCtaText}>Manage account & security</Text>
          </Pressable>
          {hasAccountPortal ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                void openAccountPortal();
              }}
              style={({ pressed }) => [
                styles.portalLink,
                pressed ? styles.pressed : null,
              ]}
            >
              <Text style={styles.portalLinkText}>
                Open account settings in browser
              </Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.section}>
          <ProfileMenuCard title="Account">
            <ProfileMenuRow
              icon="account-edit-outline"
              label="Edit name"
              onPress={() => setEditNameVisible(true)}
              showDivider
            />
            <ProfileMenuRow
              icon="account-outline"
              label="Profile & email"
              onPress={goToAccount}
              showDivider
            />
            <ProfileMenuRow
              icon="shield-lock-outline"
              label="Security & 2FA"
              onPress={goToAccount}
              showDivider
            />
            <ProfileMenuRow
              icon="link-variant"
              label="Connected accounts"
              onPress={goToAccount}
              showDivider
            />
            <ProfileMenuRow
              icon="devices"
              label="Active devices"
              onPress={goToAccount}
              showDivider={false}
            />
          </ProfileMenuCard>
        </View>

        <View style={styles.section}>
          <ProfileMenuCard backgroundColor={colors.lavender} title="App settings">
            <ProfileMenuRow
              icon="translate"
              label="Teaching language"
              onPress={() => router.push("/language")}
              showDivider
              subtitle={summary.teachingLanguageLabel}
            />
            <ProfileMenuRow
              icon="school-outline"
              label="Select classes"
              onPress={() => router.push("/profile/teaching-classes")}
              showDivider
              subtitle={teachingClassesSummary}
            />
            <ProfileToggleRow
              icon="bell-outline"
              label="Push notifications"
              onValueChange={(value) => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setPushEnabled(value);
              }}
              showDivider
              subtitle="Preference saved for when alerts are enabled"
              value={pushEnabled}
            />
            <ProfileMenuRow
              icon="microphone"
              label="Open recorder"
              onPress={() => router.push("/(app)/(tabs)/recorder")}
              showDivider
            />
            <ProfileMenuRow
              icon="calendar-month-outline"
              label="Open calendar"
              onPress={() => router.push("/(app)/(tabs)/calendar")}
              showDivider={false}
            />
          </ProfileMenuCard>
        </View>

        <View style={styles.section}>
          <ProfileMenuCard title="Help & about">
            <ProfileMenuRow
              icon="help-circle-outline"
              label="Help & support"
              onPress={openSupport}
              showDivider
            />
            <ProfileMenuRow
              icon="shield-check-outline"
              label="Privacy policy"
              onPress={() => {
                void openUrl(legalLinks.privacyPolicyUrl);
              }}
              showDivider
            />
            <ProfileMenuRow
              icon="file-document-outline"
              label="Terms of service"
              onPress={() => {
                void openUrl(legalLinks.termsUrl);
              }}
              showDivider
            />
            <ProfileMenuRow
              icon="information-outline"
              label="About Acharya"
              showDivider={false}
              subtitle={`Version ${appVersion} · AI teaching assistant`}
            />
          </ProfileMenuCard>
        </View>

        <View style={styles.section}>
          <Pressable
            accessibilityRole="button"
            onPress={signOut}
            style={({ pressed }) => [
              styles.signOutButton,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </View>
      </ScrollView>

      <ProfileEditNameModal
        onClose={() => setEditNameVisible(false)}
        visible={editNameVisible}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  actionError: { color: colors.destructive, fontFamily: fontFamilies.sans, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  loading: {
    alignItems: "center",
    backgroundColor: colors.cream,
    flex: 1,
    justifyContent: "center",
  },
  portalLink: {
    alignItems: "center",
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
  },
  portalLinkText: {
    color: colors.mutedForeground,
    fontFamily: fontFamilies.sans,
    fontSize: 14,
    textDecorationLine: "underline",
  },
  pressed: {
    opacity: 0.9,
  },
  primaryCta: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: borderWidths.thin,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: spacing.lg,
  },
  primaryCtaText: {
    color: colors.primaryForeground,
    fontFamily: fontFamilies.head,
    fontSize: 17,
  },
  safeArea: {
    backgroundColor: colors.cream,
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: TAB_BAR_CLEARANCE + spacing.lg,
  },
  section: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  signOutButton: {
    alignItems: "center",
    backgroundColor: colors.destructive,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: borderWidths.thin,
    justifyContent: "center",
    minHeight: 52,
  },
  signOutText: {
    color: colors.destructiveForeground,
    fontFamily: fontFamilies.sansBold,
    fontSize: 16,
  },
});
