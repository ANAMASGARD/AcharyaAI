import { colors } from "@/theme/colors";
import { borderWidths, radii, shadows, spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

const AVATAR_SIZE = 96;

type Props = Readonly<{
  displayName: string;
  imageUrl: string | null;
  isUploadingPhoto: boolean;
  photoError: string | null;
  onPickPhoto: () => void;
}>;

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "A";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function ProfileHeader({
  displayName,
  imageUrl,
  isUploadingPhoto,
  photoError,
  onPickPhoto,
}: Props): React.ReactElement {
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityLabel="Change profile photo"
        accessibilityRole="button"
        onPress={onPickPhoto}
        style={({ pressed }) => [styles.avatarWrap, pressed ? styles.pressed : null]}
      >
        {imageUrl ? (
          <Image
            accessibilityLabel="Profile photo"
            contentFit="cover"
            source={{ uri: imageUrl }}
            style={styles.avatar}
          />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.initials}>{getInitials(displayName)}</Text>
          </View>
        )}
        {isUploadingPhoto ? (
          <View style={styles.avatarOverlay}>
            <ActivityIndicator color={colors.primaryForeground} size="small" />
          </View>
        ) : (
          <View style={styles.cameraBadge}>
            <MaterialCommunityIcons
              color={colors.foreground}
              name="camera"
              size={18}
            />
          </View>
        )}
      </Pressable>

      <Text style={styles.name}>{displayName}</Text>

      {photoError ? <Text style={styles.photoError}>{photoError}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: borderWidths.thin,
    height: AVATAR_SIZE,
    width: AVATAR_SIZE,
  },
  avatarFallback: {
    alignItems: "center",
    backgroundColor: colors.primary,
    justifyContent: "center",
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
    borderRadius: radii.lg,
    justifyContent: "center",
  },
  avatarWrap: {
    marginBottom: spacing.md,
    position: "relative",
  },
  cameraBadge: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.sm,
    borderWidth: borderWidths.thin,
    bottom: -4,
    height: 32,
    justifyContent: "center",
    position: "absolute",
    right: -4,
    width: 32,
    ...shadows.sm,
  },
  header: {
    alignItems: "center",
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  initials: {
    color: colors.foreground,
    fontFamily: fontFamilies.head,
    fontSize: 32,
  },
  name: {
    color: colors.foreground,
    fontFamily: fontFamilies.head,
    fontSize: 26,
    lineHeight: 32,
    textAlign: "center",
  },
  photoError: {
    color: colors.destructive,
    fontFamily: fontFamilies.sans,
    fontSize: 13,
    marginTop: spacing.sm,
    textAlign: "center",
  },
  pressed: {
    opacity: 0.88,
  },
});
