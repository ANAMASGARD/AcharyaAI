/* global __dirname */
// Download only the pinned public test artifact; never included in the app's main assets.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const directory = path.join(root, '.expo/native-gate/assets');
const name = 'embeddinggemma-2-text-270m.litertlm';
const expectedSize = 164626432;
const expectedHash = '2d079ee2f6f066b1f368e8d7c819f55214eaef1d0513b312321901f30ab286fb';
const url = `https://huggingface.co/litert-community/embeddinggemma-2-text-270m-litert-lm/resolve/9be6e8b90982095dc05c2bd162e4b954ee4dbac7/${name}`;
async function verify(file) {
  if (!fs.existsSync(file) || fs.statSync(file).size !== expectedSize) return false;
  const hash = crypto.createHash('sha256');
  for await (const buffer of fs.createReadStream(file)) hash.update(buffer);
  return hash.digest('hex') === expectedHash;
}
async function main() {
  fs.mkdirSync(directory, { recursive: true });
  const target = path.join(directory, name);
  if (!(await verify(target))) {
    const temporary = target + '.part';
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(600000) });
      if (!response.ok || !response.body) throw new Error(`Download returned HTTP ${response.status}`);
      await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(temporary));
      if (!(await verify(temporary))) throw new Error('Model size or SHA-256 mismatch');
      fs.renameSync(temporary, target);
    } finally {
      fs.rmSync(temporary, { force: true });
    }
  }
  console.log(`Verified ${name}: ${expectedSize} bytes, SHA-256 ${expectedHash}`);
  const packagePath = path.join(root, 'package.json');
  const original = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const result = spawnSync('npx', ['expo', 'prebuild', '--platform', 'android', '--no-install'], {
    cwd: root, stdio: 'inherit', env: { ...process.env, ACHARYA_NATIVE_GATE: '1' },
  });
  // Expo prebuild rewrites launch scripts; this test setup preserves the app's commands.
  const updated = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  for (const key of ['android', 'ios']) updated.scripts[key] = original.scripts[key];
  fs.writeFileSync(packagePath, JSON.stringify(updated, null, 2) + '\n');
  if (result.status !== 0) throw new Error('Gate prebuild failed');
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
