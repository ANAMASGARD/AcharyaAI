import { resolveDisplayName } from "@/lib/user-display-name";
import { useUser } from "@clerk/expo";

export function useTeacherDisplayName(): string {
  const { user } = useUser();

  return resolveDisplayName(
    user?.firstName,
    user?.fullName,
    user?.username,
  );
}
