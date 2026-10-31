import { useCallback,useEffect,useRef,useState } from 'react';
import { useAuth } from '@clerk/expo';
import { AppState } from 'react-native';
import { setAudioModeAsync } from 'expo-audio';
import { fetch } from 'expo/fetch';
import { createVoiceTransport,type VoiceEvent,type VoiceTransport } from '@/lib/voice/transport';
import { getRagApiOrigin } from '@/lib/rag-api-origin';
import { createId } from '@/lib/id';
import { isRecorderMicrophoneActive,setRecorderMicrophoneActive } from '@/lib/recording/audio-focus';
import { useChatStore } from '@/store/chat-store';

type State='connecting'|'listening'|'speaking'|'practising'|'muted'|'paused'|'ending'|'ended'|'error';
type Turn={itemId:string;role:'user'|'assistant';text:string;interrupted:boolean};
type Session={id:string;conversationId:string;sdp:string;expiresAt:string};
export function useVoiceConversation(){
 const {getToken,userId,isLoaded}=useAuth();
 // Clerk Expo wraps getToken on every render. Keep credentials current without
 // tearing down the microphone/session whenever captions or status change.
 const getTokenRef=useRef(getToken);
 useEffect(()=>{getTokenRef.current=getToken;},[getToken]);
 const [state,setState]=useState<State>('ended');const [error,setError]=useState<string|null>(null);
 const [caption,setCaption]=useState('');const [remaining,setRemaining]=useState(600);
 const [paused,setPaused]=useState(false);const [muted,setMuted]=useState(false);const [practising,setPractising]=useState(false);
 const stopRef=useRef<()=>Promise<void>>(async()=>{});
 const actionRef=useRef<(action:'mute'|'pause'|'practice'|'student'|'feedback')=>void>(()=>{});
 const restartRef=useRef<()=>void>(()=>{});
 useEffect(()=>{
  if(!isLoaded)return;
  let disposed=false;let connected=false;let active=false;let generation=0;let transport:VoiceTransport|undefined;
  let session:Session|undefined;let savedToken:string|null=null;let busy=false;let microphone=false;
  let askingPermission=false;let responding=false;let playing=false;let pausedNow=false;let practice=false;let silent=false;let greeting=false;let feedback=false;
  let timer:ReturnType<typeof setInterval>|undefined;let saveTimer:ReturnType<typeof setInterval>|undefined;
  let connectTimer:ReturnType<typeof setTimeout>|undefined;
  const pending=new Map<string,Turn>();const assistant=new Map<string,string>();
  let saving:Promise<void>|undefined;
  let stopping:Promise<void>|undefined;
  async function api<T>(path:string,method:string,body?:unknown):Promise<T>{
   const token=!disposed?await getTokenRef.current({skipCache:true}):savedToken;
   if(!token)throw new Error('Sign in to use voice.');savedToken=token;
   const response=await fetch(getRagApiOrigin()+path,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
   const data=await response.json();if(!response.ok)throw new Error(data.error||'Voice request failed.');return data as T;
  }
  const idle=()=>pausedNow?'paused':silent?'muted':practice?'practising':'listening';
  async function flush():Promise<void>{
   if(saving)return saving;
   if(!session||!pending.size)return;
   const items=[...pending.values()].slice(0,20);const id=session.id;
   saving=(async()=>{
    await api('/api/voice/events','POST',{id,items});
    items.forEach(item=>{if(pending.get(item.itemId)===item)pending.delete(item.itemId);});
   })();
   try{await saving;}finally{saving=undefined;}
  }
  function release(){
   active=false;clearInterval(timer);clearInterval(saveTimer);clearTimeout(connectTimer);
   transport?.close();transport=undefined;
   if(microphone){microphone=false;setRecorderMicrophoneActive(false);void setAudioModeAsync({allowsRecording:false,playsInSilentMode:false,shouldPlayInBackground:false,interruptionMode:'mixWithOthers'}).catch(()=>{});}
  }
  function finalizeAssistant(interrupted:boolean){
   assistant.forEach((text,itemId)=>pending.set(itemId,{itemId,role:'assistant',text:interrupted?'[Acharya was interrupted; the response was not fully heard.]':text,interrupted}));assistant.clear();
  }
  function stop():Promise<void>{if(stopping)return stopping;stopping=stopRun().finally(()=>{stopping=undefined;});return stopping;}
  async function stopRun(){
   ++generation;finalizeAssistant(true);release();
   if(!disposed)setState('ending');
   try{
    while(pending.size&&session)await flush();
   }catch{if(!disposed)setError('Some captions have not saved. Keep this screen open and retry ending the call.');}
   try{if(session)await api('/api/voice/sessions?id='+session.id,'DELETE');if(!disposed)setState('ended');}
   catch(e){if(!disposed){setError(e instanceof Error?e.message:'Could not end the server call.');setState('error');}}
   if(!disposed)useChatStore.setState({lastFetchedAt:null});
  }
  function send(event:Record<string,unknown>){transport?.send(event);}
  function detection(enabled:boolean){send({type:'session.update',session:{type:'realtime',audio:{input:{turn_detection:{type:'semantic_vad',eagerness:'low',create_response:enabled,interrupt_response:true}}}}});}
  function onEvent(e:VoiceEvent){
   if(disposed||!active)return;
   if(e.type==='session.created'&&!greeting){greeting=true;send({type:'response.create',response:{instructions:'Say exactly: Hello, I am Acharya AI. How can I help you?'}});}
   if(e.type==='input_audio_buffer.speech_started'){setState(idle());}
   if(e.type==='conversation.item.input_audio_transcription.completed'&&e.item_id&&e.transcript){pending.set(e.item_id,{itemId:e.item_id,role:'user',text:e.transcript,interrupted:false});setCaption(e.transcript);}
   if(e.type==='response.output_audio_transcript.delta'&&e.item_id){const text=(assistant.get(e.item_id)||'')+(e.delta||'');assistant.set(e.item_id,text);setCaption(text);}
   if(e.type==='response.output_audio_transcript.done'&&e.item_id&&e.transcript)assistant.set(e.item_id,e.transcript);
   if(e.type==='response.created')responding=true;
   if(e.type==='response.done')responding=false;
   if(e.type==='output_audio_buffer.started'){playing=true;setState('speaking');}
   if(e.type==='output_audio_buffer.cleared'){playing=false;finalizeAssistant(true);setState(idle());}
   if(e.type==='output_audio_buffer.stopped'){playing=false;
    finalizeAssistant(false);
    if(feedback){feedback=false;practice=false;setPractising(false);detection(true);}
    setState(idle());void flush().catch(()=>setError('Captions will retry saving while this screen stays open.'));
   }
   if(e.type==='error'&&['response_cancel_not_active','input_audio_buffer_commit_empty'].includes(e.error?.code||''))return;
   if(e.type==='error'){setError('The voice response could not complete. Please reconnect.');void stop();}
  }
  async function start(){
   if(busy||disposed)return;
   if(isRecorderMicrophoneActive()){setError('Stop the recorder or dictation before starting live voice.');setState('error');return;}
   busy=true;if(stopping)await stopping;connected=false;const run=++generation;setError(null);setState('connecting');setCaption('');setRemaining(600);greeting=false;practice=false;silent=false;pausedNow=false;setPaused(false);feedback=false;setMuted(false);setPractising(false);
   try{
    if(!userId)throw new Error('Sign in to start voice.');
    if(pending.size&&session){while(pending.size)await flush();}
    // An explicit reconnect also closes a leftover server call from a previous app run.
    const previous=await api<{session:{id:string}|null}>('/api/voice/sessions','GET');
    if(previous.session)await api('/api/voice/sessions?id='+previous.session.id,'DELETE');
    if(disposed||run!==generation)return;
    setRecorderMicrophoneActive(true);microphone=true;
    await setAudioModeAsync({allowsRecording:true,shouldRouteThroughEarpiece:false,playsInSilentMode:true,shouldPlayInBackground:false,allowsBackgroundRecording:false,interruptionMode:'doNotMix'});
    active=true;
    transport=createVoiceTransport(onEvent,()=>{if(!disposed&&active){connected=true;clearTimeout(connectTimer);setState('listening');}},()=>{if(!disposed&&active){setError('Connection lost. Tap Reconnect to start again.');void stop();}});
    askingPermission=true;
    const sdp=await transport.offer();
    askingPermission=false;
    if(disposed||run!==generation){release();return;}
    const chat=useChatStore.getState();
    const result=await api<Session>('/api/voice/sessions','POST',{sdp,requestId:createId(),conversationId:chat.conversationId||undefined,verificationId:chat.verificationId||undefined,selections:chat.selections});
    session=result;
    if(disposed||run!==generation){await api('/api/voice/sessions?id='+result.id,'DELETE');release();return;}
    useChatStore.getState().setConversationId(result.conversationId);
    await transport.answer(result.sdp);
    connectTimer=setTimeout(()=>{if(active&&!connected){setError('Voice connection timed out. Tap Reconnect.');void stop();}},20000);
    timer=setInterval(()=>{const left=Math.max(0,Math.ceil((Date.parse(result.expiresAt)-Date.now())/1000));if(!disposed)setRemaining(left);if(left===0)void stop();},1000);
    saveTimer=setInterval(()=>{void flush().catch(()=>{if(!disposed)setError('Captions have not saved yet. Retrying…');});},4000);
   }catch(e){release();if(session)try{await api('/api/voice/sessions?id='+session.id,'DELETE');}catch{/* Explicit reconnect retries cleanup. */}if(!disposed){setError(e instanceof Error?e.message:'Could not start voice.');setState('error');}}
   finally{askingPermission=false;busy=false;}
  }
  actionRef.current=action=>{
   if(!active||!transport)return;
   try{
    if(action==='pause'){pausedNow=!pausedNow;setPaused(pausedNow);transport.mute(pausedNow||silent);transport.playback(!pausedNow);detection(!pausedNow&&!practice);if(pausedNow){if(responding)send({type:'response.cancel'});if(playing)send({type:'output_audio_buffer.clear'});finalizeAssistant(true);}setState(idle());return;}
    if(pausedNow)return;
    if(action==='mute'){silent=!silent;transport.mute(silent);setMuted(silent);setState(idle());return;}
    if(responding)send({type:'response.cancel'});if(playing)send({type:'output_audio_buffer.clear'});finalizeAssistant(true);
    if(action==='practice'){practice=!practice;setPractising(practice);detection(!practice);setState(idle());return;}
    detection(false);
    send({type:'input_audio_buffer.commit'});
    feedback=action==='feedback';
    send({type:'response.create',response:{instructions:feedback?'The teacher has finished the demonstration. Give brief feedback grounded only in what you heard: two specific strengths and two actionable improvements. Do not invent observations or assign scores.':'Act as a student at the selected grade and answer the teacher’s most recent question briefly. Do not give coaching feedback yet.'}});
   }catch{setError('Wait for the voice connection, then try again.');}
  };
  stopRef.current=stop;restartRef.current=()=>{void start();};
  const sub=AppState.addEventListener('change',s=>{if(s!=='active'&&!askingPermission)void stop();});
  void start();
  return ()=>{disposed=true;sub.remove();void stop();};
 },[isLoaded,userId]);
 return {state,error,caption,remaining,muted,paused,practising,end:useCallback(()=>stopRef.current(),[]),reconnect:()=>restartRef.current(),action:(a:'mute'|'pause'|'practice'|'student'|'feedback')=>actionRef.current(a)};
}
