import { doc, writeBatch } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";

import { auth, app, db } from "./firebase";
import { pruneFriendFromAllGroups } from "./friendGroups";
import {
  friendsListCacheByUser,
  pruneSocialCachesToFriendIds,
} from "./socialCache";

const functions = getFunctions(app, "us-central1");

function pruneRemovedFriendFromCache(viewerId: string, removedFriendId: string) {
  const remaining = new Set(
    (friendsListCacheByUser[viewerId] ?? [])
      .map((f) => f.id)
      .filter((id) => id !== removedFriendId)
  );
  pruneSocialCachesToFriendIds(viewerId, remaining);
}

async function removeFriendMutualClient(uid: string, otherUid: string) {
  const batch = writeBatch(db);
  batch.delete(doc(db, "users", uid, "friends", otherUid));
  batch.delete(doc(db, "users", otherUid, "friends", uid));
  batch.delete(doc(db, "users", uid, "friendRequests", otherUid));
  batch.delete(doc(db, "users", otherUid, "friendRequests", uid));
  batch.delete(doc(db, "users", uid, "outgoingFriendRequests", otherUid));
  await batch.commit();
  await pruneFriendFromAllGroups(uid, otherUid);
}

/** Removes friendship on both sides; client writes first for speed, server callable for extra cleanup. */
export async function removeFriendMutual(otherUid: string): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid || !otherUid || otherUid === uid) {
    throw new Error("Invalid friend.");
  }

  try {
    await removeFriendMutualClient(uid, otherUid);
    pruneRemovedFriendFromCache(uid, otherUid);
  } catch (clientErr) {
    try {
      const fn = httpsCallable(functions, "removeFriendMutual");
      await fn({ otherUid });
      pruneRemovedFriendFromCache(uid, otherUid);
    } catch (callableErr: unknown) {
      throw clientErr ?? callableErr;
    }
    return;
  }

  // Best-effort server cleanup the client cannot do (other user's outgoing index + group membership).
  void httpsCallable(functions, "removeFriendMutual")({ otherUid }).catch(() => {});
}

export function removeFriendMutualErrorMessage(err: unknown): string {
  const code = String((err as { code?: string })?.code || "");
  const msg = String((err as { message?: string })?.message || err || "");

  if (code.includes("unauthenticated")) {
    return "Please sign in again and try removing this friend.";
  }
  if (code.includes("permission-denied")) {
    return "You don't have permission to remove this friend.";
  }
  if (msg.trim()) return msg.trim();
  return "Please check your connection and try again.";
}
