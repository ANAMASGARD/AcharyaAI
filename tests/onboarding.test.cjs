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

test('index gate routes unsigned users to onboarding and signed-in users to tabs', () => {
  const indexSrc = fs.readFileSync(path.join(root, 'src/app/index.tsx'), 'utf8');
  const routesSrc = fs.readFileSync(path.join(root, 'src/lib/routes.ts'), 'utf8');
  assert.match(routesSrc, /SIGNED_OUT_ENTRY.*\/onboarding/);
  assert.match(routesSrc, /SIGNED_IN_HOME.*\/\(tabs\)/);
  assert.match(indexSrc, /SIGNED_OUT_ENTRY/);
  assert.match(indexSrc, /SIGNED_IN_HOME/);
  assert.doesNotMatch(indexSrc, /hasCompletedOnboarding/);
});

test('onboarding route skips slides only when signed in', () => {
  const onboardingSrc = fs.readFileSync(path.join(root, 'src/app/onboarding.tsx'), 'utf8');
  assert.match(onboardingSrc, /OnboardingScreen/);
  assert.doesNotMatch(onboardingSrc, /hasCompletedOnboarding/);
});
