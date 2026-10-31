import { Pressable } from '@/components/feedback/pressable';
import { ChatHistorySearch } from '@/components/chat/chat-history-search';
import { useThemeColors, useThemeStyles } from '@/theme/use-theme';
import type { ThemeColors } from '@/theme/colors';
import { ChatDeleteConfirmDialog } from "@/components/chat/chat-delete-confirm-dialog";
import { ChatEditTitleDialog } from "@/components/chat/chat-edit-title-dialog";
import { ChatHistoryCard } from "@/components/chat/chat-history-card";
import { borderWidths, radii, shadows, spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import type { ChatConversationSummary } from "@/types/chat";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { AcharyaBlurView as BlurView } from "@/components/ui/acharya-blur";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  useWindowDimensions,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const BLUR_INTENSITY = Platform.OS === "android" ? 42 : 36;

const SPRING_CONFIG = {
  damping: 24,
  mass: 0.85,
  stiffness: 320,
};

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

type Props = Readonly<{
  visible: boolean;
  conversations: ChatConversationSummary[];
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
  onSelectConversation: (conversationId: string) => void;
  onDeleteConversation: (conversationId: string) => Promise<void>;
  onRenameConversation: (conversationId: string, title: string) => Promise<void>;
  onNewChat: () => void;
}>;

export function ChatHistoryDrawer({
  visible,
  conversations,
  isLoading,
  error,
  onClose,
  onSelectConversation,
  onDeleteConversation,
  onRenameConversation,
  onNewChat,
}: Props): React.ReactElement | null {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);

  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const drawerWidth = Math.min(width * 0.84, 340);
  const [mounted, setMounted] = useState(visible);
  const [pendingDelete, setPendingDelete] =
    useState<ChatConversationSummary | null>(null);
  const [pendingEdit, setPendingEdit] = useState<ChatConversationSummary | null>(
    null,
  );
  const [searchOpen, setSearchOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);

  const translateX = useSharedValue(-drawerWidth);
  const backdropProgress = useSharedValue(0);

  const finishClose = (): void => {
    setMounted(false);
    setSearchOpen(false);
    Keyboard.dismiss();
    setPendingDelete(null);
    setPendingEdit(null);
    setIsDeleting(false);
    setIsRenaming(false);
  };

  if (visible && !mounted) {
    setMounted(true);
  }

  useEffect(() => {
    if (visible) {
      backdropProgress.value = withTiming(1, {
        duration: 260,
        easing: Easing.out(Easing.cubic),
      });
      translateX.value = withSpring(0, SPRING_CONFIG);
      return;
    }

    if (!mounted) {
      return;
    }

    backdropProgress.value = withTiming(0, {
      duration: 220,
      easing: Easing.in(Easing.cubic),
    });
    translateX.value = withTiming(
      -drawerWidth,
      {
        duration: 240,
        easing: Easing.in(Easing.cubic),
      },
      (finished) => {
        if (finished) {
          runOnJS(finishClose)();
        }
      },
    );
  }, [backdropProgress, drawerWidth, mounted, translateX, visible]);

  const drawerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backdropProgress.value,
  }));

  const blurAnimatedProps = useAnimatedProps(() => ({
    intensity: backdropProgress.value * BLUR_INTENSITY,
  }));

  const handleSelect = (conversation: ChatConversationSummary): void => {
    onSelectConversation(conversation.conversationId);
    onClose();
  };

  const handleDeletePress = (conversation: ChatConversationSummary): void => {
    setPendingEdit(null);
    setPendingDelete(conversation);
  };

  const handleEditPress = (conversation: ChatConversationSummary): void => {
    setPendingDelete(null);
    setPendingEdit(conversation);
  };

  const handleCancelDelete = (): void => {
    if (isDeleting) {
      return;
    }

    setPendingDelete(null);
  };

  const handleConfirmDelete = (): void => {
    if (!pendingDelete || isDeleting) {
      return;
    }

    setIsDeleting(true);
    void onDeleteConversation(pendingDelete.conversationId)
      .then(() => {
        setPendingDelete(null);
      })
      .finally(() => {
        setIsDeleting(false);
      });
  };

  const handleCancelEdit = (): void => {
    if (isRenaming) {
      return;
    }

    setPendingEdit(null);
  };

  const handleSaveEdit = (title: string): void => {
    if (!pendingEdit || isRenaming) {
      return;
    }

    setIsRenaming(true);
    void onRenameConversation(pendingEdit.conversationId, title)
      .then(() => {
        setPendingEdit(null);
      })
      .catch(() => {
        // Error surfaced via hook state
      })
      .finally(() => {
        setIsRenaming(false);
      });
  };

  if (!mounted) {
    return null;
  }

  return (
    <Modal
      onRequestClose={() => {
        if (pendingEdit) handleCancelEdit();
        else if (pendingDelete) handleCancelDelete();
        else if (searchOpen) { Keyboard.dismiss(); setSearchOpen(false); }
        else onClose();
      }}
      animationType="none"
      statusBarTranslucent
      transparent
      visible={mounted}
    >
      <View style={styles.overlay}>
        <Animated.View
          pointerEvents="box-none"
          style={[styles.backdropWrap, backdropAnimatedStyle]}
        >
          <AnimatedBlurView
            animatedProps={blurAnimatedProps}
            intensity={BLUR_INTENSITY}
            style={StyleSheet.absoluteFill}
            tint="dark"
          />
          <View style={styles.backdropTint} />
          <Pressable
            accessibilityLabel="Close history"
            onPress={onClose}
            soundFeedback={false}
            style={styles.backdropPressable}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.drawer,
            drawerAnimatedStyle,
            { width: drawerWidth },
          ]}
        >
          <View style={styles.drawerShell}>
            <View
              style={[
                styles.drawerHeader,
                { paddingTop: insets.top + spacing.sm },
              ]}
            >
              <Text style={[styles.drawerTitle, { color: colors.onAccent }]}>Chat History</Text>
              <Pressable
                accessibilityLabel="Close drawer"
                onPress={onClose}
                style={({ pressed }) => [
                  styles.closeButton,
                  pressed && styles.pressed,
                ]}
              >
                <MaterialCommunityIcons
                  color={colors.foreground}
                  name="close"
                  size={20}
                />
              </Pressable>
            </View>

            <View
              style={[
                styles.drawerBody,
                { paddingBottom: Math.max(insets.bottom, spacing.md) },
              ]}
            >
              {searchOpen ? <ChatHistorySearch onClose={() => setSearchOpen(false)} /> : <>
              <View style={styles.actionsRow}>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  onNewChat();
                  onClose();
                }}
                style={({ pressed }) => [
                  styles.newChatButton,
                  pressed && styles.pressed,
                ]}
              >
                <MaterialCommunityIcons
                  color={colors.onAccent}
                  name="plus"
                  size={18}
                />
                <Text style={[styles.newChatLabel, { color: colors.onAccent }]}>New Chat</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Search chats"
                onPress={() => setSearchOpen(true)}
                style={({ pressed }) => [styles.searchButton, pressed && styles.pressed]}
              >
                <MaterialCommunityIcons name="magnify" size={26} color={colors.onAccent} />
              </Pressable>
              </View>

              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Chat History</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{conversations.length}</Text>
                </View>
              </View>

              {isLoading && conversations.length === 0 ? (
                <ActivityIndicator color={colors.foreground} style={styles.loader} />
              ) : null}

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <ScrollView
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                style={styles.list}
              >
                {conversations.map((conversation) => (
                  <ChatHistoryCard
                    conversation={conversation}
                    key={conversation.conversationId}
                    onDelete={() => {
                      handleDeletePress(conversation);
                    }}
                    onEdit={() => {
                      handleEditPress(conversation);
                    }}
                    onPress={() => {
                      handleSelect(conversation);
                    }}
                  />
                ))}

                {!isLoading && conversations.length === 0 ? (
                  <Text style={styles.emptyText}>
                    No chats yet. Go to the chat screen and tap + New Chat to
                    start your first conversation.
                  </Text>
                ) : null}
              </ScrollView>
              </>}
            </View>
          </View>
        </Animated.View>

        <ChatDeleteConfirmDialog
          chatTitle={pendingDelete?.title}
          isDeleting={isDeleting}
          visible={pendingDelete !== null}
          onCancel={handleCancelDelete}
          onConfirm={handleConfirmDelete}
        />

        <ChatEditTitleDialog
          initialTitle={pendingEdit?.title ?? ""}
          isSaving={isRenaming}
          visible={pendingEdit !== null}
          onCancel={handleCancelEdit}
          onSave={handleSaveEdit}
        />
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  backdropPressable: {
    ...StyleSheet.absoluteFill,
  },
  backdropTint: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(26, 26, 26, 0.22)",
  },
  backdropWrap: {
    ...StyleSheet.absoluteFill,
  },
  closeButton: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.sm,
    borderWidth: borderWidths.default,
    height: 36,
    justifyContent: "center",
    width: 36,
    ...shadows.sm,
  },
  countBadge: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.sm,
    borderWidth: borderWidths.thin,
    justifyContent: "center",
    minWidth: 28,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  countText: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansBold,
    fontSize: 12,
  },
  drawer: {
    bottom: 0,
    left: 0,
    position: "absolute",
    top: 0,
  },
  drawerBody: {
    backgroundColor: colors.card,
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  drawerHeader: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderBottomColor: colors.border,
    borderBottomWidth: borderWidths.default,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  drawerShell: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRightWidth: borderWidths.default,
    flex: 1,
    ...shadows.lg,
  },
  drawerTitle: {
    color: colors.foreground,
    fontFamily: fontFamilies.head,
    fontSize: 22,
    lineHeight: 26,
  },
  emptyText: {
    color: colors.mutedForeground,
    fontFamily: fontFamilies.sans,
    fontSize: 14,
    paddingTop: spacing.lg,
    textAlign: "center",
  },
  errorText: {
    color: colors.destructive,
    fontFamily: fontFamilies.sans,
    fontSize: 14,
    marginBottom: spacing.sm,
  },
  list: {
    flex: 1,
    marginTop: spacing.sm,
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
  loader: {
    marginVertical: spacing.lg,
  },
  actionsRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.lg },
  searchButton: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.sky, borderColor: colors.onAccent, borderWidth: borderWidths.default, alignItems: "center", justifyContent: "center", ...shadows.sm },
  newChatButton: {
    flex: 1,
    minHeight: 52,
    alignItems: "center",
    backgroundColor: colors.primary,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: borderWidths.default,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
    ...shadows.md,
  },
  newChatLabel: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansBold,
    fontSize: 16,
  },
  overlay: {
    flex: 1,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ translateY: 1 }],
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansBold,
    fontSize: 16,
  },
});
