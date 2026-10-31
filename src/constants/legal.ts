function httpsUrl(value: string | undefined): string {
  if (!value) return '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

const supportEmail = process.env.EXPO_PUBLIC_SUPPORT_EMAIL?.trim() ?? '';

/** Unconfigured destinations stay unavailable instead of linking to unverified sites. */
export const legalLinks = {
  supportEmail: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail) ? supportEmail : '',
  privacyPolicyUrl: httpsUrl(process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL),
  termsUrl: httpsUrl(process.env.EXPO_PUBLIC_TERMS_URL),
} as const;
