import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, getDoc } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";

import { auth, db } from "./firebase";

const ONBOARDING_INVITE_DONE_PREFIX = "synq:onboardingInviteDone:";

function onboardingInviteDoneKey(uid: string): string {
  return `${ONBOARDING_INVITE_DONE_PREFIX}${uid}`;
}

/** One-shot per user: invite onboarding finished (or skipped). */
export async function markOnboardingInviteDone(): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  try {
    await AsyncStorage.setItem(onboardingInviteDoneKey(uid), "1");
    // Clear legacy device-wide key from earlier builds.
    await AsyncStorage.removeItem("synq:onboardingInviteDone");
  } catch {
    // Best-effort; not completing the flag only risks a rare re-show.
  }
}

export async function isOnboardingInviteDone(uid?: string): Promise<boolean> {
  const id = uid || auth.currentUser?.uid;
  if (!id) return false;
  try {
    const raw = await AsyncStorage.getItem(onboardingInviteDoneKey(id));
    return raw === "1";
  } catch {
    return false;
  }
}

export async function fetchOrCreateInviteCode(): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error("Not signed in");
  }

  const userSnap = await getDoc(doc(db, "users", uid));
  const existing = String(userSnap.data()?.inviteCode || "")
    .trim()
    .toUpperCase();
  if (existing) return existing;

  const functions = getFunctions(undefined, "us-central1");
  const getOrCreateInviteCode = httpsCallable(functions, "getOrCreateInviteCode");
  const result = await getOrCreateInviteCode({});
  const code = String((result.data as { inviteCode?: unknown })?.inviteCode || "")
    .trim()
    .toUpperCase();
  if (!code) {
    throw new Error("Could not create invite code.");
  }
  return code;
}
