import { doc, updateDoc } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";

import { filterOrReject } from "./contentFilter";
import { auth, app, db } from "./firebase";

const functions = getFunctions(app, "us-central1");

const CUSTOM_NAME_MAX = 40;

/** Deletes a chat via the server callable (client Firestore deletes are denied by rules). */
export async function deleteChat(chatId: string): Promise<void> {
  if (!auth.currentUser) {
    throw new Error("Not signed in.");
  }

  const fn = httpsCallable(functions, "deleteChat");
  await fn({ chatId });
}

/** Renames a group chat (shared `customName` for all participants). */
export async function renameChat(chatId: string, name: string): Promise<void> {
  if (!auth.currentUser) {
    throw new Error("Not signed in.");
  }
  const id = String(chatId || "").trim();
  const trimmed = String(name || "").trim();
  if (!id) {
    throw new Error("Invalid chat.");
  }
  if (!trimmed) {
    throw new Error("Name is required.");
  }
  if (trimmed.length > CUSTOM_NAME_MAX) {
    throw new Error(`Name must be ${CUSTOM_NAME_MAX} characters or fewer.`);
  }
  const filtered = filterOrReject(trimmed);
  if (!filtered.ok) {
    throw new Error(filtered.reason);
  }

  await updateDoc(doc(db, "chats", id), { customName: trimmed });
}
