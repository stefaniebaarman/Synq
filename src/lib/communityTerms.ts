import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

export const COMMUNITY_TERMS_VERSION = "2026-05";
export const PRE_AUTH_TERMS_KEY = "synq:preAuthTermsAccepted";

export async function getPreAuthTermsAccepted(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(PRE_AUTH_TERMS_KEY);
    return v === COMMUNITY_TERMS_VERSION;
  } catch {
    return false;
  }
}

export async function setPreAuthTermsAccepted(): Promise<void> {
  await AsyncStorage.setItem(PRE_AUTH_TERMS_KEY, COMMUNITY_TERMS_VERSION);
}

export async function persistCommunityTermsAcceptance(uid: string): Promise<void> {
  const ref = doc(db, "users", uid);
  await setDoc(
    ref,
    {
      communityTermsAcceptedAt: serverTimestamp(),
      communityTermsVersion: COMMUNITY_TERMS_VERSION,
    },
    { merge: true }
  );
}

export function userHasAcceptedCommunityTerms(data: Record<string, unknown> | undefined): boolean {
  if (!data) return false;
  const version = data.communityTermsVersion;
  if (version === COMMUNITY_TERMS_VERSION) return true;
  return !!data.communityTermsAcceptedAt;
}
