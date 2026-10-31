const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');
const { colors } = require('../src/theme/colors.ts');
function card(getKey = async () => ({ apiKey: 'saved-private' })) {
  const slots = []; let index = 0; let effect; let cleanup; const saved = [];
  const exports = {};
  const mocks = {
    react: {
      useState(initial) { const i = index++; if (!(i in slots)) slots[i] = initial; return [slots[i], next => { slots[i] = next; }]; },
      useRef(initial) { const i = index++; return slots[i] ??= { current: initial }; },
      useEffect(fn) { if (!effect) effect = fn; },
    },
    'react/jsx-runtime': require('react/jsx-runtime'),
    '@expo/vector-icons': { MaterialCommunityIcons: 'Icon' },
    'react-native': { StyleSheet: { create: value => value }, ActivityIndicator: 'Spinner', Text: 'Text', TextInput: 'Input', View: 'View' },
    '@/components/profile/provider-model-picker': { ProviderModelPicker: 'Picker' },
    '@/components/feedback/pressable': { Pressable: 'Button' },
    '@/theme/use-theme': { useThemeStyles: fn => fn(colors) },
    '@/theme/typography': { fontFamilies: {} },
    '@/lib/ai-keys/providers': { defaultModels: {}, defaultOpenAiUrl: 'https://api.openai.com/v1', validateCredential: (_, value) => value },
    '@/lib/ai-keys/vault': { getProviderSummary: async () => ({ configured: true }), getProviderCredential: getKey,
      saveProviderCredential: async (...args) => saved.push(args), removeProviderCredential: async () => {}, setActiveProvider: async () => {} },
    '@/lib/confirm-action': { confirmAction: async () => true },
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/profile/provider-key-card.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, require: name => { if (!(name in mocks)) throw Error(name); return mocks[name]; } });
  const render = () => {
    index = 0;
    const tree = exports.ProviderKeyCard({ owner: 'alice', provider: { id: 'gnani', name: 'Gnani AI', description: 'Speech' } });
    if (!cleanup && effect) cleanup = effect();
    const nodes = [];
    const walk = node => { if (!node || typeof node !== 'object') return; if (Array.isArray(node)) { node.forEach(walk); return; } nodes.push(node); walk(node.props?.children); };
    walk(tree);
    return { input: nodes.find(node => node.type === 'Input'), button: label => nodes.find(node => node.props?.accessibilityLabel === label) };
  };
  return { render, saved, unmount: () => cleanup?.() };
}
const tick = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
test('eye reveals saved or typed keys, hides them again, and save clears visible input', async () => {
  const h = card(); h.render(); await tick();
  assert.equal(h.render().input.props.secureTextEntry, true);
  assert.equal(h.render().input.props.value, '');
  h.render().button('Show Gnani AI key').props.onPress(); await tick();
  assert.equal(h.render().input.props.value, 'saved-private');
  assert.equal(h.render().input.props.secureTextEntry, false);
  h.render().button('Hide Gnani AI key').props.onPress();
  assert.equal(h.render().input.props.secureTextEntry, true);
  h.render().input.props.onChangeText('replacement');
  h.render().button('Show Gnani AI key').props.onPress(); await tick();
  assert.equal(h.render().input.props.value, 'replacement');
  h.render().button('Save Gnani AI key locally').props.onPress(); await tick();
  assert.equal(h.saved[0][2].apiKey, 'replacement');
  assert.equal(h.render().input.props.value, '');
  assert.equal(h.render().input.props.secureTextEntry, true);
  h.unmount();
});
test('saved-key reveal completing after leaving the screen does not populate input', async () => {
  let release;
  const h = card(() => new Promise(resolve => { release = resolve; })); h.render(); await tick();
  h.render().button('Show Gnani AI key').props.onPress(); await tick();
  h.unmount(); release({ apiKey: 'late-private' }); await tick();
  assert.equal(h.render().input.props.value, '');
  assert.equal(h.render().input.props.secureTextEntry, true);
});
