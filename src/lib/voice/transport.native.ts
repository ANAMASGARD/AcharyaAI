import { mediaDevices, RTCPeerConnection, RTCSessionDescription } from 'react-native-webrtc';
import type { MediaStream } from 'react-native-webrtc';
import type { VoiceEvent,VoiceTransport } from './transport';
export function createVoiceTransport(event:(e:VoiceEvent)=>void,opened:()=>void,lost:()=>void):VoiceTransport {
 const pc=new RTCPeerConnection({});
 let stream:MediaStream|null=null;
 let closed=false;let playbackEnabled=true;
 const channel=pc.createDataChannel('oai-events');
 channel.addEventListener('open',()=>{if(!closed)opened();});
 channel.addEventListener('message',e=>{if(closed)return;try{event(JSON.parse(String(e.data)) as VoiceEvent);}catch{/* Ignore malformed transport messages. */}});
 pc.addEventListener('track',e=>{if(e.track)e.track.enabled=playbackEnabled;});
 pc.addEventListener('connectionstatechange',()=>{if(!closed&&['failed','disconnected','closed'].includes(pc.connectionState))lost();});
 return {
  async offer(){
   stream=await mediaDevices.getUserMedia({audio:true,video:false});
   if(closed){stream.getTracks().forEach(t=>t.stop());stream.release();throw new Error('Voice connection cancelled.');}
   stream.getTracks().forEach(t=>{pc.addTrack(t,stream!);t.addEventListener('ended',()=>{if(!closed)lost();});});
   const offer=await pc.createOffer({});await pc.setLocalDescription(offer);
   if(!offer.sdp)throw new Error('Could not create the audio connection.');return offer.sdp;
  },
  async answer(sdp){if(closed)throw new Error('Voice connection cancelled.');await pc.setRemoteDescription(new RTCSessionDescription({type:'answer',sdp}));},
  send(data){if(channel.readyState!=='open')throw new Error('Voice is not connected yet.');channel.send(JSON.stringify(data));},
  mute(muted){stream?.getAudioTracks().forEach(t=>{t.enabled=!muted;});},
  playback(enabled){playbackEnabled=enabled;pc.getReceivers().forEach(r=>{if(r.track)r.track.enabled=enabled;});},
  close(){if(closed)return;closed=true;stream?.getTracks().forEach(t=>t.stop());stream?.release();channel.close();pc.close();},
 };
}
