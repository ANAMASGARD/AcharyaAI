/* global __dirname */
// Local signed candidate. Credentials stay outside the checkout and out of arguments.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const version = require('../package.json').version;
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
Object.assign(env, { EXPO_PUBLIC_APP_VARIANT: 'production', EXPO_PUBLIC_GOOGLE_AUTH_ENABLED: 'true', EXPO_PUBLIC_FACEBOOK_AUTH_ENABLED: 'true',
  // Enable explicitly for a Microsoft validation candidate; default releases stay gated.
  EXPO_PUBLIC_MICROSOFT_AUTH_ENABLED: process.env.EXPO_PUBLIC_MICROSOFT_AUTH_ENABLED === 'true' ? 'true' : 'false',
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
// AGP resource shrinking cannot generate an AAB and multiple APKs in one run.
const gradleArgs = ['-I',init,'--console=plain','--max-workers=2','--no-daemon'];
run('./gradlew',[':app:bundleRelease','-Pacharya.splitApks=false',...gradleArgs],path.join(root,'android'));
run('./gradlew',[':app:assembleRelease','-Pacharya.splitApks=true',...gradleArgs],path.join(root,'android'));
fs.mkdirSync(path.join(root,'releases'), {recursive:true});
const artifacts = [
  ['bundle/release/app-release.aab', `Acharya-AI-${version}.aab`],
  ['apk/release/app-universal-release.apk', `Acharya-AI-${version}-universal.apk`],
  ...['arm64-v8a', 'armeabi-v7a', 'x86', 'x86_64'].map((abi) =>
    [`apk/release/app-${abi}-release.apk`, `Acharya-AI-${version}-${abi}.apk`]),
];
for (const [source, target] of artifacts) {
  const destination = path.join(root, 'releases', target);
  fs.copyFileSync(path.join(root, 'android/app/build/outputs', source), destination);
  const bytes = fs.readFileSync(destination);
  fs.writeFileSync(`${destination}.sha256`, `${createHash('sha256').update(bytes).digest('hex')}  ${target}\n`);
}
for (const [source, target] of [
  [`Acharya-AI-${version}.aab`, 'Acharya-AI-closed-testing.aab'],
  [`Acharya-AI-${version}-universal.apk`, 'Acharya-AI-closed-testing.apk'],
]) fs.copyFileSync(path.join(root, 'releases', source), path.join(root, 'releases', target));
console.log(`Signed ${version} candidates saved in releases/. Use the arm64-v8a APK for modern ARM phones. Not submitted to Google Play.`);
