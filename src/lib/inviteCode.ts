import { doc, getDoc } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";

import { auth, db } from "./firebase";

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
