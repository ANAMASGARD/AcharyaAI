import { usePreviewAttachments, usePreviewFeature } from "@/components/preview/preview-provider";
import type { PreviewAttachment } from "@/lib/ui-preview/types";
import {
  ACCEPTED_NOTE_MIMES,
  isAcceptedNotesFile,
  isWithinSizeLimit,
  normalizePickerAsset,
} from "@/lib/notes-file-validation";
import { colors } from "@/theme/colors";
import { borderWidths, radii, shadows, spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import { useCurriculumAvailability } from "@/hooks/use-curriculum-availability";
import type { CurriculumClass, CurriculumSelection } from "@/types/curriculum";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { AcharyaBlurView as BlurView } from "@/components/ui/acharya-blur";
import * as DocumentPicker from "expo-document-picker";
import { useEffect, useState } from "react";
import {
  useWindowDimensions,
  Modal,
  Platform,
  Pressable,
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
  damping: 26,
  mass: 0.9,
  stiffness: 300,
};

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

type Props = Readonly<{
  visible: boolean;
  classes: readonly CurriculumClass[];
  expandedClassId: string | null;
  selection: CurriculumSelection | null;
  uploadedBookName: string | null;
  onClose: () => void;
  onToggleClass: (classId: string) => void;
  onSelectSubject: (selection: CurriculumSelection) => void;
  onUploadedBook: (name: string | null) => void;
  onOpenTeachingClasses: () => void;
}>;

const AVAILABLE_GREEN = "#22A06B";

function subjectCountLabel(count: number): string {
  return count === 1 ? "1 subject" : `${count} subjects`;
}

export function CurriculumSelectSheet({
  visible,
  classes,
  expandedClassId,
  selection,
  uploadedBookName,
  onClose,
  onToggleClass,
  onSelectSubject,
  onUploadedBook,
  onOpenTeachingClasses,
}: Props): React.ReactElement | null {
  const insets = useSafeAreaInsets();
  const { saveAttachment, removeAttachment } = usePreviewAttachments();
  const [bookAttachment, setBookAttachment] = usePreviewFeature<PreviewAttachment | null>("curriculum-book", null);
  const [mounted, setMounted] = useState(visible);
  const [isUploadingBook, setIsUploadingBook] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const { isReady: isCurriculumReady, isLoading: isAvailabilityLoading } =
    useCurriculumAvailability(visible);

  const { height } = useWindowDimensions();
  const slideDistance = Math.min(height * 0.92, 720);
  const translateY = useSharedValue(slideDistance);
  const backdropProgress = useSharedValue(0);

  const finishClose = (): void => {
    setMounted(false);
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
      translateY.value = withSpring(0, SPRING_CONFIG);
      return;
    }

    if (!mounted) {
      return;
    }

    backdropProgress.value = withTiming(0, {
      duration: 220,
      easing: Easing.in(Easing.cubic),
    });
    translateY.value = withTiming(
      slideDistance,
      {
        duration: 280,
        easing: Easing.in(Easing.cubic),
      },
      (finished) => {
        if (finished) {
          runOnJS(finishClose)();
        }
      },
    );
  }, [backdropProgress, mounted, slideDistance, translateY, visible]);

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backdropProgress.value,
  }));

  const blurAnimatedProps = useAnimatedProps(() => ({
    intensity: backdropProgress.value * BLUR_INTENSITY,
  }));

  const handleUploadBook = async (): Promise<void> => {
    if (isUploadingBook) {
      return;
    }

    setIsUploadingBook(true);
    setUploadError(null);

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [...ACCEPTED_NOTE_MIMES],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      const normalized = normalizePickerAsset(result.assets[0]);

      if (!isAcceptedNotesFile(normalized.name, normalized.mimeType)) {
        setUploadError("Please upload a PDF or Word document.");
        return;
      }

      if (!isWithinSizeLimit(normalized.sizeBytes)) {
        setUploadError("Choose a PDF or Word document up to 10 MB.");
        return;
      }

      const saved = await saveAttachment({ ...normalized, mimeType: normalized.mimeType ?? undefined, sizeBytes: normalized.sizeBytes ?? undefined });
      if (bookAttachment) await removeAttachment(bookAttachment.id);
      setBookAttachment(saved);
      onUploadedBook(normalized.name);
    } catch {
      setUploadError("Could not open the file picker. Please try again.");
    } finally {
      setIsUploadingBook(false);
    }
  };

  if (!mounted) {
    return null;
  }

  return (
    <Modal
      animationType="none"
      onRequestClose={onClose}
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
            accessibilityLabel="Close curriculum selector"
            onPress={onClose}
            style={styles.backdropPressable}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            sheetAnimatedStyle,
            { paddingBottom: Math.max(insets.bottom, spacing.md) },
          ]}
        >
          <View style={styles.sheetHeader}>
            <View style={styles.sheetTitleRow}>
              <MaterialCommunityIcons
                color={colors.foreground}
                name="book-open-page-variant"
                size={22}
              />
              <Text style={styles.sheetTitle}>Select Curriculum</Text>
            </View>
            <Pressable
              accessibilityLabel="Close"
              onPress={onClose}
              style={({ pressed }) => [
                styles.closeButton,
                pressed ? styles.closeButtonPressed : null,
              ]}
            >
              <MaterialCommunityIcons color={colors.foreground} name="close" size={20} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator
            style={styles.list}
          >
            {classes.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No teaching classes yet</Text>
                <Text style={styles.emptyBody}>
                  Select the grades you teach in Profile settings. Only those classes
                  will appear here with their subjects.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={onOpenTeachingClasses}
                  style={({ pressed }) => [
                    styles.emptyCta,
                    pressed ? styles.emptyCtaPressed : null,
                  ]}
                >
                  <Text style={styles.emptyCtaLabel}>Select classes in settings</Text>
                </Pressable>
              </View>
            ) : (
              classes.map((classItem) => (
                <CurriculumClassBlock
                  key={classItem.id}
                  classItem={classItem}
                  expanded={expandedClassId === classItem.id}
                  isCurriculumReady={isCurriculumReady}
                  selection={selection}
                  onSelectSubject={onSelectSubject}
                  onToggle={() => {
                    onToggleClass(classItem.id);
                  }}
                />
              ))
            )}

            <Pressable
              accessibilityLabel="Upload curriculum book"
              disabled={isUploadingBook}
              onPress={() => {
                void handleUploadBook();
              }}
              style={({ pressed }) => [
                styles.uploadBookRow,
                pressed && !isUploadingBook ? styles.uploadBookRowPressed : null,
              ]}
            >
              <MaterialCommunityIcons
                color={colors.foreground}
                name="tray-arrow-up"
                size={20}
              />
              <Text numberOfLines={1} style={styles.uploadBookLabel}>
                {uploadedBookName ? `Uploaded: ${uploadedBookName}` : "Upload book"}
              </Text>
            </Pressable>

            {uploadError ? (
              <Text style={styles.uploadError}>{uploadError}</Text>
            ) : null}

            {isAvailabilityLoading ? (
              <Text style={styles.availabilityHint}>Checking book availability…</Text>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Select a class and subject to enable curriculum-aware responses and
              notes verification.
            </Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

type ClassBlockProps = Readonly<{
  classItem: CurriculumClass;
  expanded: boolean;
  isCurriculumReady: (classLevel: string, subject: string) => boolean;
  selection: CurriculumSelection | null;
  onToggle: () => void;
  onSelectSubject: (selection: CurriculumSelection) => void;
}>;

function SubjectAvailabilityBadge({
  available,
  selected,
}: Readonly<{
  available: boolean;
  selected: boolean;
}>): React.ReactElement {
  if (available) {
    return (
      <View style={styles.availableBadge}>
        {selected ? <Text style={styles.selectedLabel}>Selected</Text> : null}
        <Text style={styles.availableLabel}>Available</Text>
        <MaterialCommunityIcons
          accessibilityLabel="Books available"
          color={AVAILABLE_GREEN}
          name="check-circle"
          size={22}
        />
      </View>
    );
  }

  return <Text style={styles.comingSoonLabel}>Coming soon</Text>;
}

function CurriculumClassBlock({
  classItem,
  expanded,
  isCurriculumReady,
  selection,
  onToggle,
  onSelectSubject,
}: ClassBlockProps): React.ReactElement {
  const subjectCount = classItem.subjects.length;

  return (
    <View style={styles.classBlock}>
      <Pressable
        accessibilityLabel={`${classItem.label}, ${subjectCountLabel(subjectCount)}`}
        accessibilityState={{ expanded }}
        onPress={onToggle}
        style={({ pressed }) => [
          styles.classRow,
          expanded ? styles.classRowExpanded : null,
          pressed ? styles.rowPressed : null,
        ]}
      >
        <Text style={styles.classLabel}>{classItem.label}</Text>
        <View style={styles.classMeta}>
          <View style={styles.subjectBadge}>
            <Text style={styles.subjectBadgeText}>
              {subjectCountLabel(subjectCount)}
            </Text>
          </View>
          <MaterialCommunityIcons
            color={colors.foreground}
            name={expanded ? "chevron-down" : "chevron-right"}
            size={22}
          />
        </View>
      </Pressable>

      {expanded
        ? classItem.subjects.map((subject) => {
            const isSelected =
              selection?.classId === classItem.id &&
              selection.subjectId === subject.id;
            const hasBooks = isCurriculumReady(classItem.id, subject.id);

            return (
              <Pressable
                key={subject.id}
                accessibilityLabel={`${subject.label}, ${hasBooks ? "books available" : "coming soon"}${isSelected ? ", selected" : ""}`}
                onPress={() => {
                  onSelectSubject({
                    classId: classItem.id,
                    classLabel: classItem.label,
                    subjectId: subject.id,
                    subjectLabel: subject.label,
                  });
                }}
                style={({ pressed }) => [
                  styles.subjectRow,
                  isSelected ? styles.subjectRowSelected : null,
                  !hasBooks ? styles.subjectRowComingSoon : null,
                  pressed ? styles.rowPressed : null,
                ]}
              >
                <Text
                  style={[
                    styles.subjectLabel,
                    hasBooks ? styles.subjectLabelAvailable : null,
                  ]}
                >
                  {subject.label}
                </Text>
                <SubjectAvailabilityBadge available={hasBooks} selected={isSelected} />
              </Pressable>
            );
          })
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
  classBlock: {
    gap: spacing.sm,
  },
  classLabel: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansBold,
    fontSize: 17,
    lineHeight: 22,
  },
  classMeta: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  classRow: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: borderWidths.default,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: spacing.touch,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...shadows.sm,
  },
  classRowExpanded: {
    backgroundColor: colors.primary,
  },
  closeButton: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: borderWidths.default,
    height: 36,
    justifyContent: "center",
    width: 36,
    ...shadows.xs,
  },
  closeButtonPressed: {
    opacity: 0.88,
  },
  emptyBody: {
    color: colors.mutedForeground,
    fontFamily: fontFamilies.sans,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  emptyCta: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: borderWidths.default,
    marginTop: spacing.sm,
    minHeight: spacing.touch,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    ...shadows.sm,
  },
  emptyCtaLabel: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansBold,
    fontSize: 14,
    lineHeight: 18,
  },
  emptyCtaPressed: {
    opacity: 0.9,
  },
  emptyState: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: borderWidths.default,
    gap: spacing.sm,
    padding: spacing.lg,
    ...shadows.sm,
  },
  emptyTitle: {
    color: colors.foreground,
    fontFamily: fontFamilies.head,
    fontSize: 18,
    lineHeight: 24,
    textAlign: "center",
  },
  footer: {
    backgroundColor: colors.cream,
    borderTopColor: colors.border,
    borderTopWidth: borderWidths.thin,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  footerText: {
    color: colors.mutedForeground,
    fontFamily: fontFamilies.sans,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  list: {
    flexGrow: 0,
    maxHeight: "62%",
  },
  listContent: {
    gap: spacing.sm,
    padding: spacing.lg,
  },
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  rowPressed: {
    opacity: 0.9,
  },
  sheet: {
    backgroundColor: colors.cream,
    borderColor: colors.border,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderWidth: borderWidths.default,
    maxHeight: "88%",
    overflow: "hidden",
    zIndex: 2,
    ...shadows.lg,
  },
  sheetHeader: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderBottomColor: colors.border,
    borderBottomWidth: borderWidths.default,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  sheetTitle: {
    color: colors.foreground,
    fontFamily: fontFamilies.head,
    fontSize: 20,
    lineHeight: 26,
  },
  sheetTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  subjectBadge: {
    backgroundColor: colors.secondary,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  subjectBadgeText: {
    color: colors.secondaryForeground,
    fontFamily: fontFamilies.sansBold,
    fontSize: 12,
    lineHeight: 16,
  },
  subjectLabel: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansMedium,
    fontSize: 16,
    lineHeight: 22,
  },
  subjectLabelAvailable: {
    color: AVAILABLE_GREEN,
    fontFamily: fontFamilies.sansBold,
  },
  subjectRow: {
    alignItems: "center",
    backgroundColor: colors.sky,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: borderWidths.thin,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: spacing.touch,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  subjectRowSelected: {
    backgroundColor: colors.mint,
  },
  subjectRowComingSoon: {
    opacity: 0.92,
  },
  availableBadge: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
  },
  availableLabel: {
    color: AVAILABLE_GREEN,
    fontFamily: fontFamilies.sansBold,
    fontSize: 12,
    lineHeight: 16,
  },
  selectedLabel: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansBold,
    fontSize: 12,
    lineHeight: 16,
  },
  comingSoonLabel: {
    color: colors.primary,
    fontFamily: fontFamilies.sansMedium,
    fontSize: 11,
    lineHeight: 14,
  },
  availabilityHint: {
    color: colors.mutedForeground,
    fontFamily: fontFamilies.sans,
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
  },
  uploadBookRow: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderStyle: "dashed",
    borderWidth: borderWidths.thin,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    marginTop: spacing.sm,
    minHeight: spacing.touch,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  uploadBookRowPressed: {
    backgroundColor: colors.accent,
  },
  uploadBookLabel: {
    color: colors.foreground,
    flex: 1,
    fontFamily: fontFamilies.sansBold,
    fontSize: 15,
    lineHeight: 20,
  },
  uploadError: {
    color: "#E07A5F",
    fontFamily: fontFamilies.sansMedium,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
});
