import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  QueryDocumentSnapshot,
  startAfter,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "@/src/lib/firebase";
import { ignoreSnapshotPermissionDenied } from "@/src/lib/firestoreListeners";
import {
  ChatMessage,
  MESSAGE_PAGE_SIZE,
  mergeMessagePages,
  reverseMessagePage,
} from "@/src/lib/chatMessages";

type Params = {
  activeChatId: string | null;
  isChatPaneOpen: boolean;
  pendingNewChat: unknown | null;
};

type ChatCacheEntry = {
  messages: ChatMessage[];
  hasEarlier: boolean;
};

type CacheRef = React.MutableRefObject<Record<string, ChatCacheEntry>>;

function emptyCacheEntry(): ChatCacheEntry {
  return { messages: [], hasEarlier: false };
}

function writeCache(
  cache: Record<string, ChatCacheEntry>,
  chatId: string,
  messages: ChatMessage[],
  hasEarlier?: boolean
) {
  const prev = cache[chatId];
  cache[chatId] = {
    messages,
    hasEarlier:
      hasEarlier ??
      prev?.hasEarlier ??
      messages.length >= MESSAGE_PAGE_SIZE,
  };
}

export function useChatMessages({
  activeChatId,
  isChatPaneOpen,
  pendingNewChat,
}: Params) {
  const [serverMessages, setServerMessages] = useState<ChatMessage[]>([]);
  const [messagesReady, setMessagesReady] = useState(false);
  const [listenerError, setListenerError] = useState<string | null>(null);
  const [hasEarlierMessages, setHasEarlierMessages] = useState(false);
  const [loadingEarlier, setLoadingEarlier] = useState(false);

  const messagesCacheByChatIdRef = useRef<Record<string, ChatCacheEntry>>({});
  const oldestDocRef = useRef<QueryDocumentSnapshot | null>(null);
  const boundChatIdRef = useRef<string | null>(null);

  const applyCacheEntry = useCallback((chatId: string, entry: ChatCacheEntry) => {
    boundChatIdRef.current = chatId;
    oldestDocRef.current = null;
    setServerMessages(entry.messages);
    setHasEarlierMessages(entry.hasEarlier);
    setMessagesReady(true);
    setListenerError(null);
  }, []);

  /** Apply in-memory cache synchronously (call before setActiveChatId / pane navigation). */
  const prepareChatSync = useCallback(
    (chatId: string) => {
      const entry = messagesCacheByChatIdRef.current[chatId];
      if (entry) {
        applyCacheEntry(chatId, entry);
        return true;
      }
      boundChatIdRef.current = chatId;
      setServerMessages([]);
      setHasEarlierMessages(false);
      setMessagesReady(false);
      setListenerError(null);
      return false;
    },
    [applyCacheEntry]
  );

  const markChatRead = useCallback(async (chatId: string) => {
    if (!auth.currentUser) return;
    const myId = auth.currentUser.uid;
    try {
      await updateDoc(doc(db, "chats", chatId), {
        [`lastReadBy.${myId}`]: serverTimestamp(),
      });
    } catch {
      // Non-blocking; badge may lag briefly.
    }
  }, []);

  const hydrateChatMessages = useCallback(
    async (chatId: string) => {
      const cached = messagesCacheByChatIdRef.current[chatId];
      if (cached) {
        applyCacheEntry(chatId, cached);
        return;
      }
      try {
        const q = query(
          collection(db, "chats", chatId, "messages"),
          orderBy("createdAt", "desc"),
          limit(MESSAGE_PAGE_SIZE)
        );
        const snap = await getDocs(q);
        const page = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as ChatMessage[];
        oldestDocRef.current =
          snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
        const ordered = reverseMessagePage(page);
        const hasEarlier = snap.docs.length >= MESSAGE_PAGE_SIZE;
        writeCache(messagesCacheByChatIdRef.current, chatId, ordered, hasEarlier);
        if (boundChatIdRef.current === chatId || activeChatId === chatId) {
          applyCacheEntry(chatId, {
            messages: ordered,
            hasEarlier,
          });
        }
      } catch {
        if (boundChatIdRef.current === chatId || activeChatId === chatId) {
          setServerMessages([]);
          setMessagesReady(true);
          setListenerError("Could not load messages. Check your connection.");
        }
      }
    },
    [activeChatId, applyCacheEntry]
  );

  const loadEarlierMessages = useCallback(async () => {
    if (!activeChatId || loadingEarlier || !hasEarlierMessages) return;
    const cursor = oldestDocRef.current;
    if (!cursor) return;

    setLoadingEarlier(true);
    try {
      const q = query(
        collection(db, "chats", activeChatId, "messages"),
        orderBy("createdAt", "desc"),
        startAfter(cursor),
        limit(MESSAGE_PAGE_SIZE)
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        setHasEarlierMessages(false);
        messagesCacheByChatIdRef.current[activeChatId] = {
          ...messagesCacheByChatIdRef.current[activeChatId],
          messages: serverMessages,
          hasEarlier: false,
        };
        return;
      }
      const page = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as ChatMessage[];
      oldestDocRef.current = snap.docs[snap.docs.length - 1];
      const pageHasEarlier = snap.docs.length >= MESSAGE_PAGE_SIZE;
      setHasEarlierMessages(pageHasEarlier);
      setServerMessages((prev) => {
        const prepended = reverseMessagePage(page);
        const merged = mergeMessagePages(prepended, prev);
        writeCache(
          messagesCacheByChatIdRef.current,
          activeChatId,
          merged,
          pageHasEarlier
        );
        return merged;
      });
    } catch {
      setHasEarlierMessages(false);
    } finally {
      setLoadingEarlier(false);
    }
  }, [activeChatId, hasEarlierMessages, loadingEarlier, serverMessages]);

  const retryListener = useCallback(() => {
    setListenerError(null);
    if (activeChatId) {
      void hydrateChatMessages(activeChatId);
    }
  }, [activeChatId, hydrateChatMessages]);

  const clearMessages = useCallback(() => {
    boundChatIdRef.current = null;
    setServerMessages([]);
    setMessagesReady(false);
    setListenerError(null);
    setHasEarlierMessages(false);
    oldestDocRef.current = null;
  }, []);

  useLayoutEffect(() => {
    if (!isChatPaneOpen) return;

    if (pendingNewChat) {
      boundChatIdRef.current = null;
      setServerMessages([]);
      setMessagesReady(true);
      setListenerError(null);
      setHasEarlierMessages(false);
      oldestDocRef.current = null;
      return;
    }

    if (!activeChatId) return;

    const cached = messagesCacheByChatIdRef.current[activeChatId];
    if (cached) {
      applyCacheEntry(activeChatId, cached);
    } else if (boundChatIdRef.current !== activeChatId) {
      boundChatIdRef.current = activeChatId;
      setServerMessages([]);
      setHasEarlierMessages(false);
      setMessagesReady(false);
      setListenerError(null);
    }
  }, [activeChatId, isChatPaneOpen, pendingNewChat, applyCacheEntry]);

  useEffect(() => {
    if (!isChatPaneOpen) return;
    if (pendingNewChat || !activeChatId) return;

    const listenerChatId = activeChatId;
    oldestDocRef.current = null;

    const q = query(
      collection(db, "chats", listenerChatId, "messages"),
      orderBy("createdAt", "desc"),
      limit(MESSAGE_PAGE_SIZE)
    );

    return onSnapshot(
      q,
      (snap) => {
        if (boundChatIdRef.current !== listenerChatId) return;
        const page = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as ChatMessage[];
        if (!oldestDocRef.current && snap.docs.length > 0) {
          oldestDocRef.current = snap.docs[snap.docs.length - 1];
        }
        const pageHasEarlier = snap.docs.length >= MESSAGE_PAGE_SIZE;
        setHasEarlierMessages((prev) => (pageHasEarlier ? true : prev));

        setServerMessages((prev) => {
          const latestWindow = reverseMessagePage(page);
          if (page.length === 0 && prev.length > 0) {
            return prev;
          }
          let merged = latestWindow;
          if (prev.length > 0 && page.length > 0) {
            merged = mergeMessagePages(prev, latestWindow);
          }
          writeCache(
            messagesCacheByChatIdRef.current,
            listenerChatId,
            merged,
            pageHasEarlier ||
              messagesCacheByChatIdRef.current[listenerChatId]?.hasEarlier ||
              merged.length >= MESSAGE_PAGE_SIZE
          );
          return merged;
        });
        setMessagesReady(true);
        setListenerError(null);
      },
      (error) => {
        ignoreSnapshotPermissionDenied(error);
        const code = (error as { code?: string }).code;
        if (code === "permission-denied") {
          if (boundChatIdRef.current === listenerChatId) {
            setServerMessages([]);
            setMessagesReady(true);
            setListenerError("You don't have access to this conversation.");
          }
          return;
        }
        setMessagesReady(true);
        setListenerError("Could not load messages. Check your connection.");
      }
    );
  }, [activeChatId, isChatPaneOpen, pendingNewChat]);

  const markReadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!isChatPaneOpen || !activeChatId || pendingNewChat) return;
    if (!messagesReady || serverMessages.length === 0) return;

    if (markReadTimerRef.current) clearTimeout(markReadTimerRef.current);
    markReadTimerRef.current = setTimeout(() => {
      void markChatRead(activeChatId);
    }, 400);

    return () => {
      if (markReadTimerRef.current) clearTimeout(markReadTimerRef.current);
    };
  }, [
    isChatPaneOpen,
    activeChatId,
    pendingNewChat,
    messagesReady,
    serverMessages.length,
    markChatRead,
  ]);

  return {
    serverMessages,
    messagesReady,
    listenerError,
    hasEarlierMessages,
    loadingEarlier,
    messagesCacheByChatIdRef: messagesCacheByChatIdRef as unknown as CacheRef,
    prepareChatSync,
    hydrateChatMessages,
    loadEarlierMessages,
    markChatRead,
    retryListener,
    clearMessages,
    setServerMessages,
  };
};
