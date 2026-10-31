import { voiceBody } from "@/server/voice/body";
import { z } from 'zod';
import { requireAuth } from '@/server/rag/auth';
import { failure } from '@/server/rag/http';
import { activeVoice,endVoice,startVoice,startSchema } from '@/server/voice/sessions';
export async function GET(r:Request){try{const {userId}=await requireAuth(r);return Response.json({session:await activeVoice(userId)});}catch(e){return failure(e);}}
export async function POST(r:Request){try{const {userId}=await requireAuth(r);return Response.json(await startVoice(userId,startSchema.parse(await voiceBody(r)),r.signal));}catch(e){return failure(e);}}
export async function DELETE(r:Request){try{const {userId}=await requireAuth(r);const id=z.string().length(21).parse(new URL(r.url).searchParams.get('id'));await endVoice(userId,id);return Response.json({ok:true});}catch(e){return failure(e);}}
