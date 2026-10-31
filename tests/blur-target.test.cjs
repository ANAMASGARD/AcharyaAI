const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

// Exercise the wrapper's rendered native props without loading a native runtime.
function loadBlurWrapper() {
  let context = null;
  const platform = { OS: 'android' };
  const exports = {};
  const mocks = {
    react: { createContext: () => ({}), forwardRef: (render) => render, useContext: () => context },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
    'react-native': { Platform: platform, StyleSheet: { create: (styles) => styles } },
    'expo-router': {},
    'expo-blur': { BlurView: 'BlurView', BlurTargetView: 'BlurTargetView' },
  };
  const source = fs.readFileSync('src/components/ui/acharya-blur.tsx', 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  });
  vm.runInNewContext(outputText, { exports, require: (name) => {
    assert.ok(name in mocks, `Unexpected import: ${name}`);
    return mocks[name];
  } });
  return {
    platform,
    setTarget: (target) => { context = { target }; },
    render: (props = {}, ref) => exports.AcharyaBlurView(props, ref).props,
  };
}

test('Android blur safely transitions from initial render through focus registration and cleanup', () => {
  const wrapper = loadBlurWrapper();
  assert.equal(wrapper.render().blurMethod, 'none');
  const first = { current: {} };
  wrapper.setTarget(first);
  assert.equal(wrapper.render().blurTarget, first);
  assert.equal(wrapper.render().blurMethod, 'dimezisBlurViewSdk31Plus');
  wrapper.setTarget(undefined);
  assert.equal(wrapper.render().blurMethod, 'none');
  const second = { current: {} };
  wrapper.setTarget(second);
  assert.equal(wrapper.render().blurTarget, second);
  assert.equal(wrapper.render().blurMethod, 'dimezisBlurViewSdk31Plus');
});

test('explicit targets and fallback choices are respected without losing animated props or refs', () => {
  const wrapper = loadBlurWrapper();
  const target = { current: {} };
  const ref = { current: null };
  const animatedProps = { intensity: 42 };
  const props = wrapper.render({ blurTarget: target, blurMethod: 'none', animatedProps }, ref);
  assert.equal(props.blurTarget, target);
  assert.equal(props.blurMethod, 'none');
  assert.equal(props.animatedProps, animatedProps);
  assert.equal(props.ref, ref);
  assert.equal(wrapper.render({ blurMethod: 'dimezisBlurView' }).blurMethod, 'none');
});

test('iOS and web retain their default blur behavior without an Android target', () => {
  const wrapper = loadBlurWrapper();
  for (const platform of ['ios', 'web']) {
    wrapper.platform.OS = platform;
    assert.equal(wrapper.render({ intensity: 36 }).blurMethod, undefined);
    assert.equal(wrapper.render({ intensity: 36 }).intensity, 36);
  }
});
