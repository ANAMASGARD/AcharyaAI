// Export only. Publication remains an explicit, separate EAS command.
const { spawnSync } = require('node:child_process');
const env = require('./release-environment.cjs')('staging');
const result = spawnSync('npx', ['expo', 'export', '--platform', 'android', '--output-dir', '.expo/ota-staging'], { env, stdio: 'inherit' });
process.exitCode = result.status ?? 1;
