import { useLanguageGate } from "@/hooks/use-language-gate";
import { formatMemberSince, resolveDisplayName } from "@/lib/user-display-name";
import { useUser } from "@clerk/expo";

type ProfileSummary = {
  isLoaded: boolean;
  displayName: string;
  primaryEmail: string | null;
  username: string | null;
  memberSince: string;
  teachingLanguageLabel: string;
  twoFactorEnabled: boolean;
  connectedProviders: string[];
};

function formatProviderLabel(provider: string): string {
  const normalized = provider.replace(/^oauth_/, "").replace(/_/g, " ");
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function useProfileSummary(): ProfileSummary {
  const { isLoaded, user } = useUser();
  const { selectedLanguage } = useLanguageGate();

  const displayName = isLoaded
    ? resolveDisplayName(
        user?.firstName,
        user?.fullName,
        user?.username,
      )
    : "Teacher";

  const primaryEmail =
    user?.primaryEmailAddress?.emailAddress ?? null;

  const username = user?.username ?? null;

  const memberSince = formatMemberSince(user?.createdAt);

  const teachingLanguageLabel = selectedLanguage
    ? `${selectedLanguage.nameEnglish} (${selectedLanguage.nameNative})`
    : "Not set";

  const twoFactorEnabled = Boolean(
    user && "twoFactorEnabled" in user && user.twoFactorEnabled,
  );

  const connectedProviders =
    user?.externalAccounts?.map((account) =>
      formatProviderLabel(account.provider),
    ) ?? [];

  return {
    isLoaded,
    displayName,
    primaryEmail,
    username,
    memberSince,
    teachingLanguageLabel,
    twoFactorEnabled,
    connectedProviders,
  };
}
