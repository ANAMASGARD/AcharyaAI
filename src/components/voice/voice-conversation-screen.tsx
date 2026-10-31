import { ScrollView,StyleSheet,Text,View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack,useRouter } from 'expo-router';
import { MascotPulse } from '@/components/chat/chat-loading-indicator';
import { Pressable } from '@/components/feedback/pressable';
import { useVoiceConversation } from '@/hooks/use-voice-conversation';
import { useThemeColors } from '@/theme/use-theme';
export function VoiceConversationScreen(){
 const voice=useVoiceConversation();const router=useRouter();const colors=useThemeColors();
 const connected=['listening','speaking','practising','muted','paused'].includes(voice.state);
 const label=voice.paused?'Conversation paused':voice.state==='practising'?'Listening to your lesson':voice.state==='speaking'?'Acharya is speaking':voice.state==='muted'?'Microphone muted':voice.state==='listening'?'Listening…':voice.state==='connecting'?'Connecting…':voice.state==='ending'?'Ending call…':voice.state==='error'?'Unable to connect':'Call ended';
 const button=(title:string,onPress:()=>void,disabled=false,bg=colors.mint)=><Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.button,{backgroundColor:bg,opacity:disabled?0.45:1}]}><Text style={styles.buttonText}>{title}</Text></Pressable>;
 return <SafeAreaView style={[styles.root,{backgroundColor:colors.cream}]}>
  <Stack.Screen options={{headerShown:false,gestureEnabled:false}} />
  <View style={styles.header}><Text style={[styles.title,{color:colors.foreground}]}>Talk to Acharya</Text>{button('Close',()=>{void voice.end().finally(()=>router.back());},false,colors.coral)}</View>
  <ScrollView contentContainerStyle={styles.content}>
   <Text style={[styles.sub,{color:colors.mutedForeground}]}>Your AI teaching companion</Text>
   <View style={styles.orb}><MascotPulse size={150} active={!voice.paused && (connected || voice.state==='connecting')} label="Acharya voice companion" /></View>
   <Text accessibilityLiveRegion="polite" style={[styles.status,{color:colors.foreground}]}>{label}</Text>
   <Text style={{color:colors.mutedForeground}}>{Math.floor(voice.remaining/60)}:{String(voice.remaining%60).padStart(2,'0')} remaining</Text>
   {voice.remaining<=60&&connected?<Text style={{color:colors.foreground}}>This session ends in one minute or less.</Text>:null}
   {voice.caption?<View style={[styles.caption,{backgroundColor:colors.card}]}><Text selectable style={{color:colors.foreground,fontSize:17,lineHeight:26}}>{voice.caption}</Text></View>:null}
   {voice.error?<Text accessibilityRole="alert" style={{color:colors.foreground,textAlign:'center'}}>{voice.error}</Text>:null}
   <View style={styles.row}>{button(voice.muted?'Unmute':'Mute',()=>voice.action('mute'),!connected||voice.paused)}{button(voice.paused?'Resume':'Pause',()=>voice.action('pause'),!connected,colors.sky)}{button('End call',()=>{void voice.end();},!connected,colors.coral)}</View>
   {connected?button(voice.practising?'Return to conversation':'Practise teaching',()=>voice.action('practice'),voice.paused,colors.primary):null}
   {voice.practising?<><Text style={{color:colors.mutedForeground,textAlign:'center'}}>Teach at your own pace. Acharya will wait while you explain.</Text><View style={styles.row}>{button('Ask the student',()=>voice.action('student'),!connected||voice.paused)}{button('Finish & get feedback',()=>voice.action('feedback'),!connected||voice.paused,colors.primary)}</View></>:null}
   {['ended','error'].includes(voice.state)?button('Reconnect',voice.reconnect):null}
   <Text style={[styles.sub,{color:colors.mutedForeground}]}>Audio is sent to OpenAI. Captions and feedback are saved privately in this chat; recordings are not retained by Acharya.</Text>
  </ScrollView>
 </SafeAreaView>;
}
const styles=StyleSheet.create({root:{flex:1},header:{padding:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},title:{fontSize:23,fontWeight:'900',flex:1},content:{flexGrow:1,justifyContent:'center',padding:24,gap:22,alignItems:'center',paddingBottom:40},sub:{fontSize:13,lineHeight:20,textAlign:'center'},orb:{height:240,width:240,alignItems:'center',justifyContent:'center',marginVertical:16},status:{fontSize:23,fontWeight:'800',textAlign:'center'},row:{flexDirection:'row',flexWrap:'wrap',gap:12,justifyContent:'center'},button:{borderWidth:2,borderColor:'#1A1A1A',borderRadius:12,paddingHorizontal:16,paddingVertical:14,minHeight:48,justifyContent:'center'},buttonText:{color:'#1A1A1A',fontWeight:'800',fontSize:14},caption:{borderWidth:2,borderColor:'#1A1A1A',borderRadius:16,padding:18,width:'100%'}});
