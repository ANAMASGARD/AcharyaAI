import { colors } from "@/theme/colors";
import { borderWidths, radii } from "@/theme/tokens";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet } from "react-native";

type Props = Readonly<{
  viewerSaved: boolean;
  onToggleSave: () => void;
}>;

export function PostTopActions({
  viewerSaved,
  onToggleSave,
}: Props): React.ReactElement {
  return (
    <Pressable
      accessibilityLabel={viewerSaved ? "Unsave post" : "Save post"}
      accessibilityRole="button"
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      onPress={onToggleSave}
      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
    >
      <MaterialCommunityIcons
        color={viewerSaved ? colors.primary : colors.foreground}
        name={viewerSaved ? "bookmark" : "bookmark-outline"}
        size={22}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.sm,
    borderWidth: borderWidths.thin,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  pressed: {
    opacity: 0.88,
  },
});
