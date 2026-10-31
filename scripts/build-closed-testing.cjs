/* global __dirname */
// Local signed candidate. Credentials stay outside the checkout and out of arguments.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const secrets = path.join(require('node:os').homedir(), '.local/share/acharya');
const signing = path.join(secrets, 'signing/com.acharya.app');
const env = { ...process.env };
// AGP native tooling is incompatible with the host's Java 25 warning output.
env.JAVA_HOME = process.env.ACHARYA_JAVA_HOME || '/usr/lib/jvm/java-17-temurin-jdk';
env.PATH = path.join(env.JAVA_HOME, 'bin') + path.delimiter + env.PATH;
for (const line of fs.readFileSync(path.join(secrets, 'clerk-production.env'), 'utf8').split('\n')) {
  const at = line.indexOf('=');
  if (at > 0 && line.slice(0, at) === 'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY') env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = line.slice(at + 1).trim().replace(/^['"]|['"]$/g, '');
}
if (!env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_live_')) throw new Error('Missing production publishable key');
Object.assign(env, { EXPO_PUBLIC_APP_VARIANT: 'production', EXPO_PUBLIC_GOOGLE_AUTH_ENABLED: 'false',
  EXPO_PUBLIC_NEON_FUNCTION_URL: 'https://br-icy-resonance-b3camzf0-acharya.compute.c-4.ap-southeast-1.aws.neon.tech',
  ACHARYA_KEYSTORE_PATH: path.join(signing, 'acharya-release.p12'), ACHARYA_KEY_ALIAS: 'acharya-release',
  ACHARYA_KEY_PASSWORD: fs.readFileSync(path.join(signing, 'keystore-password.txt'), 'utf8').trim(),
  EXPO_NO_DOTENV: '1', NODE_ENV: 'production' });
for (const key of ['CLERK_SECRET_KEY','DATABASE_URL','GNANI_API_KEY','OPENAI_API_KEY','GEMINI_API_KEY']) delete env[key];
const run = (cmd, args, cwd = root) => { const r = spawnSync(cmd, args, { cwd, env, stdio:'inherit' }); if (r.status !== 0) process.exit(r.status || 1); };
run('npx', ['expo','prebuild','--platform','android','--no-install']);
const init = path.join(root,'.expo','acharya-release-signing.gradle');
fs.writeFileSync(init, `gradle.beforeProject { app ->
  app.plugins.withId('com.android.application') {
    app.androidComponents.finalizeDsl { android ->
      def signing = android.signingConfigs.create('acharyaRelease')
      signing.storeFile = new File(System.getenv('ACHARYA_KEYSTORE_PATH'))
      signing.storePassword = System.getenv('ACHARYA_KEY_PASSWORD')
      signing.keyAlias = System.getenv('ACHARYA_KEY_ALIAS')
      signing.keyPassword = System.getenv('ACHARYA_KEY_PASSWORD')
      signing.storeType = 'PKCS12'
      android.buildTypes.release.signingConfig = signing
    }
  }
}
`);
run('./gradlew',[':app:bundleRelease', ':app:assembleRelease','-I',init,'--console=plain','--max-workers=2'],path.join(root,'android'));
fs.mkdirSync(path.join(root,'releases'), {recursive:true});
for (const [source,target] of [['bundle/release/app-release.aab','Acharya-AI-closed-testing.aab'],['apk/release/app-release.apk','Acharya-AI-closed-testing.apk']]) {
  fs.copyFileSync(path.join(root,'android/app/build/outputs',source),path.join(root,'releases',target));
}
console.log('Signed candidates saved in releases/. Not submitted to Google Play.');
