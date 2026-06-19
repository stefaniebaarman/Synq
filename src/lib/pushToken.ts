import { deleteField, doc, updateDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

/** Clear push token on sign-out so stale devices stop receiving notifications. */
export async function clearPushTokenOnSignOut(): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  try {
    await updateDoc(doc(db, "users", uid), { pushToken: deleteField() });
  } catch {
    // Best-effort; sign-out should still proceed.
  }
}
