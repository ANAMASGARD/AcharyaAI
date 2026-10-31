const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');
const { colors } = require('../src/theme/colors.ts');

function composer(draftText) {
  const exports = {};
  const calls = [];
  const native = Object.fromEntries(['ActivityIndicator', 'Pressable', 'Text', 'TextInput', 'View'].map((name) => [name, name]));
  native.StyleSheet = { create: (value) => value };
  native.Keyboard = { dismiss() {} };
  const mocks = {
    react: { useState: (value) => [value, () => {}], useCallback: (fn) => fn },
    'react/jsx-runtime': require('react/jsx-runtime'),
    'react-native': native,
    '@/components/feedback/pressable': { Pressable: 'Pressable' },
    'expo-router': { useFocusEffect() {} },
    'react-native-reanimated': { default: { View: 'AnimatedView' }, FadeIn: { duration: () => ({}) } },
    '@expo/vector-icons': { MaterialCommunityIcons: 'Icon' },
    '@/theme/use-theme': { useThemeColors: () => colors, useThemeStyles: (fn) => fn(colors) },
    '@/theme/tokens': { spacing: {}, radii: {}, borderWidths: {} },
    '@/theme/typography': { fontFamilies: {} },
    '@/hooks/use-chat-attachments': { useChatAttachments: () => ({ attachments: [], busy: false, error: null }) },
    '@/components/chat/chat-attachment-menu': { ChatAttachmentMenu: 'Menu' },
    '@/components/chat/chat-attachments': { ChatAttachments: 'Attachments' },
    '@/components/chat/voice-input-preview': { VoiceInputPreview: 'Preview' },
    '@/components/chat/voice-waveform-icon': { VoiceWaveformIcon: 'Wave' },
  };
  const code = ts.transpileModule(fs.readFileSync('src/components/chat/chat-composer.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { exports, require: (name) => { assert.ok(name in mocks, name); return mocks[name]; } });
  const tree = exports.ChatComposer({ draftText, onChangeText() {}, onSend: () => calls.push('send'), onVoiceAgent: () => calls.push('voice'), voiceInputStatus: 'idle' });
  const nodes = [];
  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    nodes.push(node); walk(node.props?.children);
  }
  walk(tree);
  return { nodes, calls };
}

test('empty and whitespace drafts offer voice; typing switches to send', () => {
  for (const text of ['', '   ', 'Hello']) {
    const { nodes, calls } = composer(text);
    const hasText = Boolean(text.trim());
    const button = nodes.find((node) => node.props?.accessibilityLabel === (hasText ? 'Send message' : 'Start voice conversation'));
    assert.ok(button);
    assert.equal(button.props.disabled, false);
    button.props.onPress();
    assert.deepEqual(calls, [hasText ? 'send' : 'voice']);
    assert.ok(nodes.some((node) => hasText ? node.props?.name === 'arrow-up' : node.type === 'Wave'));
    assert.ok(nodes.some((node) => node.props?.accessibilityLabel === 'Add attachment'));
    assert.ok(nodes.some((node) => node.props?.accessibilityLabel === 'Voice message'));
  }
});
