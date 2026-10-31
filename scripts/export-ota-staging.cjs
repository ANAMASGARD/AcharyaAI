// Export only. Publication remains an explicit, separate EAS command.
const { spawnSync } = require('node:child_process');
const { Buffer } = require('node:buffer');
const fs = require('node:fs');
const path = require('node:path');
const env = require('./release-environment.cjs')('staging');
const result = spawnSync('npx', ['expo', 'export', '--clear', '--platform', 'android', '--output-dir', '.expo/ota-staging'], { env, stdio: 'inherit' });
process.exitCode = result.status ?? 1;
if (process.exitCode === 0) {
  const root = '.expo/ota-staging';
  const metadata = JSON.parse(fs.readFileSync(path.join(root, 'metadata.json'), 'utf8'));
  const bundle = fs.readFileSync(path.join(root, metadata.fileMetadata.android.bundle));
  for (const key of ['EXPO_PUBLIC_NEON_FUNCTION_URL', 'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY']) {
    if (!env[key] || !bundle.includes(Buffer.from(env[key]))) throw new Error(`Staging bundle is missing its configured ${key}.`);
  }
}
