export type VoiceEvent = {type:string;item_id?:string;transcript?:string;delta?:string;response?:{status?:string;usage?:Record<string,unknown>};error?:{message?:string;code?:string}};
export interface VoiceTransport {offer():Promise<string>;answer(sdp:string):Promise<void>;send(event:Record<string,unknown>):void;mute(muted:boolean):void;playback(enabled:boolean):void;close():void;}
export function createVoiceTransport(_event:(e:VoiceEvent)=>void,_open:()=>void,_lost:()=>void):VoiceTransport {
 throw new Error('Live voice requires the new Android or iOS app build.');
}
