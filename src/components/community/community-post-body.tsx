import { colors } from "@/theme/colors";
import { borderWidths, radii, spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import { Platform, StyleSheet, Text, View } from "react-native";

type Props = Readonly<{
  body: string;
  variant?: "preview" | "full";
  maxPreviewLines?: number;
}>;

const monospace = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "monospace",
});

function isSectionHeading(line: string): boolean {
  const trimmed = line.trim();

  return (
    trimmed.startsWith("━━") ||
    (trimmed.length > 0 &&
      trimmed === trimmed.toUpperCase() &&
      trimmed.includes("—"))
  );
}

function isAsciiArtLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) {
    return false;
  }

  if (/[╔╗╚╝║═╭╮╰╯┌┐└┘├┤┬┴│─]/.test(trimmed)) {
    return true;
  }

  const artChars = trimmed.replace(/[\s/_\\|+\-*=.]/g, "");
  return artChars.length === 0 && trimmed.length > 2;
}

function isBulletLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("•") || trimmed.startsWith("│ •");
}

export function CommunityPostBody({
  body,
  variant = "full",
  maxPreviewLines = 3,
}: Props): React.ReactElement {
  const lines = body.split("\n").filter((line, index, all) => {
    if (line.trim().length > 0) {
      return true;
    }

    return index > 0 && all[index - 1]?.trim().length > 0;
  });

  const previewLines =
    variant === "preview" ? lines.slice(0, maxPreviewLines) : lines;

  return (
    <View style={variant === "full" ? styles.fullWrap : styles.previewWrap}>
      {previewLines.map((line, index) => {
        const trimmed = line.trim();

        if (!trimmed) {
          return <View key={`gap-${index}`} style={styles.gap} />;
        }

        if (isAsciiArtLine(line)) {
          return (
            <Text
              key={`${index}-${trimmed}`}
              selectable
              style={styles.asciiLine}
            >
              {line}
            </Text>
          );
        }

        if (isSectionHeading(trimmed)) {
          return (
            <Text
              key={`${index}-${trimmed}`}
              style={[
                styles.sectionHeading,
                trimmed.startsWith("━━") && styles.sectionRule,
              ]}
            >
              {trimmed}
            </Text>
          );
        }

        if (isBulletLine(line)) {
          return (
            <Text key={`${index}-${trimmed}`} style={styles.bulletLine}>
              {trimmed.replace(/^│\s*/, "")}
            </Text>
          );
        }

        return (
          <Text key={`${index}-${trimmed}`} style={styles.bodyLine}>
            {line}
          </Text>
        );
      })}

      {variant === "preview" && lines.length > maxPreviewLines ? (
        <Text style={styles.readMore}>Tap to read full post →</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  asciiLine: {
    color: colors.foreground,
    fontFamily: monospace,
    fontSize: 11,
    letterSpacing: 0,
    lineHeight: 14,
    marginTop: 1,
  },
  bodyLine: {
    color: colors.foreground,
    fontFamily: fontFamilies.sans,
    fontSize: 15,
    lineHeight: 23,
    marginTop: 2,
  },
  bulletLine: {
    color: colors.foreground,
    fontFamily: fontFamilies.sans,
    fontSize: 14,
    lineHeight: 21,
    marginLeft: spacing.xs,
    marginTop: 1,
  },
  fullWrap: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: borderWidths.thin,
    gap: 2,
    marginTop: spacing.md,
    padding: spacing.lg,
  },
  gap: {
    height: spacing.sm,
  },
  previewWrap: {
    marginTop: spacing.sm,
  },
  readMore: {
    color: colors.mutedForeground,
    fontFamily: fontFamilies.sansMedium,
    fontSize: 13,
    lineHeight: 18,
    marginTop: spacing.sm,
  },
  sectionHeading: {
    color: colors.foreground,
    fontFamily: fontFamilies.head,
    fontSize: 15,
    lineHeight: 21,
    marginTop: spacing.md,
  },
  sectionRule: {
    color: colors.mutedForeground,
    fontFamily: fontFamilies.sans,
    fontSize: 12,
    letterSpacing: 0.5,
    lineHeight: 16,
    marginTop: spacing.sm,
  },
});
