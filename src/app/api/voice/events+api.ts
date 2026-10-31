import { voiceBody } from "@/server/voice/body";
import { requireAuth } from '@/server/rag/auth';
import { failure } from '@/server/rag/http';
import { eventsSchema,saveVoiceEvents } from '@/server/voice/sessions';
export async function POST(r:Request){try{const {userId}=await requireAuth(r);return Response.json(await saveVoiceEvents(userId,eventsSchema.parse(await voiceBody(r))));}catch(e){return failure(e);}}
