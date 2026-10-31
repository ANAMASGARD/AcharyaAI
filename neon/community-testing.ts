function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`Missing testing deployment setting: ${name}`);
  return value;
}

// Deploy only to the isolated Acharya Community Testing project. Production
// retains its own Clerk issuer, database credential, and deployment config.
export default {
  functions: {
    acharya: {
      name: 'Acharya community testing API',
      source: './neon/functions/mobile/index.ts',
      env: {
        APP_ENV: 'development',
        CLERK_SECRET_KEY: required(process.env.ACHARYA_COMMUNITY_CLERK_SECRET_KEY, 'ACHARYA_COMMUNITY_CLERK_SECRET_KEY'),
        CLERK_ISSUER: required(process.env.ACHARYA_COMMUNITY_CLERK_ISSUER, 'ACHARYA_COMMUNITY_CLERK_ISSUER'),
        CLERK_AUTHORIZED_PARTIES: required(process.env.ACHARYA_COMMUNITY_AUTHORIZED_PARTIES, 'ACHARYA_COMMUNITY_AUTHORIZED_PARTIES'),
        DATABASE_URL: required(process.env.ACHARYA_COMMUNITY_DATABASE_URL, 'ACHARYA_COMMUNITY_DATABASE_URL'),
        IMAGEKIT_PRIVATE_KEY: process.env.ACHARYA_IMAGEKIT_PRIVATE_KEY ?? '',
        IMAGEKIT_URL_ENDPOINT: process.env.ACHARYA_IMAGEKIT_URL_ENDPOINT ?? '',
        COMMUNITY_MODERATOR_IDS: process.env.ACHARYA_COMMUNITY_MODERATOR_IDS ?? '',
        COMMUNITY_CLEANUP_SECRET: process.env.ACHARYA_COMMUNITY_CLEANUP_SECRET ?? '',
        COMMUNITY_NEON_TRIGGER_ID: process.env.ACHARYA_COMMUNITY_NEON_TRIGGER_ID ?? '',
      },
    },
  },
};
