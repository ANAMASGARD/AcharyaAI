const { Buffer } = require('node:buffer');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');
function load(file, mocks = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, AbortController, FormData, Uint8Array, TextDecoder, setTimeout, clearTimeout, require: name => { if (!(name in mocks)) throw Error(name); return mocks[name]; } });
  return exports;
}
function setup({ selected = 'gemini', response, credential, fetcher } = {}) {
  const calls = [];
  const cancellation = load('src/lib/ai/cancellation.ts');
  const vault = { getActiveProvider: async () => selected, getProviderCredential: credential ?? (async (owner, provider) => {
    assert.equal(owner, 'alice');
    return { apiKey: `${provider}-private`, model: 'test-model', baseUrl: 'https://compatible.example/v1' };
  }) };
  const transport = load('src/lib/ai/transport.ts', {
    '@/lib/ai-keys/vault': vault, './cancellation': cancellation,
    'expo/fetch': { fetch: async (url, options) => { calls.push({ url, options }); return fetcher ? fetcher(url, options) : response; } },
  });
  return { calls, cancellation, transport,
    models: load('src/lib/ai/models.ts', { './transport': transport }),
    chat: load('src/lib/ai/chat.ts', { '@/lib/ai-keys/vault': vault, './transport': transport }),
    speech: load('src/lib/ai/speech.ts', { './transport': transport }),
  };
}
const signal = () => new AbortController().signal;
const history = [{ role: 'user', content: 'Explain fractions', messageId: 'm1' }];
test('Gemini, OpenAI-compatible and Claude route only to their selected API and parse text', async () => {
  const cases = [
    ['gemini', { candidates: [{ content: { parts: [{ thought: true, text: 'hidden' }, { text: 'Gemini answer' }] } }] }, 'Gemini answer', 'https://generativelanguage.googleapis.com/v1beta/models/test-model:generateContent', 'x-goog-api-key'],
    ['openai', { choices: [{ message: { content: 'OpenAI answer' } }] }, 'OpenAI answer', 'https://compatible.example/v1/chat/completions', 'Authorization'],
    ['claude', { content: [{ type: 'thinking', thinking: 'hidden' }, { type: 'text', text: 'Claude answer' }] }, 'Claude answer', 'https://api.anthropic.com/v1/messages', 'x-api-key'],
  ];
  for (const [selected, data, expected, url, header] of cases) {
    const { chat, calls } = setup({ selected, response: Response.json(data) });
    assert.equal(await chat.generateChatReply('alice', history, signal()), expected);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, url);
    assert.ok(calls[0].options.headers[header].includes(`${selected}-private`));
    assert.equal(calls[0].options.redirect, 'error');
    assert.equal(calls[0].options.credentials, 'omit');
    const body = JSON.parse(calls[0].options.body);
    assert.equal(JSON.stringify(body).includes('private'), false);
    assert.equal(JSON.stringify(body).includes('alice'), false);
    if (selected === 'claude') { assert.equal(body.max_tokens, 4096); assert.equal(calls[0].options.headers['anthropic-version'], '2023-06-01'); }
  }
});
test('direct Gnani STT uses en-IN and audio_file; empty and repeated speech are preserved', async () => {
  for (const transcript of ['', 'yes yes yes']) {
    const { speech, calls } = setup({ response: Response.json({ success: true, transcript }) });
    assert.equal(await speech.transcribeAudio('alice', new Blob(['wav']), signal()), transcript);
    const { url, options } = calls[0];
    assert.equal(url, 'https://api.vachana.ai/stt/v3');
    assert.equal(options.headers['X-API-Key-ID'], 'gnani-private');
    assert.equal(options.body.get('language_code'), 'en-IN');
    assert.equal(options.body.get('format'), 'transcribe');
    assert.equal(options.body.get('model'), 'prisma-v3.0');
    assert.equal(options.body.get('audio_file').name, 'segment.wav');
    assert.equal(options.body.has('owner'), false);
  }
  await assert.rejects(setup({ response: Response.json({ success: false, transcript: 'no' }) }).speech.transcribeAudio('alice', new Blob(['wav']), signal()), /invalid transcript/);
});
test('Gnani TTS requests Timbre WAV and rejects JSON pretending to be audio', async () => {
  const wav = new Uint8Array(44); wav.set(Buffer.from('RIFF')); wav.set(Buffer.from('WAVE'), 8);
  const { speech, calls } = setup({ response: new Response(wav) });
  assert.equal((await speech.synthesizeSpeech('alice', 'Hello', signal())).length, 44);
  const payload = JSON.parse(calls[0].options.body);
  assert.equal(payload.model, 'timbre-v2.5'); assert.equal(payload.audio_config.container, 'wav');
  assert.equal(payload.voice, 'Poorvi'); assert.equal(payload.language, 'hi-en');
  await assert.rejects(setup({ response: Response.json({ error: 'private' }) }).speech.synthesizeSpeech('alice', 'Hello', signal()), /invalid speech/);
});
test('provider auth, quota, and failures are redacted and retries are classified', async () => {
  for (const status of [401, 403, 404, 429, 500]) {
    const { chat } = setup({ response: Response.json({ error: 'secret-key-should-not-echo' }, { status, headers: { 'retry-after': '4' } }) });
    await assert.rejects(chat.generateChatReply('alice', history, signal()), error => {
      assert.equal(error.message.includes('secret-key'), false);
      assert.equal(error.retryable, status === 429 || status === 500);
      assert.equal(error.retryAfterMs, 4000);
      return true;
    });
  }
});
test('cancellation before credential retrieval finishes sends nothing, account cleanup aborts only its requests', async () => {
  let release;
  const credential = () => new Promise(resolve => { release = resolve; });
  const { speech, calls, cancellation } = setup({ credential });
  const pending = speech.transcribeAudio('alice', new Blob(['wav']), signal());
  await Promise.resolve();
  cancellation.cancelAiRequests('bob');
  cancellation.cancelAiRequests('alice');
  release({ apiKey: 'private' });
  await assert.rejects(pending, /cancelled/);
  assert.equal(calls.length, 0);
  const stopped = new AbortController(); stopped.abort();
  await assert.rejects(speech.transcribeAudio('alice', new Blob(['wav']), stopped.signal), /cancelled/);
});
test('invalid, interrupted, or oversized provider responses fail without exposing bodies', async () => {
  await assert.rejects(setup({ response: new Response('not-json-private') }).chat.generateChatReply('alice', history, signal()), /unreadable/);
  await assert.rejects(setup({ response: Response.json({ candidates: [] }) }).chat.generateChatReply('alice', history, signal()), /no text/);
  const { transport } = setup();
  await assert.rejects(transport.readBytes(new Response('x'.repeat(50)), 10), /too large/);
});
test('direct recorder keeps chunk identity and has no session server dependency', async () => {
  const types = load('src/lib/recording/types.ts');
  let fetches = 0;
  const api = load('src/lib/recording/direct-api.ts', {
    'expo-file-system': { File: class { exists = true; } },
    '@/lib/ai-keys/vault': { getProviderCredential: async () => ({ apiKey: 'key' }) },
    '@/lib/ai/speech': { transcribeAudio: async () => { fetches++; return 'text text'; } },
    '@/lib/ai/transport': setup().transport, './types': types,
  }).createDirectRecordingApi('alice');
  await api.create({}, signal()); await api.finalize({}, signal());
  assert.equal(fetches, 0);
  const chunk = { id: 'chunk', index: 2, localUri: 'file:///chunk.wav' };
  const result = await api.transcribe({}, chunk, signal());
  assert.equal(result.chunkId, 'chunk'); assert.equal(result.chunkIndex, 2); assert.equal(result.transcript, 'text text');
});

test('model picker loads all Gemini pages and descriptions, deduplicates, and marks non-chat models', async () => {
  const pages = [
    { models: [{ name: 'models/gemini-a', displayName: 'Gemini A', description: 'Fast replies', supportedGenerationMethods: ['generateContent'] }], nextPageToken: 'page/2' },
    { models: [{ name: 'models/gemini-a', supportedGenerationMethods: ['generateContent'] }, { name: 'models/embed', description: 'Vectors', supportedGenerationMethods: ['embedContent'] }] },
  ];
  const h = setup({ fetcher: async () => Response.json(pages.shift()) });
  const models = await h.models.listProviderModels('alice', 'gemini', signal());
  assert.equal(models.length, 2);
  assert.equal(models.find(model => model.id === 'embed').selectable, false);
  assert.match(h.calls[1].url, /pageToken=page%2F2/);
  assert.equal(h.calls[0].options.headers['x-goog-api-key'], 'gemini-private');
  assert.equal(h.calls[0].options.method, 'GET');
});
test('model catalogs use Claude cursor pagination and saved compatible OpenAI base URL', async () => {
  const pages = [
    { data: [{ id: 'claude-a', display_name: 'Claude A', max_input_tokens: 200000 }], has_more: true, last_id: 'claude-a' },
    { data: [{ id: 'claude-b', display_name: 'Claude B', lifecycle: 'retired' }], has_more: false },
  ];
  const h = setup({ fetcher: async () => Response.json(pages.shift()) });
  const models = await h.models.listProviderModels('alice', 'claude', signal());
  assert.equal(models.length, 2);
  assert.match(models[0].description, /200,000 input tokens/);
  assert.equal(models[1].selectable, false);
  assert.match(h.calls[1].url, /after_id=claude-a/);
  assert.equal(h.calls[0].options.headers['anthropic-version'], '2023-06-01');
  const custom = setup({ response: Response.json({ data: [{ id: 'custom/model', owned_by: 'Custom provider' }] }) });
  assert.equal((await custom.models.listProviderModels('alice', 'openai', signal()))[0].description, 'Custom provider · chat compatibility varies');
  assert.equal(custom.calls[0].url, 'https://compatible.example/v1/models');
});
test('model catalogs fail on repeated pages, malformed lists, and partial-page errors', async () => {
  const looping = setup({ fetcher: async () => Response.json({ models: [], nextPageToken: 'same' }) });
  await assert.rejects(looping.models.listProviderModels('alice', 'gemini', signal()), /repeated/);
  assert.equal(looping.calls.length, 2);
  const invalid = setup({ response: Response.json({ data: 'wrong' }) });
  await assert.rejects(invalid.models.listProviderModels('alice', 'openai', signal()), /invalid model list/);
  let page = 0;
  const partial = setup({ fetcher: async () => ++page === 1 ? Response.json({ data: [{ id: 'claude-a' }], has_more: true, last_id: 'claude-a' }) : new Response('', { status: 429 }) });
  await assert.rejects(partial.models.listProviderModels('alice', 'claude', signal()), /quota or rate limit/);
});
