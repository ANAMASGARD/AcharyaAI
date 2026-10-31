const fs = require('node:fs');
const path = require('node:path');
module.exports = function releaseEnvironment(channel = 'production') {
const secrets = path.join(require('node:os').homedir(), '.local/share/acharya');
const env = { ...process.env, ACHARYA_UPDATE_CHANNEL: channel };
for (const line of fs.readFileSync(path.join(secrets, 'clerk-production.env'), 'utf8').split('\n')) {
  const at = line.indexOf('=');
  if (at > 0 && line.slice(0, at) === 'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY') env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = line.slice(at + 1).trim().replace(/^['"]|['"]$/g, '');
}
if (!env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_live_')) throw new Error('Missing production publishable key');
Object.assign(env, { EXPO_PUBLIC_APP_VARIANT: 'production', EXPO_PUBLIC_GOOGLE_AUTH_ENABLED: 'true', EXPO_PUBLIC_FACEBOOK_AUTH_ENABLED: 'true',
  // Enable explicitly for a Microsoft validation candidate; default releases stay gated.
  EXPO_PUBLIC_MICROSOFT_AUTH_ENABLED: process.env.EXPO_PUBLIC_MICROSOFT_AUTH_ENABLED === 'true' ? 'true' : 'false',
  EXPO_PUBLIC_NEON_FUNCTION_URL: 'https://br-icy-resonance-b3camzf0-acharya.compute.c-4.ap-southeast-1.aws.neon.tech',
  EXPO_PUBLIC_RAG_API_URL: 'https://acharya-app--rag-desktop.expo.app',
  EXPO_NO_DOTENV: '1', NODE_ENV: 'production' });
for (const key of Object.keys(env)) {
 if (key.startsWith('VOICE_') || key.startsWith('RAG_') || (key.startsWith('EXPO_PUBLIC_') && !['EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY','EXPO_PUBLIC_APP_VARIANT','EXPO_PUBLIC_GOOGLE_AUTH_ENABLED','EXPO_PUBLIC_FACEBOOK_AUTH_ENABLED','EXPO_PUBLIC_MICROSOFT_AUTH_ENABLED','EXPO_PUBLIC_NEON_FUNCTION_URL','EXPO_PUBLIC_RAG_API_URL'].includes(key)) || ['CLERK_SECRET_KEY','DATABASE_URL','GNANI_API_KEY','OPENAI_API_KEY','GEMINI_API_KEY','IMAGEKIT_PRIVATE_KEY','COMMUNITY_CLEANUP_SECRET','ACHARYA_IMAGEKIT_PRIVATE_KEY','ACHARYA_COMMUNITY_CLEANUP_SECRET'].includes(key)) delete env[key];
}
return env;
};
