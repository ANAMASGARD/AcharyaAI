import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, StyleSheet, Text, View } from "react-native";
import { paperReviewSummary } from "@/lib/paper-review-summary";
import type { Verification } from "@/types/rag";
import { useThemeStyles } from "@/theme/use-theme";
import type { ThemeColors } from "@/theme/colors";
import { shadows } from "@/theme/tokens";

export function PaperScoreCard({ report }: { report: Verification }) {
  const styles = useThemeStyles(createStyles);
  const summary = paperReviewSummary(report);
  const score = summary.alignmentScore;
  const [entrance] = useState(() => new Animated.Value(1));
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(reduced => {
      if (!active || reduced) return;
      entrance.setValue(0);
      Animated.timing(entrance, {toValue: 1, duration: 450, useNativeDriver: true}).start();
    });
    return () => { active = false; entrance.stopAnimation(); };
  }, [entrance, report.id]);
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>YOUR PAPER AT A GLANCE</Text>
      <Text style={styles.title}>{report.status === "completed" ? "Curriculum fit" : "Reviewing your paper…"}</Text>
      <Animated.View style={[styles.ring, {opacity: entrance, transform: [{scale: entrance.interpolate({inputRange:[0,1],outputRange:[0.9,1]})}]}]} accessibilityRole="progressbar"
        accessibilityLabel="Estimated curriculum alignment"
        accessibilityValue={score === null ? {text:"Review needed"} : {min:0,max:100,now:score}}>
        {Array.from({length:72},(_,i)=>{
          const angle=i*5*Math.PI/180;
          return <View key={i} accessible={false} style={[styles.tick,{
            left:94+82*Math.sin(angle)-3,
            top:94-82*Math.cos(angle)-8,
            transform:[{rotate:`${i*5}deg`}],
            backgroundColor:score!==null&&i<Math.round(score*72/100)?"#15803D":"#E6D9A1",
          }]} />;
        })}
        <View style={styles.center}>
          <Text style={styles.score}>{score === null ? "—" : `${score}%`}</Text>
          <Text style={styles.label}>{score === null ? "Needs review" : "alignment estimate"}</Text>
        </View>
      </Animated.View>
      <Text style={styles.caption}>{summary.reviewed} of {summary.total || "…"} questions reviewed</Text>
      <View style={styles.row}>
        {[[summary.aligned,"Aligned","#B8E5E1"],[summary.partial,"Partial","#A8D5E5"],
          [summary.outside,"Outside scope","#FFB5A7"],[summary.needsReview,"Review","#E0D4F7"]].map(([n,label,color])=>(
          <View key={label} style={[styles.stat,{backgroundColor:String(color)}]}>
            <Text style={styles.number}>{n}</Text><Text style={styles.label}>{label}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.caption}>{summary.aligned + summary.partial} questions connect to your selected books.</Text>
      {summary.needsReview>0&&score!==null?<Text style={styles.caption}>Score covers {summary.reviewed-summary.needsReview} assessed questions.</Text>:null}
      {summary.clarityScore!==null?<Text style={styles.caption}>Question clarity · {summary.clarityScore}/100</Text>:null}
    </View>
  );
}
const createStyles = (c: ThemeColors) => StyleSheet.create({
  card:{backgroundColor:c.primary,padding:20,gap:14,borderColor:c.border,borderWidth:3,borderRadius:16,...shadows.md},
  eyebrow:{fontSize:11,fontWeight:"800",letterSpacing:2,color:c.onAccent},
  title:{fontSize:28,fontWeight:"900",color:c.onAccent},
  ring:{width:188,height:188,alignSelf:"center",position:"relative"},
  tick:{position:"absolute",width:6,height:16,borderRadius:3},
  center:{position:"absolute",inset:28,alignItems:"center",justifyContent:"center",gap:4},
  score:{fontSize:44,fontWeight:"900",color:c.onAccent},
  label:{fontSize:11,fontWeight:"700",color:c.onAccent,textAlign:"center"},
  caption:{fontSize:13,lineHeight:19,color:c.onAccent,textAlign:"center"},
  row:{flexDirection:"row",flexWrap:"wrap",gap:8},
  stat:{padding:10,borderWidth:2,borderColor:c.onAccent,borderRadius:8,minWidth:60,flexGrow:1,alignItems:"center"},
  number:{fontSize:24,fontWeight:"900",color:c.onAccent},
});
