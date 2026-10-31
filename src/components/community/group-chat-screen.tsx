import { useColorMode, useThemeColors, useThemeStyles } from '@/theme/use-theme';
import type { ThemeColors } from '@/theme/colors';
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { CommunityScreenHeader } from "@/components/community/community-screen-header";
import { GroupChatBubble } from "@/components/community/group-chat-bubble";
import { GroupChatComposer } from "@/components/community/group-chat-composer";
import { useGroupChat } from "@/hooks/use-group-chat";
import { useTeacherDisplayName } from "@/hooks/use-teacher-display-name";
import { spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import { useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useRef, useState } from "react";
import { useAuth } from "@clerk/expo";
import { useCommunity, useCommunityGroup } from "@/hooks/use-community";
import { Pressable } from "@/components/feedback/pressable";
import type { CommunityPostImageDraft, GroupMessage } from "@/types/community";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export function GroupChatScreen(): React.ReactElement {
  const colorMode = useColorMode();
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);

  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const displayName = useTeacherDisplayName();
  const chat = useGroupChat(groupId ?? "");
  const [isSending, setIsSending] = useState(false);
  const { userId } = useAuth();
  const community = useCommunity();
  const detail = useCommunityGroup(groupId ?? "");
  const isOwner = detail.group?.members.some(member => member.clerkId === userId && member.role === "owner");
  const list = useRef<FlatList<GroupMessage>>(null);
  const nearBottom = useRef(true);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleSend = async (body: string, linkUrl?: string, images?: readonly CommunityPostImageDraft[], messageId?: string): Promise<void> => {
    setIsSending(true);

    try {
      await chat.sendMessage({ body, linkUrl, displayName, images, messageId });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <StatusBar style={colorMode === "dark" ? "light" : "dark"} />
      <CommunityScreenHeader title="Group Chat" />
      <KeyboardAvoidingView
        behavior="padding"
        style={styles.flex}
      >
        {chat.error || actionError ? <Text selectable accessibilityRole="alert" style={styles.error}>{actionError ?? chat.error}</Text> : null}
        <FlatList ref={list} data={chat.messages} keyExtractor={message => message.messageId}
          keyboardShouldPersistTaps="handled" contentContainerStyle={styles.messages} contentInsetAdjustmentBehavior="automatic"
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
          onScroll={event => { const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent; nearBottom.current = layoutMeasurement.height + contentOffset.y >= contentSize.height - 100; }}
          onContentSizeChange={() => { if (nearBottom.current) list.current?.scrollToEnd({ animated: false }); }}
          ListHeaderComponent={chat.hasMore ? <Pressable accessibilityRole="button" style={{ minHeight: 44 }} onPress={() => { void chat.loadMore().catch(cause => setActionError(cause instanceof Error ? cause.message : 'Could not load messages.')); }}><Text style={{ color: colors.foreground }}>Load older messages</Text></Pressable> : null}
          ListEmptyComponent={chat.isLoading ? <ActivityIndicator color={colors.foreground} /> : <Text style={{ color: colors.mutedForeground }}>{chat.error ? 'Messages could not be loaded.' : 'Start the conversation with your group.'}</Text>}
          refreshing={chat.isLoading && chat.messages.length > 0} onRefresh={() => void chat.refresh()}
          renderItem={({ item }) => <GroupChatBubble message={item} onDelete={item.authorClerkId === userId || isOwner ? async () => { await community.deleteMessage(groupId, item.messageId); await chat.refresh(); } : undefined} />} />
        <GroupChatComposer groupId={groupId ?? ""} isSending={isSending} onSend={handleSend} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
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
