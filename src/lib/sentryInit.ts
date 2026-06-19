import * as Sentry from "@sentry/react-native";

/**
 * Production crash/error reporting. Set `EXPO_PUBLIC_SENTRY_DSN` in EAS secrets / env
 * for release builds. No-op when DSN is unset.
 */
export function initSentry(): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  const enableInDev = process.env.EXPO_PUBLIC_SENTRY_ENABLE_DEV === "1";

  Sentry.init({
    dsn,
    enabled: !__DEV__ || enableInDev,
    debug: __DEV__ && enableInDev,
    sendDefaultPii: false,
  });
}

/** Report React errors when Sentry is enabled (mirrors `initSentry` dev gating). */
export function captureClientError(
  error: Error,
  context?: Record<string, unknown>
): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  const enableInDev = process.env.EXPO_PUBLIC_SENTRY_ENABLE_DEV === "1";
  if (__DEV__ && !enableInDev) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

export { Sentry };
