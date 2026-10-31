import {requireAuth} from '@/server/rag/auth';
import {directReview} from '@/server/rag/direct-review';
import {failure} from '@/server/rag/http';
import {MAX_UPLOAD_BYTES,RagError} from '@/server/rag/contracts';
export async function POST(request:Request):Promise<Response>{
 try{
  const {userId}=await requireAuth(request);
  // Read a bounded body before parsing multipart; Content-Length is not trusted.
  const reader=request.body?.getReader();if(!reader)throw new RagError('Select a paper.');
  let size=0;const parts:Uint8Array[]=[];
  try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_UPLOAD_BYTES+65536){await reader.cancel();throw new RagError('Choose a file up to 10 MB.',413)}parts.push(value)}}finally{reader.releaseLock()}
  const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length}
  const form=await new Response(bytes,{headers:{'Content-Type':request.headers.get('content-type')??''}}).formData();
  return Response.json({verification:await directReview(userId,form as unknown as FormData,request.signal)});
 }catch(error){return failure(error)}
}
