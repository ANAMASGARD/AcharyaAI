import { CommunityPostImageView } from "@/components/community/community-post-image";
import { spacing } from "@/theme/tokens";
import type { CommunityPostImage } from "@/types/community";
import { ScrollView, StyleSheet, View, type ImageStyle } from "react-native";

type Props = Readonly<{
  images: readonly CommunityPostImage[];
  variant?: "card" | "detail";
}>;

export function CommunityPostImages({
  images,
  variant = "card",
}: Props): React.ReactElement | null {
  if (images.length === 0) {
    return null;
  }

  if (variant === "detail") {
    return (
      <ScrollView
        contentContainerStyle={styles.detailRow}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {images.map((image) => (
          <CommunityPostImageView
            key={image.imageId}
            contentFit="contain"
            image={image}
            style={styles.detailImage}
          />
        ))}
      </ScrollView>
    );
  }

  const preview = images[0];

  return (
    <View style={styles.cardWrap}>
      <CommunityPostImageView image={preview} style={styles.cardImage} />
      {images.length > 1 ? (
        <View style={styles.moreBadge}>
          <CommunityPostImageView
            image={images[1]}
            style={styles.cardImageSecondary}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cardImage: {
    height: 160,
    width: "100%",
  } satisfies ImageStyle,
  cardImageSecondary: {
    height: 160,
    opacity: 0.35,
    width: "100%",
  } satisfies ImageStyle,
  cardWrap: {
    marginTop: spacing.sm,
    position: "relative",
  },
  detailImage: {
    height: 220,
    width: 280,
  } satisfies ImageStyle,
  detailRow: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  moreBadge: {
    ...StyleSheet.absoluteFill,
    pointerEvents: "none",
  },
});
