import { NeoCard } from "@/components/ui/neo-card";
import {
  addMonths,
  formatMonthYear,
  getMonthMatrix,
  isSameDay,
  toDateKey,
  WEEKDAY_LABELS,
} from "@/lib/calendar/date-utils";
import { colors } from "@/theme/colors";
import { borderWidths, radii, spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = Readonly<{
  selectedDate: Date;
  markedDateKeys: ReadonlySet<string>;
  onSelectDate: (date: Date) => void;
}>;

export function TeachingCalendar({
  selectedDate,
  markedDateKeys,
  onSelectDate,
}: Props): React.ReactElement {
  const [visibleMonth, setVisibleMonth] = useState(
  () => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1),
  );

  const cells = useMemo(
    () => getMonthMatrix(visibleMonth.getFullYear(), visibleMonth.getMonth()),
    [visibleMonth],
  );

  const goToPreviousMonth = (): void => {
    setVisibleMonth((current) => addMonths(current, -1));
  };

  const goToNextMonth = (): void => {
    setVisibleMonth((current) => addMonths(current, 1));
  };

  return (
    <NeoCard stacked padding={spacing.lg}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Previous month"
          accessibilityRole="button"
          onPress={goToPreviousMonth}
          style={({ pressed }) => [styles.navButton, pressed ? styles.navPressed : null]}
        >
          <MaterialCommunityIcons
            color={colors.foreground}
            name="chevron-left"
            size={22}
          />
        </Pressable>

        <Text style={styles.monthLabel}>{formatMonthYear(visibleMonth)}</Text>

        <Pressable
          accessibilityLabel="Next month"
          accessibilityRole="button"
          onPress={goToNextMonth}
          style={({ pressed }) => [styles.navButton, pressed ? styles.navPressed : null]}
        >
          <MaterialCommunityIcons
            color={colors.foreground}
            name="chevron-right"
            size={22}
          />
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label) => (
          <Text key={label} style={styles.weekdayLabel}>
            {label}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((cell) => {
          const key = toDateKey(cell.date);
          const isSelected = isSameDay(cell.date, selectedDate);
          const hasSessions = markedDateKeys.has(key);

          return (
            <Pressable
              key={key}
              accessibilityLabel={`${cell.date.getDate()}`}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              onPress={() => onSelectDate(cell.date)}
              style={styles.dayCell}
            >
              <View
                style={[
                  styles.dayInner,
                  isSelected ? styles.daySelected : null,
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    !cell.inCurrentMonth ? styles.dayMuted : null,
                    isSelected ? styles.dayTextSelected : null,
                  ]}
                >
                  {cell.date.getDate()}
                </Text>
                {hasSessions ? (
                  <View
                    style={[
                      styles.sessionDot,
                      isSelected ? styles.sessionDotSelected : null,
                    ]}
                  />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </NeoCard>
  );
}

const styles = StyleSheet.create({
  dayCell: {
    alignItems: "center",
    flexBasis: "14.28%",
    maxWidth: "14.28%",
    paddingVertical: 2,
  },
  dayInner: {
    alignItems: "center",
    borderRadius: radii.sm,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  dayMuted: {
    color: colors.muted,
  },
  daySelected: {
    backgroundColor: colors.primary,
  },
  dayText: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansMedium,
    fontSize: 15,
    lineHeight: 20,
  },
  dayTextSelected: {
    fontFamily: fontFamilies.sansBold,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: spacing.sm,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  monthLabel: {
    color: colors.foreground,
    fontFamily: fontFamilies.head,
    fontSize: 20,
    lineHeight: 26,
  },
  navButton: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.sm,
    borderWidth: borderWidths.default,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  navPressed: {
    opacity: 0.85,
    transform: [{ translateX: 1 }, { translateY: 1 }],
  },
  sessionDot: {
    backgroundColor: colors.foreground,
    borderRadius: 3,
    height: 5,
    marginTop: 2,
    width: 5,
  },
  sessionDotSelected: {
    backgroundColor: colors.foreground,
  },
  weekdayLabel: {
    color: colors.foreground,
    flex: 1,
    fontFamily: fontFamilies.sansBold,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  weekdayRow: {
    flexDirection: "row",
    marginTop: spacing.lg,
  },
});
