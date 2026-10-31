const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = process.cwd();

test('Acharya theme colors match neo-brutal palette', () => {
  const colorsSrc = fs.readFileSync(path.join(root, 'src/theme/colors.ts'), 'utf8');
  assert.match(colorsSrc, /primary: '#FFDB33'/);
  assert.match(colorsSrc, /cream: '#FFF8E7'/);
  assert.match(colorsSrc, /border: '#000000'/);
});

test('Acharya theme tokens define touch targets and hard shadows', () => {
  const tokensSrc = fs.readFileSync(path.join(root, 'src/theme/tokens.ts'), 'utf8');
  assert.match(tokensSrc, /touch: 44/);
  assert.match(tokensSrc, /default: 3/);
  assert.match(tokensSrc, /shadowRadius: 0/);
});

test('Brand assets and fonts are present', () => {
  const required = [
    'assets/images/icon.png',
    'assets/images/google-logo.png',
    'assets/images/mascot-auth.png',
    'assets/fonts/ArchivoBlack-Regular.ttf',
    'assets/fonts/SpaceGrotesk-Bold.ttf',
  ];
  for (const relativePath of required) {
    assert.ok(fs.existsSync(path.join(root, relativePath)), relativePath);
  }
});
