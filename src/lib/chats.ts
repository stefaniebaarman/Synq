import { deleteDoc, doc } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";

import { auth, app, db } from "./firebase";

const functions = getFunctions(app, "us-central1");

async function deleteChatDoc(chatId: string): Promise<void> {
  await deleteDoc(doc(db, "chats", chatId));
}

export async function deleteChat(chatId: string): Promise<void> {
  if (!auth.currentUser) {
    throw new Error("Not signed in.");
  }

  try {
    const fn = httpsCallable(functions, "deleteChat");
    await fn({ chatId });
  } catch {
    await deleteChatDoc(chatId);
  }
}
