const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
test('closing the session during notification permission cannot start microphone capture',async()=>{
  let resolve;const permission=new Promise(r=>resolve=r);let starts=0;
  let session={id:'a'.repeat(21),ownerClerkId:'alice',status:'starting'};
  const exports={};
  const mocks={expo:{isRunningInExpoGo:()=>false,requireOptionalNativeModule:()=>({recordingAvailable:true,startClassRecording:async()=>{starts++;}})},
    'expo-file-system':{File:class{}},'react-native':{Platform:{OS:'android',Version:36},PermissionsAndroid:{request:()=>permission,PERMISSIONS:{POST_NOTIFICATIONS:'notifications'},RESULTS:{GRANTED:'granted'}}}};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/recording/native-capture.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
    {exports,require:name=>mocks[name],setTimeout,clearTimeout,setInterval,clearInterval});
  const capture=exports.createNativeCapture('alice',()=>({getSnapshot:()=>({snapshot:{session}})}));
  const starting=capture.start();session={...session,status:'failed'};resolve('granted');
  await assert.rejects(starting,/cancelled/);assert.equal(starts,0);
});

test('recovery flushes a surviving native writer before reading or finalizing its chunks', async () => {
  const events = []; const exports = {};
  const session = { id: 'a'.repeat(21), ownerClerkId: 'alice', status: 'recording' };
  const native = { recordingAvailable: true,
    stopClassRecording: async (owner, id) => { assert.equal(owner, 'alice'); assert.equal(id, session.id); events.push('stop-and-flush'); },
    classRecordingStatus: async () => { events.push('read-files'); return { active: false, error: null, chunks: [] }; },
  };
  const mocks = { expo: { isRunningInExpoGo: () => false, requireOptionalNativeModule: () => native }, 'expo-file-system': { File: class {} },
    'react-native': { Platform: { OS: 'android' }, PermissionsAndroid: {} } };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/recording/native-capture.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
    { exports, require: name => mocks[name], setInterval, clearInterval, setTimeout: () => {} });
  await exports.createNativeCapture('alice', () => ({ getSnapshot: () => ({ snapshot: { session } }) })).recover();
  assert.deepEqual(events, ['stop-and-flush', 'read-files']);
});
