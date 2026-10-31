import type { Href } from "expo-router";

export function resolvePostIdParam(
  raw: string | string[] | undefined,
): string | null {
  if (typeof raw === "string" && raw.trim()) {
    try {
      return decodeURIComponent(raw.trim());
    } catch {
      return raw.trim();
    }
  }

  if (Array.isArray(raw) && typeof raw[0] === "string" && raw[0].trim()) {
    try {
      return decodeURIComponent(raw[0].trim());
    } catch {
      return raw[0].trim();
    }
  }

  return null;
}

export function communityPostPath(postId: string): Href {
  return `/community/post/${encodeURIComponent(postId)}` as Href;
}
