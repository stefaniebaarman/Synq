import AsyncStorage from "@react-native-async-storage/async-storage";
import { FirebaseError } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app, auth } from "./firebase";

const functions = getFunctions(app, "us-central1");
const sendSynqNudgeFn = httpsCallable<{ toUserId: string }, { ok: boolean }>(
  functions,
  "sendSynqNudge"
);

export const SYNQ_NUDGE_COOLDOWN_MS = 4 * 60 * 60 * 1000;

export function nudgeSentStorageKey(viewerId: string, friendId: string) {
  return `synq-nudge-sent:${viewerId}:${friendId}`;
}

export function parseNudgeSentAt(stored: string | null): number | null {
  if (!stored) return null;
  if (stored === "1") return null;
  const ms = Number(stored);
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return ms;
}

export function isNudgeCooldownActive(sentAtMs: number | null): boolean {
  if (sentAtMs == null) return false;
  return Date.now() - sentAtMs < SYNQ_NUDGE_COOLDOWN_MS;
}

export function nudgeCooldownRemainingMs(sentAtMs: number | null): number {
  if (sentAtMs == null) return 0;
  return Math.max(0, SYNQ_NUDGE_COOLDOWN_MS - (Date.now() - sentAtMs));
}

export async function readNudgeSentState(storageKey: string): Promise<{
  sent: boolean;
  sentAtMs: number | null;
}> {
  const value = await AsyncStorage.getItem(storageKey);
  const sentAtMs = parseNudgeSentAt(value);
  const sent = isNudgeCooldownActive(sentAtMs);
  if (value && !sent) {
    await AsyncStorage.removeItem(storageKey);
  }
  return { sent, sentAtMs };
}

export async function persistNudgeSent(
  storageKey: string,
  sentAtMs = Date.now()
): Promise<void> {
  await AsyncStorage.setItem(storageKey, String(sentAtMs));
}

export function synqNudgeErrorMessage(err: unknown): string {
  if (err instanceof FirebaseError) {
    switch (err.code) {
      case "functions/failed-precondition":
        return err.message || "You can't ask this friend right now.";
      case "functions/resource-exhausted":
        return err.message || "You can ask this friend again in a few hours.";
      case "functions/permission-denied":
        return "You can only ask friends.";
      case "functions/unauthenticated":
        return "Sign in to ask if a friend is free.";
      default:
        return err.message || "Could not send.";
    }
  }
  if (err instanceof Error && err.message) return err.message;
  return "Could not send.";
}

export async function sendSynqNudge(toUserId: string): Promise<void> {
  await sendSynqNudgeFn({ toUserId });
}

/** Prefetch auth so the first nudge tap does not wait on getIdToken. */
export function warmSynqNudgeClient(): void {
  void auth.currentUser?.getIdToken().catch(() => {});
}
