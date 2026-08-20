import { doc, getDoc } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";

import { auth, db } from "./firebase";

export async function fetchOrCreateCommunityShareCode(groupId: string): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error("Not signed in");
  }
  const id = String(groupId || "").trim();
  if (!id) {
    throw new Error("Community not found.");
  }

  const groupSnap = await getDoc(doc(db, "communityGroups", id));
  if (!groupSnap.exists()) {
    throw new Error("Community not found.");
  }
  const existing = String(groupSnap.data()?.shareCode || "")
    .trim()
    .toUpperCase();
  if (existing) return existing;

  const functions = getFunctions(undefined, "us-central1");
  const getOrCreate = httpsCallable(functions, "getOrCreateCommunityShareCode");
  const result = await getOrCreate({ groupId: id });
  const code = String((result.data as { shareCode?: unknown })?.shareCode || "")
    .trim()
    .toUpperCase();
  if (!code) {
    throw new Error("Could not create share link.");
  }
  return code;
}
