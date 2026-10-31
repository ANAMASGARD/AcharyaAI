import { RecorderPulseRing } from "@/components/recording/recorder-pulse-ring";
import { colors } from "@/theme/colors";
import { borderWidths, shadows } from "@/theme/tokens";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, View } from "react-native";

/** Bold Acharya yellow — full saturation even when disabled. */
const RECORD_BUTTON_YELLOW = "#FFCC00";

export const RECORDING_BUTTON_SIZE = 104;

type Props = Readonly<{
  isRecording: boolean;
  disabled?: boolean;
  onPress: () => void;
}>;

export function RecordingButton({
  isRecording,
  disabled = false,
  onPress,
}: Props): React.ReactElement {
  const isDisabled = disabled && !isRecording;

  return (
    <View style={styles.wrap}>
      <RecorderPulseRing active={isRecording} size={RECORDING_BUTTON_SIZE} />
      <Pressable
        accessibilityLabel={isRecording ? "Stop recording" : "Start recording"}
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled }}
        disabled={isDisabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.button,
          styles.buttonLayer,
          isRecording ? styles.buttonRecording : styles.buttonIdle,
          pressed && !isDisabled && styles.buttonPressed,
          isDisabled && styles.buttonDisabled,
        ]}
      >
        <MaterialCommunityIcons
          color={isRecording ? colors.destructiveForeground : colors.foreground}
          name={isRecording ? "close" : "play"}
          size={isRecording ? 40 : 36}
          style={!isRecording ? styles.playIcon : undefined}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: RECORDING_BUTTON_SIZE / 2,
    borderWidth: borderWidths.default,
    height: RECORDING_BUTTON_SIZE,
    justifyContent: "center",
    width: RECORDING_BUTTON_SIZE,
    ...shadows.lg,
  },
  buttonDisabled: {
    opacity: 1,
  },
  buttonIdle: {
    backgroundColor: RECORD_BUTTON_YELLOW,
  },
  buttonLayer: {
    zIndex: 2,
  },
  buttonPressed: {
    transform: [{ translateX: 2 }, { translateY: 2 }],
    ...shadows.sm,
  },
  buttonRecording: {
    backgroundColor: colors.destructive,
  },
  playIcon: {
    marginLeft: 5,
  },
  wrap: {
    alignItems: "center",
    height: RECORDING_BUTTON_SIZE,
    justifyContent: "center",
    overflow: "visible",
    position: "relative",
    width: RECORDING_BUTTON_SIZE,
  },
});
