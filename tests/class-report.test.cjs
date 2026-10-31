const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');
function load(file, mocks = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, AbortController, Uint8Array, TextDecoder, setTimeout, clearTimeout, require: (name) => { assert.ok(name in mocks, name); return mocks[name]; } });
  return exports;
}
const feedback = { classroomEnvironment: 'Only teacher speech is available.', whatWentWrong: 'No supported errors.', areasToImprove: 'Ask for an example.', topicSpecificFeedback: 'Fractions were introduced.', overallScore: 70 };
const input = { transcript: 'one half plus one half is one. '.repeat(2200), topic: 'Fractions', subject: 'Math', classLevel: '6' };
function setup(responses, credentialError, selectedProvider = 'openai', selectedModel = 'gpt-6-luna') {
  const calls = [];
  const transport = load('src/lib/ai/transport.ts', {
    '@/lib/ai-keys/vault': { getProviderCredential: async (owner, provider) => {
      assert.equal(owner, 'teacher'); assert.equal(provider, selectedProvider);
      if (credentialError) throw Error(credentialError);
      return { apiKey: 'private-test-key', baseUrl: 'https://api.openai.com/v1', model: selectedModel };
    } },
    './cancellation': { registerAiRequest: () => () => {} },
    'expo/fetch': { fetch: async (url, options) => { calls.push({ url, options }); return responses.shift(); } },
  });
  const api = load('src/lib/ai/class-report.ts', {
    '@/lib/ai-keys/vault': { getActiveProvider: async () => selectedProvider },
    './transport': transport,
    '@/lib/prompts/teaching-analysis': load('src/lib/prompts/teaching-analysis.ts'),
    '@/lib/prompts/class-notes': load('src/lib/prompts/class-notes.ts'),
  });
  return { api, calls };
}
const response = (content, finish_reason = 'stop') => Response.json({ choices: [{ finish_reason, message: { content } }] });
test('class report sends the entire transcript twice with legacy prompts and GPT-6 Luna, returns feedback and notes', async () => {
  const { api, calls } = setup([response(JSON.stringify(feedback)), response('## Key Concepts\nFractions\n## Quick Summary\nTwo halves make one.')]);
  const phases = [];
  const result = await api.generateClassReport('teacher', input, new AbortController().signal, (phase) => phases.push(phase));
  assert.deepEqual(phases, ['feedback', 'notes']); assert.equal(result.report.overallScore, 70); assert.match(result.classNotes, /Quick Summary/);
  assert.equal(result.model, 'gpt-6-luna');
  for (const call of calls) {
    assert.equal(call.url, 'https://api.openai.com/v1/chat/completions');
    assert.equal(call.options.headers.Authorization, 'Bearer private-test-key');
    assert.equal(call.options.redirect, 'error');
    const body = JSON.parse(call.options.body);
    assert.equal(body.model, 'gpt-6-luna'); assert.equal(body.reasoning_effort, 'low');
    assert.ok(body.messages[1].content.includes(input.transcript));
    assert.equal('temperature' in body, false); assert.equal(body.messages[1].content.includes('private-test-key'), false);
  }
  assert.equal(JSON.parse(calls[0].options.body).response_format.type, 'json_object');
  assert.match(JSON.parse(calls[1].options.body).messages[1].content, /step-by-step/);
});
test('invalid, truncated, refused and empty provider reports never produce a successful result', async () => {
  for (const value of [response('not JSON'), response(JSON.stringify({ ...feedback, overallScore: 101 })),
    response(JSON.stringify({ ...feedback, whatWentWrong: '' })), response(JSON.stringify(feedback), 'length'),
    Response.json({ choices: [{ finish_reason: 'stop', message: { refusal: 'refused', content: '{}' } }] })]) {
    const { api, calls } = setup([value]);
    await assert.rejects(api.generateClassReport('teacher', input, new AbortController().signal, () => {}), /report/);
    assert.equal(calls.length, 1);
  }
});
test('missing keys and oversized or silent input fail without requests; provider bodies are not exposed', async () => {
  const missing = setup([], 'Save an OpenAI key first.');
  await assert.rejects(missing.api.generateClassReport('teacher', input, new AbortController().signal, () => {}), /Save an OpenAI/);
  assert.equal(missing.calls.length, 0);
  for (const transcript of ['', 'x'.repeat(240001)]) {
    const { api, calls } = setup([]);
    await assert.rejects(api.generateClassReport('teacher', { ...input, transcript }, new AbortController().signal, () => {}), /Nothing was sent/);
    assert.equal(calls.length, 0);
  }
  const failed = setup([new Response('private-test-key transcript', { status: 429 })]);
  await assert.rejects(failed.api.generateClassReport('teacher', input, new AbortController().signal, () => {}), (error) => /quota/.test(error.message) && !/private-test-key/.test(error.message));
});
test('cancellation between stages prevents the next provider call and does not return partial success', async () => {
  const { api, calls } = setup([response(JSON.stringify(feedback))]);
  const controller = new AbortController();
  await assert.rejects(api.generateClassReport('teacher', input, controller.signal, (phase) => { if (phase === 'notes') controller.abort(); }), /cancelled/);
  assert.equal(calls.length, 1);
});
test('notes failure is a failure of the complete report, with no automatic paid retries', async () => {
  const { api, calls } = setup([response(JSON.stringify(feedback)), response('', 'length')]);
  await assert.rejects(api.generateClassReport('teacher', input, new AbortController().signal, () => {}), /did not finish/);
  assert.equal(calls.length, 2);
});


test('reports honor the teacher-selected model instead of hard-coding Luna', async () => {
  const h = setup([response(JSON.stringify(feedback)), response('Class notes')], null, 'openai', 'selected-model');
  const result = await h.api.generateClassReport('teacher', input, new AbortController().signal, () => {});
  assert.equal(result.model, 'selected-model');
  assert.ok(h.calls.every(call => JSON.parse(call.options.body).model === 'selected-model'));
});

test('Gemini and Claude default providers produce both report and notes with their own keys', async () => {
  for (const provider of ['gemini','claude']) {
    const reply = text => Response.json(provider === 'gemini'
      ? {candidates:[{finishReason:'STOP',content:{parts:[{text}]}}]}
      : {stop_reason:'end_turn',content:[{type:'text',text}]});
    const h = setup([reply(JSON.stringify(feedback)),reply('Class notes')],null,provider,'selected-model');
    const result = await h.api.generateClassReport('teacher',input,new AbortController().signal,()=>{});
    assert.equal(result.model,'selected-model'); assert.equal(result.report.overallScore,70);
    assert.equal(h.calls.length,2);
    assert.ok(h.calls.every(call => provider === 'gemini' ? call.url.includes('generativelanguage.googleapis.com') : call.url === 'https://api.anthropic.com/v1/messages'));
  }
});
