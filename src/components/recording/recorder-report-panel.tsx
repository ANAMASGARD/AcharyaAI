import { ClassNotesSection } from "@/components/calendar/class-notes-section";
import { ClassReflectionSections } from "@/components/calendar/class-reflection-sections";
import {
  SessionDetailViewToggle,
  type SessionDetailView,
} from "@/components/calendar/session-detail-view-toggle";
import { RecorderNeoCard } from "@/components/recording/recorder-neo-card";
import { spacing } from "@/theme/tokens";
import type { TeachingReport } from "@/types/recorder";
import { useState } from "react";
import { StyleSheet } from "react-native";

type Props = Readonly<{
  report: TeachingReport;
  classNotes: string | null;
}>;

export function RecorderReportPanel({
  report,
  classNotes,
}: Props): React.ReactElement {
  const [activeView, setActiveView] = useState<SessionDetailView>("reflection");

  return (
    <RecorderNeoCard style={styles.card}>
      <SessionDetailViewToggle onChange={setActiveView} value={activeView} />
      {activeView === "reflection" ? (
        <ClassReflectionSections report={report} />
      ) : (
        <ClassNotesSection notes={classNotes} />
      )}
    </RecorderNeoCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    overflow: "visible",
    padding: spacing.lg,
  },
});
