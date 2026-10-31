import { useEffect, useState, type ComponentProps } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as NativeText,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { shadows } from "@/theme/tokens";
import { PaperScoreCard } from "./paper-score-card";
import { useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";
import { useRagLibrary } from "@/hooks/use-rag-library";
import type { Citation, Source, SourceSelection } from "@/types/rag";
import type { ThemeColors } from "@/theme/colors";
import { useThemeColors, useThemeStyles } from "@/theme/use-theme";
import { useChatStore } from "@/store/chat-store";
import { useChatHistoryStore } from "@/store/chat-history-store";

function Text(props: ComponentProps<typeof NativeText>) {
  const colors = useThemeColors();
  return (
    <NativeText
      {...props}
      style={[{ color: colors.foreground }, props.style]}
    />
  );
}

function Action({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const styles = useThemeStyles(createStyles);
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, disabled && styles.disabled]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}
export function CitationList({ citations }: { citations: Citation[] }) {
  const styles = useThemeStyles(createStyles);
  return (
    <View style={styles.stack}>
      {citations.map((c, i) => (
        <View key={c.chunkId} style={styles.evidence}>
          <Text style={styles.bold}>
            [{i + 1}] {c.title}
            {c.chapterTitle ? ` · ${c.chapterTitle}` : ""} · PDF page {c.page}
          </Text>
          <Text selectable>{c.text}</Text>
        </View>
      ))}
    </View>
  );
}
export function RagWorkspace({
  selections,
  onSelections,
  onDiscuss,
  curriculumVisible,
  onOpenCurriculum,
  onCloseCurriculum,
}: {
  selections: SourceSelection[];
  onSelections: (next: SourceSelection[]) => void;
  onDiscuss?: () => void;
  curriculumVisible?: boolean;
  onOpenCurriculum?: () => void;
  onCloseCurriculum?: () => void;
}) {
  const styles = useThemeStyles(createStyles);
  const router = useRouter();
  const library = useRagLibrary();
  const colors = useThemeColors();
  const [localMenu, setLocalMenu] = useState(false);
  const [classLevel, setClassLevel] = useState<string | null>(null);
  const [subject, setSubject] = useState<string | null>(null);
  const menuVisible = curriculumVisible ?? localMenu;
  const openMenu = onOpenCurriculum ?? (() => setLocalMenu(true));
  const closeMenu = onCloseCurriculum ?? (() => setLocalMenu(false));
  const classLevels = [
    ...new Set([
      ...Array.from({ length: 12 }, (_, i) => `class-${i + 1}`),
      ...library.sources
        .filter((s) => s.shared && s.classLevel)
        .map((s) => s.classLevel!),
    ]),
  ].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const subjects = [
    ...new Set(
      library.sources
        .filter((s) => s.shared && s.classLevel === classLevel && s.subject)
        .map((s) => s.subject!),
    ),
  ];
  const { userId } = useAuth();
  const [paper, setPaper] = useState<Source | null>(null);
  useEffect(() => {
    // Never display a previous account's evaluation target.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPaper(null);
  }, [userId]);
  const toggle = (source: Source) =>
    onSelections(
      selections.some((s) => s.documentId === source.id)
        ? selections.filter((s) => s.documentId !== source.id)
        : [...selections, { documentId: source.id, role: "syllabus" }],
    );
  const remove = (source: Source) => {
    const perform = () => {
      void library.remove(source.id).then((deleted) => {
        if (!deleted) return;
        if (paper?.id === source.id) setPaper(null);
        onSelections(selections.filter((s) => s.documentId !== source.id));
        useChatStore.getState().resetTabData();
        useChatHistoryStore.getState().reset();
      });
    };
    const message =
      "Delete this item and its related reports and chats?";
    if (Platform.OS === "web") {
      if (window.confirm(message)) perform();
    } else
      Alert.alert(source.kind === "paper" ? "Delete paper?" : "Delete book?", message, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: perform },
      ]);
  };
  const addReference = async () => {
    const source = await library.upload("reference");
    if (source?.status === "ready")
      onSelections([
        ...selections.filter((s) => s.documentId !== source.id),
        { documentId: source.id, role: "supporting" },
      ]);
  };
  const renderSource = (source: Source) => {
    const selected = selections.find((s) => s.documentId === source.id);
    return (
      <View key={source.id} style={[styles.card, selected && styles.selected]}>
        <Text style={styles.bold}>{source.title}</Text>
        <Text>
          {source.shared ? "Shared textbook" : "Private source"}
          {source.classLevel ? ` · ${source.classLevel}` : ""}
          {source.subject ? ` · ${source.subject}` : ""}
        </Text>
        <Text>
          {source.status === "ready"
            ? `${source.pageCount} pages ready`
            : "Preparing book…"}
        </Text>
        {source.error ? <Text style={styles.error}>{source.error}</Text> : null}
        <View style={styles.row}>
          <Action
            label={selected ? "Selected ✓" : "Select book"}
            onPress={() => toggle(source)}
            disabled={source.status !== "ready" || library.busy}
          />
          {!source.shared && source.status !== "ready" ? (
            <Action
              label={
                source.extractedCount < source.pageCount
                  ? "Select same file to resume"
                  : "Resume / retry"
              }
              onPress={() => void library.resume(source)}
              disabled={library.busy}
            />
          ) : null}
          {!source.shared ? (
            <Action
              label="Delete"
              onPress={() => remove(source)}
              disabled={library.busy}
            />
          ) : null}
        </View>
        {selected ? (
          <>
            <View style={styles.row}>
              {(["syllabus", "supporting"] as const).map((role) => (
                <Action
                  key={role}
                  label={`${selected.role === role ? "✓ " : ""}${role === "syllabus" ? "Defines syllabus" : "Supporting material"}`}
                  onPress={() =>
                    onSelections(
                      selections.map((s) =>
                        s.documentId === source.id ? { ...s, role } : s,
                      ),
                    )
                  }
                  disabled={library.busy}
                />
              ))}
            </View>
            {source.chapters.length ? (
              <>
                <Text style={styles.hint}>
                  All chapters unless you select specific chapters:
                </Text>
                <View style={styles.row}>
                  {source.chapters.map((ch) => (
                    <Action
                      key={ch.id}
                      label={`${selected.chapterIds?.includes(ch.id) ? "✓ " : ""}${ch.title}`}
                      onPress={() =>
                        onSelections(
                          selections.map((s) =>
                            s.documentId !== source.id
                              ? s
                              : {
                                  ...s,
                                  chapterIds: s.chapterIds?.includes(ch.id)
                                    ? s.chapterIds.filter((id) => id !== ch.id)
                                    : [...(s.chapterIds ?? []), ch.id],
                                },
                          ),
                        )
                      }
                      disabled={library.busy}
                    />
                  ))}
                </View>
              </>
            ) : null}
          </>
        ) : null}
      </View>
    );
  };
  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Check a paper against the syllabus</Text>
        <Text style={styles.heroText}>
          Choose your books. Add your paper. Get a clear review.
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Select class, subject and books"
        onPress={openMenu}
        style={styles.scope}
      >
        <Text style={styles.bold}>
          {selections.length
            ? `${selections.length} book${selections.length === 1 ? "" : "s"} selected`
            : "Select class, subject & books"}
        </Text>
        <Text style={styles.hint}>
          {selections.length
            ? library.sources
                .filter((s) => selections.some((x) => x.documentId === s.id))
                .map((s) => s.title)
                .join(" · ")
            : "Tap the red menu to choose your curriculum."}
        </Text>
      </Pressable>
      {library.busy ? (
        <View style={styles.row}>
          <ActivityIndicator />
          <Text style={styles.flex}>
            {library.progress || "Loading library…"}
          </Text>
        </View>
      ) : null}
      {library.error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {library.error}
        </Text>
      ) : null}
      <View style={styles.uploadCard}>
        <Text style={styles.heading}>1 · Upload your question paper</Text>
        <View style={styles.row}>
          <Action
            label="PDF"
            onPress={() =>
              void library.upload("paper").then((s) => {
                if (s) {
                  setPaper(s);
                  library.setVerification(null);
                }
              })
            }
            disabled={library.busy}
          />
          <Action
            label="Gallery"
            disabled={library.busy}
            onPress={() =>
              void library.upload("paper", "gallery").then((s) => {
                if (s) {
                  setPaper(s);
                  library.setVerification(null);
                }
              })
            }
          />
          <Action
            label="Camera"
            onPress={() =>
              void library.upload("paper", true).then((s) => {
                if (s) {
                  setPaper(s);
                  library.setVerification(null);
                }
              })
            }
            disabled={library.busy}
          />
        </View>
        {paper ? (
          <View style={styles.scope}>
            <MaterialCommunityIcons
              name="file-document-outline"
              size={28}
              color={colors.foreground}
            />
            <Text>
              {paper.title} · {paper.pageCount} pages
            </Text>
            <Action
              label="Remove paper"
              onPress={() => {
                setPaper(null);
                library.setVerification(null);
              }}
              disabled={library.busy}
            />
          </View>
        ) : null}
        <Action
          label={
            selections.some((s) => s.role === "syllabus")
              ? "✓ Verify Paper"
              : "Review Paper"
          }
          onPress={() => {
            if (paper) void library.runVerification(paper.id, selections);
          }}
          disabled={library.busy || !paper}
        />
      </View>
      {!selections.some((s) => s.role === "syllabus") ? (
        <Text style={styles.hint}>
          Select books above to check curriculum alignment.
        </Text>
      ) : null}
      {library.papers.length ? (
        <View style={styles.stack}>
          <Text style={styles.bold}>Your recent papers</Text>
          {library.papers.map((saved) => (
            <View key={saved.id} style={styles.card}>
              <Text>{saved.title}</Text>
              <View style={styles.row}>
                {saved.status === "ready" ? <Action label={paper?.id === saved.id ? "Selected ✓" : "Select paper"}
                  disabled={library.busy} onPress={() => {setPaper(saved);library.setVerification(null);}} /> : null}
                <Action label="Delete paper" disabled={library.busy} onPress={() => remove(saved)} />
              </View>
            </View>
          ))}
        </View>
      ) : null}
      {library.verification ? (
        <View style={styles.stack}>
          {JSON.stringify(library.verification.selections) !==
          JSON.stringify(selections) ? (
            <Text style={styles.hint}>
              This saved report uses its original book selection. Run a new
              check to review the currently selected sources.
            </Text>
          ) : null}
          <PaperScoreCard report={library.verification} />
          <Action
            label="Discuss this paper in Chat"
            disabled={
              library.busy ||
              library.verification.status !== "completed" ||
              library.verification.historical
            }
            onPress={() => {
              onDiscuss?.();
              router.push({
                pathname: "/(app)/(tabs)/chat",
                params: { review: library.verification!.id },
              });
            }}
          />
          <Text style={styles.heading}>
            Paper review · {library.verification.status}
            {library.verification.historical ? " · Historical sources" : ""}
          </Text>
          <Text>
            {library.verification.questions.length}/
            {library.verification.totalQuestions} questions reviewed.
          </Text>
          {library.verification.questions.map((q, i) => (
            <View style={styles.card} key={`${q.page}-${q.number}-${i}`}>
              <Text style={styles.bold}>
                {q.number} · {q.status.replaceAll("_", " ")}
              </Text>
              <Text selectable>{q.text}</Text>
              <Text>
                Paper page {q.page} ·{" "}
                {q.marks === null ? "Marks not printed" : `${q.marks} marks`}
              </Text>
              <Text>{q.explanation}</Text>
              {q.suggestion ? <Text>{q.suggestion}</Text> : null}
              {q.provisionalReview ? (
                <View style={styles.evidence}>
                  <Text style={styles.bold}>
                    Question clarity · {q.provisionalReview.clarityScore}/100
                  </Text>
                  <Text>{q.provisionalReview.explanation}</Text>
                  <Text>{q.provisionalReview.suggestion}</Text>
                </View>
              ) : null}
              <CitationList citations={q.citations} />
            </View>
          ))}
        </View>
      ) : null}
      {library.reports.length ? (
        <Text style={styles.heading}>Saved paper checks</Text>
      ) : null}
      {library.reports.filter(report => report.status === "completed").map((report) => (
        <View style={styles.card} key={report.id}>
          <Text>
            {report.historical ? "Historical · " : ""}
            {report.status} · {report.questions.length}/
            {report.totalQuestions || "…"} questions
          </Text>
          {report.error ? (
            <Text style={styles.error}>{report.error}</Text>
          ) : null}
          <Action
            label={
              report.status === "completed" ? "View report" : "Resume check"
            }
            disabled={library.busy}
            onPress={() =>
              report.status === "completed"
                ? library.setVerification(report)
                : void library.runVerification(report.paperId, [], report.id)
            }
          />
        </View>
      ))}
      <Modal
        visible={menuVisible}
        transparent
        animationType="slide"
        onRequestClose={closeMenu}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>▣ Select Curriculum</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close curriculum"
                onPress={closeMenu}
                style={styles.close}
              >
                <Text style={styles.bold}>✕</Text>
              </Pressable>
            </View>
            <ScrollView
              contentContainerStyle={styles.container}
              keyboardShouldPersistTaps="handled"
            >
              {classLevels.map((level) => (
                <View key={level} style={styles.stack}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded: classLevel === level }}
                    style={styles.classButton}
                    onPress={() => {
                      setClassLevel(classLevel === level ? null : level);
                      setSubject(null);
                    }}
                  >
                    <Text style={styles.classText}>
                      {level.replace(/^class-/, "Class ")} ·{" "}
                      {
                        library.sources.filter(
                          (s) => s.shared && s.classLevel === level,
                        ).length
                      }{" "}
                      available　⌄
                    </Text>
                  </Pressable>
                  {classLevel === level && subjects.length === 0 ? (
                    <Text style={styles.hint}>
                      No books yet. Add your own below.
                    </Text>
                  ) : null}
                  {classLevel === level
                    ? subjects.map((name) => (
                        <Pressable
                          key={name}
                          accessibilityRole="button"
                          accessibilityState={{ selected: subject === name }}
                          style={[
                            styles.subjectButton,
                            subject === name && styles.selected,
                          ]}
                          onPress={() => setSubject(name)}
                        >
                          <Text style={styles.classText}>
                            {name.charAt(0).toUpperCase() + name.slice(1)}
                          </Text>
                          <Text style={styles.classText}>
                            {subject === name ? "Selected ✓" : "Available ✓"}
                          </Text>
                        </Pressable>
                      ))
                    : null}
                  {classLevel === level
                    ? library.sources
                        .filter(
                          (source) =>
                            source.shared &&
                            source.classLevel === level &&
                            source.subject === subject,
                        )
                        .map(renderSource)
                    : null}
                </View>
              ))}
              <Text style={styles.heading}>Your teaching library</Text>
              <Text>
                Add your own books or notes.
              </Text>
              <View style={styles.row}>
                <Action
                  label="Add notes / book PDF"
                  onPress={() => void addReference()}
                  disabled={library.busy}
                />
                <Action
                  label="Refresh"
                  onPress={() => void library.refresh()}
                  disabled={library.busy}
                />
              </View>
              <Text style={styles.hint}>
                PDF up to 10 MB / 100 pages. Reviewed with OpenAI.
              </Text>
              {library.busy ? (
                <View style={styles.row}>
                  <ActivityIndicator />
                  <Text style={styles.flex}>
                    {library.progress || "Loading library…"}
                  </Text>
                </View>
              ) : null}
              {library.error ? (
                <Text accessibilityRole="alert" style={styles.error}>
                  {library.error}
                </Text>
              ) : null}
              {!library.busy && !library.sources.length ? (
                <Text>
                  No books are ready yet. Add a private source or preload the
                  shared catalog.
                </Text>
              ) : null}
              {library.sources
                .filter((source) => !source.shared)
                .map(renderSource)}
            </ScrollView>
            <View style={styles.sheetFooter}>
              <Action
                label={`Use ${selections.length} selected books`}
                onPress={closeMenu}
              />
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { padding: 16, gap: 16, paddingBottom: 48 },
    hero: {
      backgroundColor: colors.primary,
      padding: 20,
      gap: 12,
      borderWidth: 3,
      borderColor: colors.border,
      borderRadius: 14,
      ...shadows.md,
    },
    heroTitle: { color: colors.onAccent, fontSize: 21, fontWeight: "800" },
    heroText: { color: colors.onAccent, fontSize: 16, lineHeight: 25 },
    scope: {
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 10,
      backgroundColor: colors.card,
      padding: 12,
      gap: 6,
    },
    uploadCard: {
      borderWidth: 2,
      borderStyle: "dashed",
      borderColor: colors.border,
      borderRadius: 12,
      padding: 18,
      gap: 18,
      backgroundColor: colors.card,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.55)",
      justifyContent: "flex-end",
    },
    sheet: {
      maxHeight: "90%",
      backgroundColor: colors.cream,
      borderWidth: 3,
      borderColor: colors.border,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      overflow: "hidden",
    },
    sheetHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.primary,
      padding: 16,
      borderBottomWidth: 3,
      borderColor: colors.border,
    },
    sheetTitle: { fontSize: 23, fontWeight: "900", color: colors.onAccent },
    close: {
      minHeight: 44,
      minWidth: 44,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.card,
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 8,
    },
    sheetFooter: {
      padding: 16,
      paddingBottom: 28,
      borderTopWidth: 2,
      borderColor: colors.border,
    },
    classButton: {
      backgroundColor: colors.primary,
      borderWidth: 3,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 18,
      minHeight: 56,
      ...shadows.sm,
    },
    classText: { color: colors.onAccent, fontWeight: "800", fontSize: 16 },
    subjectButton: {
      backgroundColor: colors.sky,
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 16,
      minHeight: 56,
      flexDirection: "row",
      justifyContent: "space-between",
    },
    heading: { fontSize: 22, fontWeight: "800", color: colors.foreground },
    bold: { fontWeight: "700", fontSize: 15 },
    card: {
      padding: 14,
      gap: 10,
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.card,
      ...shadows.sm,
    },
    selected: { borderColor: colors.success, borderWidth: 3 },
    row: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      alignItems: "center",
    },
    button: {
      minHeight: 44,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: colors.primary,
      justifyContent: "center",
    },
    buttonText: { fontWeight: "700", color: colors.onAccent },
    disabled: { opacity: 0.45 },
    hint: { fontSize: 12, color: colors.mutedForeground },
    error: { color: colors.destructive },
    stack: { gap: 10 },
    evidence: {
      padding: 10,
      gap: 6,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.cream,
    },
    flex: { flex: 1 },
  });
