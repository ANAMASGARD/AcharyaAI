const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const NANOID_PATTERN = /^[A-Za-z0-9_-]{21}$/;

function isAcharyaId(value) {
  return NANOID_PATTERN.test(value);
}

describe('Acharya ID validation', () => {
  it('accepts 21-char URL-safe ids', () => {
    assert.equal(isAcharyaId('V1StGXR8_Z5jdHi6B-myT'), true);
  });

  it('rejects short or invalid ids', () => {
    assert.equal(isAcharyaId('too-short'), false);
    assert.equal(isAcharyaId('invalid chars!!!!!!!!!!'), false);
  });
});
