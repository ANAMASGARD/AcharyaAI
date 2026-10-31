const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = process.cwd();

test('onboarding slides data has three reference slides', () => {
  const src = fs.readFileSync(path.join(root, 'src/data/onboarding-slides.ts'), 'utf8');
  assert.match(src, /Namaste,/);
  assert.match(src, /Record/);
  assert.match(src, /Grow Every/);
  assert.match(src, /mascotWelcome/);
  assert.match(src, /mascotLogo/);
  assert.match(src, /mascotPencil/);
  const slideIds = src.match(/id: '/g);
  assert.equal(slideIds?.length, 3);
});

test('onboarding persistence module exports get and set', () => {
  const src = fs.readFileSync(path.join(root, 'src/lib/onboarding-persistence.ts'), 'utf8');
  assert.match(src, /export async function getOnboardingCompleted/);
  assert.match(src, /export async function setOnboardingCompleted/);
  assert.match(src, /acharya_onboarding_completed/);
});

test('index gate routes unsigned users through onboarding or sign-in', () => {
  const indexSrc = fs.readFileSync(path.join(root, 'src/app/index.tsx'), 'utf8');
  assert.match(indexSrc, /\/onboarding/);
  assert.match(indexSrc, /\/sign-in/);
  assert.match(indexSrc, /\/\(tabs\)/);
});
