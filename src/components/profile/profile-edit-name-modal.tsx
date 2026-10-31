import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { isClerkAPIResponseError, useUser } from "@clerk/expo";
import { colors } from "@/theme/colors";
import { borderWidths, radii, spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type Props = Readonly<{
  visible: boolean;
  onClose: () => void;
}>;

export function ProfileEditNameModal(props: Props): React.ReactElement | null {
  return props.visible ? <EditNameForm {...props} /> : null;
}

function EditNameForm({
  visible,
  onClose,
}: Props): React.ReactElement {
  const { user } = useUser();
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (): Promise<void> => {
    if (!user) {
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await user.update({
        firstName: firstName.trim() || null,
        lastName: lastName.trim() || null,
      });
      await user.reload();
      onClose();
    } catch (err) {
      if (isClerkAPIResponseError(err)) {
        setError(
          err.errors[0]?.longMessage ?? err.errors[0]?.message ?? "Update failed.",
        );
      } else {
        setError("Could not update your name. Try again.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      animationType="slide"
      onRequestClose={() => { if (!isSaving) onClose(); }}
      transparent
      visible={visible}
    >
      <KeyboardAvoidingView behavior="padding" style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Edit name</Text>

          <Text style={styles.fieldLabel}>First name</Text>
          <TextInput
            editable={!isSaving}
            autoCapitalize="words"
            onChangeText={setFirstName}
            placeholder="First name"
            placeholderTextColor={colors.mutedForeground}
            style={styles.input}
            value={firstName}
          />

          <Text style={styles.fieldLabel}>Last name</Text>
          <TextInput
            editable={!isSaving}
            autoCapitalize="words"
            onChangeText={setLastName}
            placeholder="Last name"
            placeholderTextColor={colors.mutedForeground}
            style={styles.input}
            value={lastName}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={isSaving}
              onPress={onClose}
              style={({ pressed }) => [
                styles.buttonSecondary,
                pressed ? styles.pressed : null,
              ]}
            >
              <Text style={styles.buttonSecondaryText}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={isSaving}
              onPress={() => {
                void handleSave();
              }}
              style={({ pressed }) => [
                styles.buttonPrimary,
                pressed ? styles.pressed : null,
                isSaving ? styles.disabled : null,
              ]}
            >
              {isSaving ? (
                <ActivityIndicator color={colors.primaryForeground} size="small" />
              ) : (
                <Text style={styles.buttonPrimaryText}>Save</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  backdrop: {
    backgroundColor: "rgba(0,0,0,0.45)",
    flex: 1,
    justifyContent: "flex-end",
  },
  buttonPrimary: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: borderWidths.thin,
    flex: 1,
    justifyContent: "center",
    minHeight: 48,
  },
  buttonPrimaryText: {
    color: colors.primaryForeground,
    fontFamily: fontFamilies.head,
    fontSize: 16,
  },
  buttonSecondary: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: borderWidths.thin,
    flex: 1,
    justifyContent: "center",
    minHeight: 48,
  },
  buttonSecondaryText: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansMedium,
    fontSize: 16,
  },
  disabled: {
    opacity: 0.6,
  },
  error: {
    color: colors.destructive,
    fontFamily: fontFamilies.sans,
    fontSize: 14,
    marginTop: spacing.sm,
  },
  fieldLabel: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansMedium,
    fontSize: 14,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.cream,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: borderWidths.thin,
    color: colors.foreground,
    fontFamily: fontFamilies.sans,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  pressed: {
    opacity: 0.9,
  },
  sheet: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderWidth: borderWidths.thin,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  title: {
    color: colors.foreground,
    fontFamily: fontFamilies.head,
    fontSize: 22,
    lineHeight: 28,
  },
});
