function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`Missing deployment secret: ${name}`);
  return value;
}
export default {
  functions: {
    acharya: {
      name: 'Acharya mobile API',
      source: './neon/functions/mobile/index.ts',
      env: {
        APP_ENV: 'production',
        CLERK_ISSUER: 'https://clerk.superacharya.com',
        CLERK_AUTHORIZED_PARTIES: 'https://superacharya.com,https://accounts.superacharya.com',
        CLERK_SECRET_KEY: required(process.env.ACHARYA_RELEASE_CLERK_SECRET_KEY, 'ACHARYA_RELEASE_CLERK_SECRET_KEY'),
        DATABASE_URL: required(process.env.ACHARYA_RUNTIME_DATABASE_URL, 'ACHARYA_RUNTIME_DATABASE_URL'),
        IMAGEKIT_PRIVATE_KEY: process.env.ACHARYA_IMAGEKIT_PRIVATE_KEY ?? '',
        IMAGEKIT_URL_ENDPOINT: process.env.ACHARYA_IMAGEKIT_URL_ENDPOINT ?? '',
        COMMUNITY_MODERATOR_IDS: process.env.ACHARYA_COMMUNITY_MODERATOR_IDS ?? '',
        COMMUNITY_CLEANUP_SECRET: process.env.ACHARYA_COMMUNITY_CLEANUP_SECRET ?? '',
        COMMUNITY_NEON_TRIGGER_ID: process.env.ACHARYA_COMMUNITY_NEON_TRIGGER_ID ?? '',
        ...(process.env.ACHARYA_GOOGLE_OAUTH_CLIENT_ID && process.env.ACHARYA_GOOGLE_OAUTH_CLIENT_SECRET
          ? {
              GOOGLE_OAUTH_CLIENT_ID: process.env.ACHARYA_GOOGLE_OAUTH_CLIENT_ID,
              GOOGLE_OAUTH_CLIENT_SECRET: process.env.ACHARYA_GOOGLE_OAUTH_CLIENT_SECRET,
            }
          : {}),
      },
    },
  },
};
