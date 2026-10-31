import { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable } from "@/components/feedback/pressable";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { RagWorkspace } from "@/components/rag/rag-workspace";
import { useChatStore } from "@/store/chat-store";
import { useThemeStyles, useThemeColors } from "@/theme/use-theme";
import type { ThemeColors } from "@/theme/colors";
import { shadows } from "@/theme/tokens";
export function NotesUploadScreen(): React.ReactElement {
  const router = useRouter();
  const styles = useThemeStyles(createStyles);
  const colors = useThemeColors();
  const [curriculumVisible, setCurriculumVisible] = useState(false);
  const selections = useChatStore((s) => s.selections);
  const setSelections = useChatStore((s) => s.setSelections);
  return (
    <SafeAreaView style={styles.page} edges={["top"]}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Go back"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.back}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={22}
            color={colors.foreground}
          />
        </Pressable>
        <Text style={styles.title}>Verify Question{`\n`}Paper</Text>
        <Pressable
          accessibilityLabel="Select curriculum"
          accessibilityRole="button"
          onPress={() => setCurriculumVisible(true)}
          style={styles.menu}
        >
          <MaterialCommunityIcons
            name="dots-horizontal"
            size={28}
            color={colors.destructiveForeground}
          />
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        style={styles.link}
        onPress={() => router.push("/notes/generate")}
      >
        <Text style={styles.linkText}>Generate a new paper instead →</Text>
      </Pressable>
      <RagWorkspace
        selections={selections}
        onSelections={setSelections}
        curriculumVisible={curriculumVisible}
        onOpenCurriculum={() => setCurriculumVisible(true)}
        onCloseCurriculum={() => setCurriculumVisible(false)}
      />
    </SafeAreaView>
  );
}
const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: c.cream },
    header: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
      gap: 12,
    },
    back: {
      minHeight: 44,
      minWidth: 44,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: 10,
      backgroundColor: c.card,
    },
    menu: {
      width: 48,
      height: 48,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: 12,
      backgroundColor: c.destructive,
      ...shadows.sm,
    },
    title: { flex: 1, fontSize: 26, fontWeight: "900", color: c.foreground },
    link: { minHeight: 44, paddingHorizontal: 20, justifyContent: "center" },
    linkText: {
      fontSize: 15,
      fontWeight: "700",
      textDecorationLine: "underline",
      color: c.foreground,
    },
  });
