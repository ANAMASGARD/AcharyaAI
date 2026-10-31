import { RagError } from '../rag/contracts';
export async function voiceBody(request:Request):Promise<unknown>{
 const reader=request.body?.getReader();if(!reader)throw new RagError('Request body required.');
 const chunks:Uint8Array[]=[];let length=0;
 try{while(true){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>262144){await reader.cancel();throw new RagError('Voice request is too large.',413);}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw new RagError('Invalid voice request.');}
}
