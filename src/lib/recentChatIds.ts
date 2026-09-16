import { db } from "@/src/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";

const MAX_RECENT_CHAT_IDS = 20;

/**
 * Remember a chat the viewer participates in so Firestore rules can allow
 * opening co-participant profiles (e.g. non-friends in a group chat).
 */
export async function rememberRecentChatId(
  userId: string,
  chatId: string
): Promise<void> {
  const uid = String(userId || "").trim();
  const id = String(chatId || "").trim();
  if (!uid || !id || id === "__pending__") return;

  const ref = doc(db, "users", uid);
  try {
    const snap = await getDoc(ref);
    const prevRaw = snap.exists()
      ? (snap.data() as { recentChatIds?: unknown }).recentChatIds
      : undefined;
    const prev = Array.isArray(prevRaw)
      ? prevRaw.map((x) => String(x || "").trim()).filter(Boolean)
      : [];
    const next = [id, ...prev.filter((x) => x !== id)].slice(0, MAX_RECENT_CHAT_IDS);
    if (next.length === prev.length && next.every((x, i) => x === prev[i])) {
      return;
    }
    await updateDoc(ref, { recentChatIds: next });
  } catch {
    // Best-effort; profile open may still fail until this succeeds.
  }
}
