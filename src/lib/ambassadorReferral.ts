import { SYNQ_SHARE_WEB_BASE } from "@/constants/Variables";
import { trackEvent } from "@/src/lib/analytics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { getFunctions, httpsCallable } from "firebase/functions";
import { Platform } from "react-native";
import {
  buildAmbassadorShareWebUrl as buildWebUrlCore,
  isValidAmbassadorCodeShape,
  normalizeAmbassadorCode,
  parseAmbassadorCodeFromClipboard,
  parseAmbassadorCodeFromReferrer,
  parseAmbassadorCodeFromUrl as parseCodeFromUrlCore,
} from "./ambassadorReferralCore.js";

export const PENDING_AMBASSADOR_CODE_KEY = "synq:pendingAmbassadorCode";
export const PENDING_AMBASSADOR_METHOD_KEY = "synq:pendingAmbassadorMethod";
export const AMBASSADOR_RECOVERY_DONE_KEY = "synq:ambassadorRecoveryDone";

export type AmbassadorAttributionMethod =
  | "universal_link"
  | "clipboard"
  | "play_referrer"
  | "manual";

export {
  isValidAmbassadorCodeShape,
  normalizeAmbassadorCode,
  parseAmbassadorCodeFromClipboard,
  parseAmbassadorCodeFromReferrer,
};

export function buildAmbassadorShareWebUrl(code: string): string {
  return buildWebUrlCore(SYNQ_SHARE_WEB_BASE, code);
}

export function parseAmbassadorCodeFromUrl(url: string): string | null {
  return parseCodeFromUrlCore(url);
}

export async function stashPendingAmbassadorCode(
  code: string,
  method: AmbassadorAttributionMethod = "universal_link"
): Promise<void> {
  const normalized = normalizeAmbassadorCode(code);
  if (!isValidAmbassadorCodeShape(normalized)) return;
  await AsyncStorage.multiSet([
    [PENDING_AMBASSADOR_CODE_KEY, normalized],
    [PENDING_AMBASSADOR_METHOD_KEY, method],
  ]);
}

export async function clearPendingAmbassadorCode(): Promise<void> {
  await AsyncStorage.multiRemove([
    PENDING_AMBASSADOR_CODE_KEY,
    PENDING_AMBASSADOR_METHOD_KEY,
  ]);
}

async function readPlayInstallReferrer(): Promise<string | null> {
  if (Platform.OS !== "android") return null;
  try {
    // Optional native module — no-ops until a native build includes it.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("react-native-play-install-referrer") as {
      PlayInstallReferrer?: {
        getInstallReferrerInfo: (
          callback: (
            info: { installReferrer?: string } | null,
            error: unknown
          ) => void
        ) => void;
      };
    };
    if (!mod.PlayInstallReferrer?.getInstallReferrerInfo) return null;
    return await new Promise((resolve) => {
      try {
        mod.PlayInstallReferrer!.getInstallReferrerInfo((info, error) => {
          if (error || !info) {
            resolve(null);
            return;
          }
          resolve(String(info.installReferrer || "").trim() || null);
        });
      } catch {
        resolve(null);
      }
    });
  } catch {
    return null;
  }
}

/**
 * One-shot deferred recovery after a fresh install (clipboard + Play referrer).
 * Does not overwrite an existing pending ambassador code from a deep link.
 */
export async function recoverAmbassadorCodeOnce(): Promise<void> {
  try {
    const already = await AsyncStorage.getItem(AMBASSADOR_RECOVERY_DONE_KEY);
    if (already === "1") return;

    const existing = await AsyncStorage.getItem(PENDING_AMBASSADOR_CODE_KEY);
    if (existing && isValidAmbassadorCodeShape(normalizeAmbassadorCode(existing))) {
      await AsyncStorage.setItem(AMBASSADOR_RECOVERY_DONE_KEY, "1");
      return;
    }

    if (Platform.OS === "android") {
      const referrer = await readPlayInstallReferrer();
      const fromReferrer = referrer
        ? parseAmbassadorCodeFromReferrer(referrer)
        : null;
      if (fromReferrer) {
        await stashPendingAmbassadorCode(fromReferrer, "play_referrer");
        await AsyncStorage.setItem(AMBASSADOR_RECOVERY_DONE_KEY, "1");
        return;
      }
    }

    try {
      const clip = await Clipboard.getStringAsync();
      const fromClip = parseAmbassadorCodeFromClipboard(clip);
      if (fromClip) {
        await stashPendingAmbassadorCode(fromClip, "clipboard");
      }
    } catch {
      // Clipboard permission / empty — ignore
    }

    await AsyncStorage.setItem(AMBASSADOR_RECOVERY_DONE_KEY, "1");
  } catch {
    // Recovery must never block boot
  }
}

export async function claimPendingAmbassadorReferral(): Promise<{
  claimed: boolean;
  status?: string;
  code?: string;
} | null> {
  const codeRaw = await AsyncStorage.getItem(PENDING_AMBASSADOR_CODE_KEY);
  const methodRaw = await AsyncStorage.getItem(PENDING_AMBASSADOR_METHOD_KEY);
  const code = normalizeAmbassadorCode(codeRaw || "");
  if (!isValidAmbassadorCodeShape(code)) {
    await clearPendingAmbassadorCode();
    return null;
  }
  const method = (methodRaw || "universal_link") as AmbassadorAttributionMethod;

  try {
    const functions = getFunctions(undefined, "us-central1");
    const claimAmbassadorReferral = httpsCallable(functions, "claimAmbassadorReferral");
    const result = await claimAmbassadorReferral({ code, method });
    const data = (result.data || {}) as {
      ok?: boolean;
      status?: string;
      code?: string;
    };
    await clearPendingAmbassadorCode();
    if (data.status === "attributed") {
      trackEvent("ambassador_signup_attributed", { code });
    }
    return {
      claimed: data.status === "attributed",
      status: data.status,
      code: data.code || code,
    };
  } catch (err: unknown) {
    const codeStr = String((err as { code?: string })?.code || "");
    const shouldDrop =
      codeStr.includes("invalid-argument") ||
      codeStr.includes("failed-precondition") ||
      codeStr.includes("not-found");
    if (shouldDrop) {
      await clearPendingAmbassadorCode();
      return { claimed: false, status: "dropped", code };
    }
    throw err;
  }
}
