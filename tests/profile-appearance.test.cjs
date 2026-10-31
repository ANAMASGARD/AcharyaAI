const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

// Render the adapter without native modules. Unexpected imports fail the test,
// including reintroducing an Expo UI Host into this scrollable settings row.
function renderToggle(mode) {
  const changes = [];
  const exports = {};
  const Row = () => null;
  const mocks = {
    'react/jsx-runtime': require('react/jsx-runtime'),
    '@/components/profile/profile-toggle-row': { ProfileToggleRow: Row },
    '@/components/preview/preview-provider': {
      useUiPreferences: () => ({ colorMode: mode, setColorMode: (value) => changes.push(value) }),
    },
  };
  const compiled = ts.transpileModule(fs.readFileSync('src/components/profile/appearance-toggle.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(compiled, {
    exports,
    require: (name) => { assert.ok(name in mocks, `Unexpected dependency: ${name}`); return mocks[name]; },
  });
  const element = exports.AppearanceToggle();
  assert.equal(element.type, Row);
  return { props: element.props, changes };
}

test('Profile appearance uses the existing settings switch and restores its saved value', () => {
  for (const mode of ['light', 'dark']) {
    const { props } = renderToggle(mode);
    assert.equal(props.label, 'Dark mode');
    assert.equal(props.value, mode === 'dark');
    assert.equal(props.icon, mode === 'dark' ? 'weather-night' : 'white-balance-sunny');
  }
});

test('appearance switch writes both modes through account preferences', () => {
  const { props, changes } = renderToggle('light');
  props.onValueChange(true);
  props.onValueChange(false);
  assert.deepEqual(changes, ['dark', 'light']);
});
