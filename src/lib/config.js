/**
 * Client-side config. Non-public secrets belong in EAS secrets as EXPO_PUBLIC_* vars.
 * Firebase web API keys are public by design (restricted in Google Cloud Console).
 */
function env(key, fallback = "") {
  const v = typeof process !== "undefined" && process.env?.[key];
  return v != null && String(v).trim() !== "" ? String(v) : fallback;
}

export const ENV_VARS = {
  apiKey: env("EXPO_PUBLIC_FIREBASE_API_KEY", "AIzaSyBzK33ZgMb4IPGCe1D7UDkubVh4oAnApfk"),
  authDomain: env(
    "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "auth.synqapp.com"
  ),
  projectId: env("EXPO_PUBLIC_FIREBASE_PROJECT_ID", "new-synq-main"),
  storageBucket: env(
    "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET",
    "new-synq-main.firebasestorage.app"
  ),
  messagingSenderId: env(
    "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
    "366744715505"
  ),
  appId: env(
    "EXPO_PUBLIC_FIREBASE_APP_ID",
    "1:366744715505:web:925f482de2eebbf3b36950"
  ),
  measurementId: env(
    "EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID",
    "G-Q9V19876RD"
  ),
  EXPO_PUBLIC_GOOGLE_MAPS_API_KEY: env("EXPO_PUBLIC_GOOGLE_MAPS_API_KEY", ""),
  GOOGLE_MAPS_API_KEY: env("EXPO_PUBLIC_GOOGLE_MAPS_API_KEY", ""),
};

/** Branded profile share links, e.g. https://join.synq.app/u/{inviteCode} */
export const SYNQ_SHARE_WEB_BASE = env(
  "EXPO_PUBLIC_SYNQ_SHARE_BASE",
  "https://new-synq-main.web.app"
).replace(/\/$/, "");

/** Hosted open / profile landing pages on the same domain as share links. */
export const SYNQ_OPEN_WEB_BASE = `${SYNQ_SHARE_WEB_BASE}/open`;

export function synqShareHostFromBase(base = SYNQ_SHARE_WEB_BASE) {
  try {
    return new URL(base).hostname;
  } catch {
    return "new-synq-main.web.app";
  }
}

export const SYNQ_SHARE_HOST = synqShareHostFromBase();
export const IOS_BUNDLE_ID = "com.stefaniebaarman.synq";
export const ANDROID_PACKAGE = "com.stefaniebaarman.synq";
