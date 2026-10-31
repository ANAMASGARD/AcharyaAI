const test = require('node:test');
const assert = require('node:assert/strict');
const { createTapSound } = require('../src/lib/tap-sound.ts');
const { parsePreferences, DEFAULT_UI_PREFERENCES } = require('../src/lib/ui-preview/types.ts');

test('sound preferences survive roundtrip, upgrade older records, and reject invalid values', () => {
  assert.equal(parsePreferences(null).soundEffectsEnabled, true);
  const { soundEffectsEnabled, ...legacy } = DEFAULT_UI_PREFERENCES;
  assert.equal(parsePreferences(JSON.stringify(legacy)).soundEffectsEnabled, true);
  for (const value of [true, false]) {
    assert.equal(parsePreferences(JSON.stringify({ ...legacy, soundEffectsEnabled: value })).soundEffectsEnabled, value);
  }
  assert.throws(() => parsePreferences(JSON.stringify({ ...legacy, soundEffectsEnabled: 'false' })), /preferences/);
});

test('every tap dispatches seek and playback immediately, including after Android ends', async () => {
  const calls = [];
  const player = {
    isLoaded: false, // Android reports this after STATE_ENDED.
    pause() {},
    seekTo(seconds) { calls.push(['seek', seconds]); return new Promise(() => {}); },
    play() { calls.push(['play']); },
  };
  const sound = createTapSound(player);
  for (let tap = 0; tap < 5; tap++) sound.play();
  assert.deepEqual(calls, Array.from({ length: 5 }, () => [['seek', 0], ['play']]).flat());
});

test('mute stops playback and a late seek completion never triggers another play', async () => {
  let finish;
  let plays = 0;
  let pauses = 0;
  const sound = createTapSound({
    seekTo: () => new Promise((resolve) => { finish = resolve; }),
    play: () => plays++,
    pause: () => pauses++,
  });
  sound.play();
  assert.equal(plays, 1);
  sound.setActive(false);
  sound.play();
  finish();
  await Promise.resolve();
  assert.equal(plays, 1);
  assert.equal(pauses, 1);
  sound.setActive(true);
  sound.play();
  assert.equal(plays, 2);
});

test('failed audio operations never escape into button handlers', async () => {
  const sound = createTapSound({
    seekTo: async () => { throw new Error('seek failed'); },
    play() { throw new Error('play failed'); },
    pause() { throw new Error('already removed'); },
  });
  assert.doesNotThrow(() => sound.play());
  assert.doesNotThrow(() => sound.setActive(false));
  await Promise.resolve();
});

test('feedback Pressable preserves refs and handlers and skips disabled presses', () => {
  const fs = require('node:fs');
  const vm = require('node:vm');
  const ts = require('typescript');
  const exports = {};
  let taps = 0;
  let actions = 0;
  const mocks = {
    'react/jsx-runtime': require('react/jsx-runtime'),
    'react-native': { Pressable: 'NativePressable' },
    './tap-sound-provider': { useTapSound: () => () => taps++ },
  };
  const compiled = ts.transpileModule(fs.readFileSync('src/components/feedback/pressable.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(compiled, { exports, require: (name) => mocks[name] });
  const ref = { current: null };
  const event = {};
  const props = { ref, accessibilityLabel: 'Action', onPress: (value) => { assert.equal(value, event); actions++; } };
  const tree = exports.Pressable(props);
  assert.equal(tree.props.ref, ref);
  assert.equal(tree.props.accessibilityLabel, 'Action');
  tree.props.onPress(event);
  assert.equal(taps, 1);
  assert.equal(actions, 1);
  exports.Pressable({ ...props, disabled: true }).props.onPress(event);
  assert.equal(taps, 1);
  assert.equal(actions, 1);
  assert.equal(exports.Pressable({}).props.onPress, undefined);
  const backdrop = exports.Pressable({ ...props, soundFeedback: false });
  backdrop.props.onPress(event);
  assert.equal(taps, 1, 'background dismissal is silent');
  assert.equal(actions, 2, 'background dismissal still works');
  assert.equal(backdrop.props.soundFeedback, undefined, 'custom prop stays off native view');
});
