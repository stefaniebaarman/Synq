import { useCallback, useEffect, useRef, useState } from "react";
import { deleteField, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { auth, db } from "@/src/lib/firebase";

const TYPING_TTL_MS = 5_000;
const TYPING_DEBOUNCE_MS = 350;

type Params = {
  chatId: string | null;
  enabled: boolean;
  participantIds: string[];
  onTypingChange?: (userIds: string[]) => void;
};

export function useTypingIndicator({
  chatId,
  enabled,
  participantIds,
  onTypingChange,
}: Params) {
  const [typingUserIds, setTypingUserIds] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingSnapshotRef = useRef<Record<string, number>>({});

  const myId = auth.currentUser?.uid;

  const setTyping = useCallback(
    async (isTyping: boolean) => {
      if (!chatId || !myId || !enabled) return;
      try {
        await updateDoc(doc(db, "chats", chatId), {
          [`typingBy.${myId}`]: isTyping ? serverTimestamp() : deleteField(),
        });
      } catch {
        // Non-critical UX enhancement.
      }
    },
    [chatId, enabled, myId]
  );

  const notifyInputChange = useCallback(() => {
    if (!enabled) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void setTyping(true);
    }, TYPING_DEBOUNCE_MS);

    if (clearRef.current) clearTimeout(clearRef.current);
    clearRef.current = setTimeout(() => {
      void setTyping(false);
    }, TYPING_TTL_MS);
  }, [enabled, setTyping]);

  const stopTyping = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (clearRef.current) clearTimeout(clearRef.current);
    void setTyping(false);
  }, [setTyping]);

  useEffect(() => {
    if (!enabled || !chatId || !myId) {
      setTypingUserIds([]);
      return;
    }

    const others = participantIds.filter((id) => id && id !== myId);
    if (others.length === 0) {
      setTypingUserIds([]);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const active = Object.entries(typingSnapshotRef.current)
        .filter(([uid, ms]) => uid !== myId && now - ms < TYPING_TTL_MS)
        .map(([uid]) => uid);
      setTypingUserIds(active);
      onTypingChange?.(active);
    }, 400);

    return () => clearInterval(interval);
  }, [chatId, enabled, myId, onTypingChange, participantIds]);

  useEffect(() => {
    return () => {
      void setTyping(false);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (clearRef.current) clearTimeout(clearRef.current);
    };
  }, [setTyping]);

  const ingestChatTypingSnapshot = useCallback(
    (typingBy: Record<string, unknown> | undefined) => {
      if (!typingBy || !myId) return;
      const now = Date.now();
      for (const [uid, value] of Object.entries(typingBy)) {
        if (uid === myId) continue;
        const ms =
          value && typeof value === "object" && "toMillis" in value
            ? (value as { toMillis: () => number }).toMillis()
            : typeof value === "number"
              ? value
              : now;
        typingSnapshotRef.current[uid] = ms;
      }
    },
    [myId]
  );

  return {
    typingUserIds,
    notifyInputChange,
    stopTyping,
    ingestChatTypingSnapshot,
  };
}
