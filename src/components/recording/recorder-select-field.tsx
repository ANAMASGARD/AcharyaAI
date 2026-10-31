import type { RecorderOption } from "@/data/recorder-options";
import { getRecorderOptionLabel } from "@/data/recorder-options";
import { colors } from "@/theme/colors";
import { borderWidths, radii, shadows, spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
} from "react-native";

type Props = Readonly<{
  value: string;
  onValueChange: (value: string) => void;
  options: readonly RecorderOption[];
  placeholder: string;
  disabled?: boolean;
}>;

export function RecorderSelectField({
  value,
  onValueChange,
  options,
  placeholder,
  disabled = false,
}: Props): React.ReactElement {
  const [open, setOpen] = useState(false);
  const selectedLabel = getRecorderOptionLabel(options, value);

  const handleSelect = (id: string): void => {
    onValueChange(id);
    setOpen(false);
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.trigger,
          disabled && styles.triggerDisabled,
          pressed && !disabled && styles.triggerPressed,
        ]}
      >
        <Text
          style={[
            styles.triggerText,
            !selectedLabel && styles.triggerPlaceholder,
          ]}
          numberOfLines={1}
        >
          {selectedLabel ?? placeholder}
        </Text>
        <MaterialCommunityIcons
          color={colors.foreground}
          name="chevron-down"
          size={22}
        />
      </Pressable>

      <Modal
        animationType="fade"
        transparent
        visible={open}
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <Text style={styles.sheetTitle}>{placeholder}</Text>
            <FlatList
              data={options}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const isSelected = item.id === value;
                return (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => handleSelect(item.id)}
                    style={({ pressed }) => [
                      styles.option,
                      isSelected && styles.optionSelected,
                      pressed && styles.optionPressed,
                    ]}
                  >
                    <Text style={styles.optionText}>{item.label}</Text>
                    {isSelected ? (
                      <MaterialCommunityIcons
                        color={colors.foreground}
                        name="check"
                        size={20}
                      />
                    ) : null}
                  </Pressable>
                );
              }}
              showsVerticalScrollIndicator={false}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    flex: 1,
    justifyContent: "flex-end",
    padding: spacing.lg,
  },
  option: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: borderWidths.thin,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
    minHeight: spacing.touch,
    paddingHorizontal: spacing.md,
  },
  optionPressed: {
    opacity: 0.88,
  },
  optionSelected: {
    backgroundColor: colors.primary,
  },
  optionText: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansMedium,
    fontSize: 16,
  },
  sheet: {
    backgroundColor: colors.cream,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: borderWidths.default,
    maxHeight: "70%",
    padding: spacing.lg,
    ...shadows.lg,
  },
  sheetTitle: {
    color: colors.foreground,
    fontFamily: fontFamilies.head,
    fontSize: 18,
    marginBottom: spacing.md,
  },
  trigger: {
    alignItems: "center",
    backgroundColor: colors.input,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: borderWidths.default,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: spacing.touch,
    paddingHorizontal: spacing.md,
  },
  triggerDisabled: {
    opacity: 0.7,
  },
  triggerPlaceholder: {
    color: colors.mutedForeground,
  },
  triggerPressed: {
    opacity: 0.92,
  },
  triggerText: {
    color: colors.foreground,
    flex: 1,
    fontFamily: fontFamilies.sans,
    fontSize: 16,
    marginRight: spacing.sm,
  },
});
