const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

function loadCompletion(signUp, onComplete = async () => {}) {
  const hooks = [];
  let cursor = 0;
  const jsx = (type, props) => ({ type, props });
  const mocks = {
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    react: {
      useRef(initial) { const index = cursor++; hooks[index] ??= { current: initial }; return hooks[index]; },
      useState(initial) { const index = cursor++; if (!(index in hooks)) hooks[index] = initial; return [hooks[index], (value) => { hooks[index] = value; }]; },
    },
    'react-native': { Modal: 'Modal', Pressable: 'Pressable', Text: 'Text', View: 'View', StyleSheet: { create: (styles) => styles } },
    '@/components/auth/auth-screen-shell': { AuthLabeledInput: 'Input' },
    '@/components/auth/social-auth-button': { SocialAuthButton: 'Button' },
    '@/components/auth/verification-code-modal': { VerificationCodeModal: 'Code' },
    '@/theme/colors': { colors: {} },
    '@/theme/tokens': { borderWidths: {}, radii: {}, shadows: {}, spacing: {} },
  };
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync('src/components/auth/social-auth-completion.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(source, { exports, Error, require(name) { assert.ok(name in mocks, name); return mocks[name]; } });
  const render = () => { cursor = 0; return exports.SocialAuthCompletion({ signUp, onComplete, onDismiss() {} }); };
  const find = (node, type) => {
    if (!node || typeof node !== 'object') return undefined;
    if (node.type === type) return node;
    const children = node.props?.children;
    for (const child of Array.isArray(children) ? children : [children]) {
      const found = find(child, type);
      if (found) return found;
    }
  };
  return { render, find };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

test('Microsoft email completion updates the existing signup and verifies before activation', async () => {
  const calls = [];
  const complete = { status: 'complete', createdSessionId: 'sess_email_verified' };
  const signUp = {
    emailAddress: null,
    async update(params) { calls.push(['update', params.emailAddress]); return this; },
    async prepareEmailAddressVerification(params) { calls.push(['prepare', params.strategy]); return this; },
    async attemptEmailAddressVerification(params) { calls.push(['attempt', params.code]); return complete; },
    async create() { assert.fail('OAuth signup must not be replaced'); },
  };
  const { render, find } = loadCompletion(signUp, async (result) => { assert.equal(result, complete); calls.push(['activate']); });
  find(render(), 'Input').props.onChangeText(' teacher@example.com ');
  find(render(), 'Button').props.onPress();
  await settle();
  assert.deepEqual(calls, [['update', 'teacher@example.com'], ['prepare', 'email_code']]);
  assert.equal(find(render(), 'Code').props.visible, true);
  find(render(), 'Code').props.onComplete('123456');
  await settle();
  assert.deepEqual(calls.slice(2), [['attempt', '123456'], ['activate']]);
});

test('an incorrect Microsoft email code keeps the verification open', async () => {
  let activated = false;
  const signUp = {
    emailAddress: 'teacher@example.com',
    async update() { return this; },
    async prepareEmailAddressVerification() { return this; },
    async attemptEmailAddressVerification() { throw new Error('Incorrect code'); },
  };
  const { render, find } = loadCompletion(signUp, async () => { activated = true; });
  find(render(), 'Button').props.onPress();
  await settle();
  find(render(), 'Code').props.onComplete('000000');
  await settle();
  assert.equal(activated, false);
  assert.equal(find(render(), 'Code').props.visible, true);
  assert.equal(find(render(), 'Code').props.error, 'Incorrect code');
});

test('resending an email code does not create or replace the OAuth signup', async () => {
  let updates = 0, preparations = 0;
  const signUp = {
    emailAddress: 'teacher@example.com',
    async update() { updates++; return this; },
    async prepareEmailAddressVerification() { preparations++; return this; },
  };
  const { render, find } = loadCompletion(signUp);
  find(render(), 'Button').props.onPress();
  await settle();
  find(render(), 'Code').props.onResend();
  await settle();
  assert.equal(updates, 1);
  assert.equal(preparations, 2);
});
