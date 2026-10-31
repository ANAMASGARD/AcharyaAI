/* global __dirname */
const fs=require('node:fs');
const path=require('node:path');
const {neon}=require('@neondatabase/serverless');
const root=path.resolve(__dirname,'..');
process.loadEnvFile(path.join(root,'.env'));
const url=process.env.RAG_DATABASE_URL||process.env.DATABASE_URL;
if(!url)throw new Error('Configure DATABASE_URL in the target checkout.');
const sql=neon(url);
const statements=fs.readFileSync(path.join(root,'docs/rag-schema/0006_voice_sessions.sql'),'utf8').split(';').map(s=>s.trim()).filter(Boolean);
sql.transaction(statements.map(s=>sql.query(s))).then(()=>console.log('Applied additive voice-session migration.')).catch(()=>{console.error('Voice migration failed; no credentials were logged.');process.exitCode=1;});
