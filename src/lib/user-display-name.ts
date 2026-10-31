export function resolveDisplayName(
  firstName: string | null | undefined,
  fullName: string | null | undefined,
  username: string | null | undefined,
): string {
  if (firstName?.trim()) {
    return firstName.trim();
  }
  if (fullName?.trim()) {
    return fullName.trim();
  }
  if (username?.trim()) {
    return username.trim();
  }
  return "Teacher";
}

export function formatMemberSince(createdAt: Date | null | undefined): string {
  if (!createdAt) {
    return "—";
  }
  return createdAt.toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
}
