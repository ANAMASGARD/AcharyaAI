import { useThemeStyles } from '@/theme/use-theme';
import type { ThemeColors } from '@/theme/colors';
import { borderWidths, radii } from "@/theme/tokens";
import type { CommunityPostImage } from "@/types/community";
import { Image } from "expo-image";
import {
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type StyleProp,
} from "react-native";

type Props = Readonly<{
  image: CommunityPostImage;
  style?: StyleProp<ImageStyle>;
  contentFit?: "cover" | "contain";
}>;

export function CommunityPostImageView({
  image,
  style,
  contentFit = "cover",
}: Props): React.ReactElement {
  const styles = useThemeStyles(createStyles);


  if (!image.uri) return <View style={[styles.placeholder, style]}><Text>Attachment unavailable on this device</Text></View>;
  return (
    <Image
      accessibilityLabel={image.fileName}
      contentFit={contentFit}
      source={image.uri ? { uri: image.uri } : undefined}
      style={[styles.image, style]}
    />
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  image: {
    backgroundColor: colors.muted,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: borderWidths.thin,
  },
  placeholder: {
    alignItems: "center",
    backgroundColor: colors.muted,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: borderWidths.thin,
    justifyContent: "center",
  },
});
