const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');
function load(overrides){const m={exports:{}};const code=ts.transpileModule(fs.readFileSync('src/server/rag/auth.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;new Function('require','module','exports',code)(n=>overrides[n]??require(n),m,m.exports);return m.exports;}
test('RAG delegates to pinned Clerk auth and maps failures without accepting client ownership',async()=>{
 const auth=load({'../db/auth':{requireClerkUserId:async req=>req.headers.has('Authorization')?{ok:true,clerkUserId:'user_verified'}:{ok:false,response:Response.json({error:'Unauthorized'},{status:401})}}});
 await assert.rejects(auth.requireAuth(new Request('https://test/?owner=user_other')),e=>e.status===401 && e.name==='ApiAuthError');
 assert.deepEqual(await auth.requireAuth(new Request('https://test/',{headers:{Authorization:'Bearer verified'}})),{userId:'user_verified'});
});
