const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const ts = require('typescript');
const { colors, darkColors } = require('../src/theme/colors.ts');
const { parsePreferences } = require('../src/lib/ui-preview/types.ts');

function luminance(hex) {
  const rgb = hex.slice(1).match(/../g).map((part) => parseInt(part, 16) / 255)
    .map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test('neutral surfaces and unchanged accent fills have readable text in both modes', () => {
  for (const palette of [colors, darkColors]) {
    for (const background of ['background', 'cream', 'card', 'input']) {
      for (const foreground of ['foreground', 'mutedForeground']) {
        assert.ok(contrast(palette[background], palette[foreground]) >= 4.5, `${background}/${foreground}`);
      }
    }
    for (const accent of ['primary', 'mint', 'sky', 'coral', 'coralLight', 'lime', 'lavender', 'accent']) {
      assert.equal(palette[accent], colors[accent], accent);
      assert.ok(contrast(palette[accent], palette.onAccent) >= 4.5, accent);
      assert.ok(contrast(palette[accent], palette.mutedOnAccent) >= 4.5, `${accent} secondary text`);
    }
    assert.ok(contrast('#FF8EC8', palette.onAccent) >= 4.5, 'pink send button');
  }
});

test('appearance preferences restore, default older accounts to light, and reject corrupt modes', () => {
  const original = { selectedLanguageId: null, teachingClassIds: ['7'], pushNotificationsEnabled: true };
  assert.equal(parsePreferences(null).colorMode, 'light');
  assert.equal(parsePreferences(JSON.stringify(original)).colorMode, 'light');
  assert.equal(parsePreferences(JSON.stringify({ ...original, colorMode: 'dark' })).colorMode, 'dark');
  assert.throws(() => parsePreferences(JSON.stringify({ ...original, colorMode: 'invalid' })), /preferences/);
});

test('theme context supplies dark surfaces and dark text on accents without a global palette mutation', () => {
  const exports = {};
  const navigation = { colors: {} };
  const mocks = {
    react: React,
    'react-native': { Appearance: {}, Platform: { OS: 'android' } },
    'react/jsx-runtime': require('react/jsx-runtime'),
    'expo-router': { DarkTheme: navigation, DefaultTheme: navigation, ThemeProvider: ({ children }) => children },
    'expo-status-bar': { StatusBar: () => null },
    '@/theme/colors': { colors, darkColors },
  };
  const compiled = ts.transpileModule(fs.readFileSync('src/theme/use-theme.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(compiled, { exports, require: (name) => { assert.ok(name in mocks); return mocks[name]; } });
  const { AppThemeProvider, AccentContent, useThemeColors, useThemeStyles } = exports;
  const factory = (palette) => ({ background: palette.card, color: palette.foreground });
  function Probe() {
    const palette = useThemeColors();
    const style = useThemeStyles(factory);
    return React.createElement('span', { 'data-card': style.background, 'data-text': style.color, 'data-yellow': palette.primary });
  }
  function render(mode, accent = false) {
    return renderToStaticMarkup(React.createElement(AppThemeProvider, { mode },
      React.createElement(AccentContent, { active: accent }, React.createElement(Probe))));
  }
  assert.match(render('dark'), /data-card="#202020" data-text="#F5F5F5"/);
  assert.match(render('dark', true), /data-text="#000000"/);
  assert.match(render('light'), /data-card="#FFFFFF" data-text="#000000"/);
  assert.equal(colors.card, '#FFFFFF');
});
