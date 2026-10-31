import { resolveDisplayName } from "@/lib/user-display-name";
import { useAuth, useUser } from "@clerk/expo";

type HomeGreetingResult = {
  isLoaded: boolean;
  displayName: string | null;
  greetingText: string;
};

export function useHomeGreeting(): HomeGreetingResult {
  const { isLoaded: isAuthLoaded } = useAuth();
  const { isLoaded: isUserLoaded, user } = useUser();

  const isLoaded = isAuthLoaded && isUserLoaded;

  const displayName = isLoaded
    ? resolveDisplayName(
        user?.firstName,
        user?.fullName,
        user?.username,
      )
    : null;

  const greetingText = displayName
    ? `Namaste, ${displayName}!`
    : "Namaste!";

  return {
    isLoaded,
    displayName,
    greetingText,
  };
}
