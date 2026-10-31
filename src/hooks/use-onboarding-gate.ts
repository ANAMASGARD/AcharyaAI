import { useEffect, useState } from 'react';

import { getOnboardingCompleted } from '@/lib/onboarding-persistence';

type OnboardingGateState = {
  isReady: boolean;
  hasCompletedOnboarding: boolean;
};

export function useOnboardingGate(): OnboardingGateState {
  const [state, setState] = useState<OnboardingGateState>({
    isReady: false,
    hasCompletedOnboarding: false,
  });

  useEffect(() => {
    let cancelled = false;

    void getOnboardingCompleted().then((hasCompletedOnboarding) => {
      if (!cancelled) {
        setState({ isReady: true, hasCompletedOnboarding });
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
