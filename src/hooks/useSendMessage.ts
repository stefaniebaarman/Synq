import { useCallback, useEffect, useRef, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "@/src/lib/firebase";
import { trackEvent } from "@/src/lib/analytics";
import {
  createPendingMessage,
  pendingMatchesServer,
  pruneAcknowledgedPending,
  PendingMessage,
} from "@/src/lib/chatMessages";

type ChatMessage = {
  id: string;
  text: string;
  senderId: string;
  createdAt?: unknown;
};

function otherParticipantsFromList(participants: string[], myId: string): string[] {
  return participants.filter((pId) => pId && pId !== myId);
}

async function resolveOtherParticipants(
  chatId: string,
  myId: string,
  allChats: { id: string; participants: string[] }[],
  fallbackParticipants?: string[]
): Promise<string[]> {
  const chat = allChats.find((c) => c.id === chatId);
  if (chat?.participants?.length) {
    return otherParticipantsFromList(chat.participants, myId);
  }
  if (fallbackParticipants?.length) {
    return otherParticipantsFromList(fallbackParticipants, myId);
  }
  const snap = await getDoc(doc(db, "chats", chatId));
  const participants = snap.exists()
    ? ((snap.data()?.participants as string[]) ?? [])
    : [];
  return otherParticipantsFromList(participants, myId);
}

type Params = {
  activeChatId: string | null;
  pendingNewChat: {
    chatId?: string;
    participants: string[];
    participantNames: Record<string, string>;
    participantImages: Record<string, string>;
    communityGroupId?: string;
    communityGroupName?: string;
    communityPlanId?: string;
    communityPlanTitle?: string;
  } | null;
  allChats: { id: string; participants: string[] }[];
  serverMessages: ChatMessage[];
  setActiveChatId: (id: string | null) => void;
  setPendingNewChat: (value: Params["pendingNewChat"]) => void;
  resolveAvatar: (url: unknown) => string;
  userAvatar?: string;
  rejectIfObjectionable: (text: string) => boolean;
  isBlocked?: (uid: string) => boolean;
  onSendError: (message: string) => void;
  onMessageDelivered?: (clientId: string, meta: { text: string; senderId: string; sentAt: number }) => void;
};

export function useSendMessage({
  activeChatId,
  pendingNewChat,
  allChats,
  serverMessages,
  setActiveChatId,
  setPendingNewChat,
  resolveAvatar,
  userAvatar,
  rejectIfObjectionable,
  isBlocked,
  onSendError,
  onMessageDelivered,
}: Params) {
  const [pendingMessages, setPendingMessages] = useState<PendingMessage[]>([]);
  const recentlySentRef = useRef<
    Map<string, { text: string; senderId: string; sentAt: number }>
  >(new Map());

  const sendOrderRef = useRef(0);
  const sendOrderByServerIdRef = useRef<Map<string, number>>(new Map());
  const creatingChatRef = useRef<Promise<string> | null>(null);

  const ensureChatFromPending = useCallback(async (): Promise<string | null> => {
    if (!auth.currentUser) return null;
    if (!pendingNewChat) return activeChatId;

    if (creatingChatRef.current) {
      return creatingChatRef.current;
    }

    const participants = pendingNewChat.participants;
    const participantNames = pendingNewChat.participantNames;
    const participantImages = pendingNewChat.participantImages;
    const communityGroupId = pendingNewChat.communityGroupId?.trim();
    const communityGroupName = pendingNewChat.communityGroupName?.trim();
    const communityPlanId = pendingNewChat.communityPlanId?.trim();
    const communityPlanTitle = pendingNewChat.communityPlanTitle?.trim();
    const predeterminedChatId = pendingNewChat.chatId?.trim();

    const promise = (async () => {
      const payload: Record<string, unknown> = {
        participants,
        participantNames,
        participantImages,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessage: "",
      };
      if (communityGroupId) {
        payload.communityGroupId = communityGroupId;
        payload.source = "community";
        if (communityGroupName) payload.communityGroupName = communityGroupName;
        if (communityPlanId) payload.communityPlanId = communityPlanId;
        if (communityPlanTitle) payload.communityPlanTitle = communityPlanTitle;
      }

      if (predeterminedChatId) {
        const chatRef = doc(db, "chats", predeterminedChatId);
        await setDoc(chatRef, payload, { merge: true });
        setActiveChatId(predeterminedChatId);
        setPendingNewChat(null);
        return predeterminedChatId;
      }

      const chatRef = await addDoc(collection(db, "chats"), payload);
      const chatId = chatRef.id;
      setActiveChatId(chatId);
      setPendingNewChat(null);
      return chatId;
    })();

    creatingChatRef.current = promise;
    try {
      return await promise;
    } finally {
      creatingChatRef.current = null;
    }
  }, [activeChatId, pendingNewChat, setActiveChatId, setPendingNewChat]);

  useEffect(() => {
    const matchedServerIds = new Set();
    for (const pending of pendingMessages) {
      if (pending.sendStatus === "failed") continue;
      if (typeof pending.sendOrder !== "number") continue;
      const server = serverMessages.find(
        (row) =>
          !matchedServerIds.has(row.id) && pendingMatchesServer(pending, row)
      );
      if (server) {
        matchedServerIds.add(server.id);
        sendOrderByServerIdRef.current.set(server.id, pending.sendOrder);
      }
    }

    setPendingMessages((prev) => {
      if (!prev.length) return prev;
      const next = pruneAcknowledgedPending(serverMessages, prev);
      return next.length === prev.length ? prev : next;
    });
  }, [serverMessages, pendingMessages]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !auth.currentUser) return false;
      if (!pendingNewChat && !activeChatId) return false;
      if (rejectIfObjectionable(trimmed)) return false;

      const myId = auth.currentUser.uid;
      const clientId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const myAvatar = resolveAvatar(userAvatar);
      const optimistic = createPendingMessage({
        clientId,
        text: trimmed,
        senderId: myId,
        imageurl: myAvatar,
        sendOrder: ++sendOrderRef.current,
      }) as PendingMessage;

      setPendingMessages((prev) => [...prev, optimistic]);

      const markOptimisticFailed = () => {
        setPendingMessages((prev) =>
          prev.map((p) =>
            p.clientId === clientId ? { ...p, sendStatus: "failed" as const } : p
          )
        );
      };

      try {
        let chatId = activeChatId;
        let otherParticipants: string[];

        if (pendingNewChat) {
          const pendingParticipants = pendingNewChat.participants;
          chatId = await ensureChatFromPending();
          if (!chatId) {
            markOptimisticFailed();
            onSendError("Message could not be sent. Please try again.");
            return false;
          }
          otherParticipants = await resolveOtherParticipants(
            chatId,
            myId,
            allChats,
            pendingParticipants
          );
        } else {
          otherParticipants = await resolveOtherParticipants(
            activeChatId!,
            myId,
            allChats
          );
        }

        if (otherParticipants.some((pId) => isBlocked?.(pId))) {
          throw new Error("blocked_recipient");
        }

        await addDoc(collection(db, "chats", chatId!, "messages"), {
          text: trimmed,
          senderId: myId,
          imageurl: myAvatar,
          createdAt: serverTimestamp(),
        });

        await updateDoc(doc(db, "chats", chatId!), {
          lastMessage: trimmed,
          lastMessageSenderId: myId,
          updatedAt: serverTimestamp(),
          [`participantImages.${myId}`]: myAvatar,
        });

        recentlySentRef.current.set(clientId, {
          text: trimmed,
          senderId: myId,
          sentAt: Date.now(),
        });
        onMessageDelivered?.(clientId, {
          text: trimmed,
          senderId: myId,
          sentAt: Date.now(),
        });
        setTimeout(() => recentlySentRef.current.delete(clientId), 20_000);

        trackEvent("message_sent", { chat_id: chatId! });

        void Promise.all(
          otherParticipants.map(async (pId) => {
            const mySideFriendDoc = doc(db, "users", myId, "friends", pId);
            const theirSideFriendDoc = doc(db, "users", pId, "friends", myId);
            await updateDoc(mySideFriendDoc, {
              synqCount: increment(1),
              lastSynqAt: serverTimestamp(),
            }).catch(() => {});
            await updateDoc(theirSideFriendDoc, {
              synqCount: increment(1),
              lastSynqAt: serverTimestamp(),
            }).catch(() => {});
          })
        );

        return true;
      } catch (err) {
        setPendingMessages((prev) =>
          prev.map((p) =>
            p.clientId === clientId ? { ...p, sendStatus: "failed" as const } : p
          )
        );
        if (err instanceof Error && err.message === "blocked_recipient") {
          onSendError("You can't message this user.");
        } else {
          onSendError("Message could not be sent. Please try again.");
        }
        return false;
      }
    },
    [
      activeChatId,
      allChats,
      pendingNewChat,
      rejectIfObjectionable,
      isBlocked,
      resolveAvatar,
      setActiveChatId,
      setPendingNewChat,
      userAvatar,
      onSendError,
      onMessageDelivered,
      ensureChatFromPending,
    ]
  );

  const retryFailedMessage = useCallback(
    async (clientId: string, text: string) => {
      setPendingMessages((prev) => prev.filter((p) => p.clientId !== clientId));
      return sendMessage(text);
    },
    [sendMessage]
  );

  const clearPendingMessages = useCallback(() => {
    setPendingMessages([]);
    recentlySentRef.current.clear();
    sendOrderRef.current = 0;
    sendOrderByServerIdRef.current.clear();
  }, []);

  return {
    pendingMessages,
    sendMessage,
    retryFailedMessage,
    clearPendingMessages,
    ensureChatFromPending,
    recentlySentRef,
    sendOrderByServerIdRef,
  };
}
