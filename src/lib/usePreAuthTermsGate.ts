import { router } from "expo-router";
import { useEffect, useState } from "react";
import { getPreAuthTermsAccepted } from "./communityTerms";

type PreAuthTermsGateOptions = {
  /** When false, skips the community-terms redirect (e.g. returning-user sign-in). */
  enabled?: boolean;
};

/** Redirects to community-terms if pre-auth acceptance is missing. */
export function usePreAuthTermsGate(
  next: "phone" | "login" | "email",
  options?: PreAuthTermsGateOptions
) {
  const enabled = options?.enabled ?? true;
  const [ready, setReady] = useState(!enabled);

  useEffect(() => {
    if (!enabled) {
      setReady(true);
      return;
    }
    let cancelled = false;
    (async () => {
      const accepted = await getPreAuthTermsAccepted();
      if (cancelled) return;
      if (!accepted) {
        router.replace(`/(auth)/community-terms?next=${next}`);
        return;
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [next, enabled]);

  return ready;
}
