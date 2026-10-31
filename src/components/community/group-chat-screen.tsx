import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { CommunityScreenHeader } from "@/components/community/community-screen-header";
import { GroupChatBubble } from "@/components/community/group-chat-bubble";
import { GroupChatComposer } from "@/components/community/group-chat-composer";
import { useGroupChat } from "@/hooks/use-group-chat";
import { useTeacherDisplayName } from "@/hooks/use-teacher-display-name";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import { useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export function GroupChatScreen(): React.ReactElement {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const displayName = useTeacherDisplayName();
  const chat = useGroupChat(groupId ?? "");
  const [isSending, setIsSending] = useState(false);

  const handleSend = async (body: string, linkUrl?: string): Promise<void> => {
    setIsSending(true);

    try {
      await chat.sendMessage({ body, linkUrl, displayName });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <StatusBar style="dark" />
      <CommunityScreenHeader title="Group Chat" />
      <KeyboardAvoidingView
        behavior="padding"
        style={styles.flex}
      >
        {chat.isLoading && chat.messages.length === 0 ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.foreground} size="small" />
          </View>
        ) : null}

        {chat.error ? (
          <Text style={styles.error}>{chat.error}</Text>
        ) : null}

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.messages}
          showsVerticalScrollIndicator={false}
        >
          {chat.messages.map((message) => (
            <GroupChatBubble key={message.messageId} message={message} />
          ))}
        </ScrollView>

        {chat.error ? null : <GroupChatComposer groupId={groupId ?? ""} isSending={isSending} onSend={handleSend} />}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  error: {
    color: colors.destructive,
    fontFamily: fontFamilies.sans,
    fontSize: 14,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    textAlign: "center",
  },
  flex: {
    flex: 1,
  },
  loading: {
    alignItems: "center",
    paddingVertical: spacing.lg,
  },
  messages: {
    flexGrow: 1,
    padding: spacing.lg,
    paddingBottom: spacing.md,
  },
  safeArea: {
    backgroundColor: colors.cream,
    flex: 1,
  },
});
