/**
 * Firebase App Check init for Synq.
 *
 * Phone Auth abuse protection: enable App Check providers in Firebase Console
 * (DeviceCheck / App Attest on iOS, Play Integrity on Android), then enforce
 * App Check on Authentication. Client tokens attach once initializeAppCheck runs.
 *
 * Set EXPO_PUBLIC_FIREBASE_APPCHECK_SITE_KEY for web (reCAPTCHA v3).
 * Set EXPO_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN in __DEV__ to register a debug
 * provider while native attestation is configured.
 */
import { ENV_VARS } from "./config.js";
import { app } from "./firebase";
import { Platform } from "react-native";

let initPromise: Promise<void> | null = null;

function env(key: string): string {
  const v =
    typeof process !== "undefined" && process.env?.[key]
      ? String(process.env[key]).trim()
      : "";
  return v;
}

export function initAppCheck(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const {
        initializeAppCheck,
        ReCaptchaV3Provider,
        CustomProvider,
      } = await import("firebase/app-check");

      const siteKey = env("EXPO_PUBLIC_FIREBASE_APPCHECK_SITE_KEY");
      const debugToken = env("EXPO_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN");

      if (Platform.OS === "web" && siteKey) {
        initializeAppCheck(app, {
          provider: new ReCaptchaV3Provider(siteKey),
          isTokenAutoRefreshEnabled: true,
        });
        return;
      }

      if (__DEV__ && debugToken) {
        // Debug provider for development builds while DeviceCheck / Play Integrity
        // are registered in Firebase Console for production.
        (globalThis as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN =
          debugToken;
        initializeAppCheck(app, {
          provider: new CustomProvider({
            getToken: async () => ({
              token: debugToken,
              expireTimeMillis: Date.now() + 60 * 60 * 1000,
            }),
          }),
          isTokenAutoRefreshEnabled: true,
        });
        return;
      }

      // Production native: App Check tokens come from Console-registered DeviceCheck /
      // Play Integrity once a native App Check provider is added to the build.
      // Until then, SMS is still capped by client cooldown + daily device limit.
      void ENV_VARS.projectId;
    } catch {
      // App Check optional until Console providers + native modules are wired.
    }
  })();

  return initPromise;
}
