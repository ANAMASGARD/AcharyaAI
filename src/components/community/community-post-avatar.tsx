import { images } from "@/constants/images";
import { colors } from "@/theme/colors";
import { borderWidths, radii } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import { useUser } from "@clerk/expo";
import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";

const ACHARYA_CLERK_ID = "demo:acharya";

type Props = Readonly<{
  authorClerkId: string;
  authorDisplayName: string;
  authorAvatarLetter: string;
  authorImageUrl?: string | null;
  demoWelcome?: boolean;
  size?: number;
}>;

export function CommunityPostAvatar({
  authorClerkId,
  authorDisplayName,
  authorAvatarLetter,
  authorImageUrl = null,
  demoWelcome = false,
  size = 36,
}: Props): React.ReactElement {
  const { user } = useUser();
  const isAcharya =
    demoWelcome ||
    authorClerkId === ACHARYA_CLERK_ID ||
    authorDisplayName.toLowerCase() === "acharya";

  const isCurrentUser = Boolean(user?.id && authorClerkId === user.id);
  const profileImageUrl =
    authorImageUrl?.trim() ||
    (isCurrentUser ? (user?.imageUrl ?? null) : null);

  const shellStyle = {
    width: size,
    height: size,
    borderRadius: radii.sm,
  };

  if (isAcharya) {
    const acharyaSize = Math.max(size, 44);

    return (
      <View
        style={[
          styles.avatar,
          styles.acharyaAvatar,
          {
            width: acharyaSize,
            height: acharyaSize,
            borderRadius: radii.sm,
          },
        ]}
      >
        <Image
          accessibilityLabel="Acharya"
          contentFit="contain"
          source={images.mascotLogo}
          style={styles.acharyaLogo}
        />
      </View>
    );
  }

  if (profileImageUrl) {
    return (
      <Image
        accessibilityLabel={authorDisplayName}
        contentFit="cover"
        source={{ uri: profileImageUrl }}
        style={[styles.avatar, shellStyle]}
      />
    );
  }

  return (
    <View style={[styles.avatar, shellStyle, styles.letterAvatar]}>
      <Text style={[styles.letter, { fontSize: size * 0.42 }]}>
        {authorAvatarLetter}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  acharyaAvatar: {
    alignItems: "center",
    backgroundColor: colors.primary,
    justifyContent: "center",
    padding: 2,
  },
  acharyaLogo: {
    height: "92%",
    width: "92%",
  },
  avatar: {
    borderColor: colors.border,
    borderWidth: borderWidths.thin,
    overflow: "hidden",
  },
  letter: {
    color: colors.foreground,
    fontFamily: fontFamilies.head,
    lineHeight: 20,
  },
  letterAvatar: {
    alignItems: "center",
    backgroundColor: colors.sky,
    justifyContent: "center",
  },
});
