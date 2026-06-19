import { getAnalytics, isSupported, logEvent, type Analytics } from "firebase/analytics";
import { app } from "./firebase";

let analytics: Analytics | null = null;
let initPromise: Promise<void> | null = null;

export async function initAnalytics(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      if (await isSupported()) {
        analytics = getAnalytics(app);
      }
    } catch {
      analytics = null;
    }
  })();
  return initPromise;
}

export function trackEvent(
  name: string,
  params?: Record<string, string | number | boolean>
): void {
  if (!analytics) return;
  try {
    logEvent(analytics, name, params);
  } catch {
    // Analytics must never break app flows.
  }
}
