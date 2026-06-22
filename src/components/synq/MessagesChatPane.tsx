import {
  ACCENT,
  BG,
  BORDER_HAIRLINE,
  BORDER_LIGHT,
  BG_TRANSPARENT,
  DESTRUCTIVE_IOS_FILL,
  HEADER_BLACK,
  MUTED2,
  MUTED3,
  ON_ACCENT_TEXT,
  OVERLAY_CHAT_TOP,
  OVERLAY_DARK,
  OVERLAY_FADE,
  OVERLAY_WHISPER,
  OVERLAY_ZERO,
  PROFILE_HEADER_TOP_OFFSET,
  SURFACE_ELEVATED,
  TEXT,
  TYPE_CAPTION,
  TYPE_FINE,
  TYPE_LEAD,
  TYPE_SECTION,
  fonts,
  heroTitleText,
} from "@/constants/Variables";
import CloseButton from "@/src/components/CloseButton";
import CloseIcon from "@/src/components/CloseIcon";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React, {
  type ComponentType,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Keyboard,
  type KeyboardEvent,
  LayoutAnimation,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet as RNStyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  formatTime,
  getOtherChatParticipants,
  isAiSuggestionMessage,
  isLegacyAiSuggestionText,
  parseIdeaText,
  resolveChatSenderAvatar
} from "@/src/lib/helpers";
import AISuggestionBubble from "./AISuggestionBubble";
import { MESSAGES_STACK_DURATION_MS } from "./MessagesModalStack";

const MESSAGE_ENTER = FadeInUp.duration(200);
const COMPOSER_KEYBOARD_GAP = 14;
const LIST_SCROLL_OVERFLOW_SLACK = 4;

/** Matches MessagesModalStack push/pop timing. */
const CHAT_PANE_ENTER_MS = MESSAGES_STACK_DURATION_MS;
/** Clamp overscroll at the latest-message edge (normal list, offset at bottom). */
const CHAT_BOTTOM_SCROLL_TOLERANCE = 2;
/** Skip follow-up scroll-to-bottom while the list lays out after chat open. */
const CHAT_OPEN_LAYOUT_SETTLE_MS = 450;
/** Fade from black into the message list, starting just under the AI chip row. */
const CHAT_HEADER_FADE_BELOW_AI = 44;
const CHAT_HEADER_FADE_EXPANDED = 52;
/** Avatar (44) + trailing gap (12) — aligns content with the title column. */
const CHAT_HEADER_TITLE_INDENT = 56;
const CHAT_MEMBER_TILE_WIDTH = 68;

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function participantFirstName(fullName: string) {
  return (fullName || "").trim().split(/\s+/)[0];
}
/** Modest bump past the header fade overlap (shell uses negative margin). */
const CHAT_LIST_HEADER_FADE_CLEARANCE = 10;
/** Keep first paint small — uncapped initialNumToRender was forcing 50 rows on chat open. */
const CHAT_LIST_INITIAL_RENDER_MIN = 10;
const CHAT_ESTIMATED_ROW_HEIGHT = 76;
const CHAT_HEADER_FADE_GRADIENT = [
  HEADER_BLACK,
  OVERLAY_CHAT_TOP,
  OVERLAY_DARK,
  OVERLAY_FADE,
  OVERLAY_WHISPER,
  BG_TRANSPARENT,
] as const;
const CHAT_HEADER_FADE_LOCATIONS = [0, 0.1, 0.3, 0.52, 0.76, 1] as const;

function getKeyboardInset(event: KeyboardEvent): number {
  const { screenY } = event.endCoordinates;
  return Math.max(0, Dimensions.get("window").height - screenY);
}

function countHeartReactions(reactions?: Record<string, string>): number {
  if (!reactions) return 0;
  let count = 0;
  for (const value of Object.values(reactions)) {
    if (value === "heart") count += 1;
  }
  return count;
}

type Props = {
  styles: any;
  insetsTop: number;
  activeChat: any;
  chatTitle: string;
  renderAvatarStack: (
    images: Record<string, string> | undefined,
    participants?: string[]
  ) => React.ReactNode;
  rotatingAIText: string;
  pendingScrollToMessageId: string | null;
  setPendingScrollToMessageId: (value: string | null) => void;
  flatListRef: React.RefObject<FlatList<any> | null>;
  messages: any[];
  messagesReady: boolean;
  listenerError?: string | null;
  onRetryMessages?: () => void;
  hasEarlierMessages?: boolean;
  loadingEarlier?: boolean;
  onLoadEarlier?: () => void;
  typingUserIds?: string[];
  onComposerChange?: (text: string) => void;
  showAICard: boolean;
  aiResponse: string;
  inputText: string;
  setInputText: (value: string) => void;
  setMessagesPane: (value: "inbox" | "chat") => void;
  onBackFromChat: () => void;
  setShowAICard: (value: boolean) => void;
  setShowOptionsList: (value: boolean) => void;
  setPendingNewChat: (value: any) => void;
  showAISuggestions: boolean;
  showAIUnavailableMessage?: boolean;
  onOpenAISuggestions: () => void;
  onOpenFriendProfile?: (friendId: string) => void;
  sendMessage: () => void;
  sendAISuggestionToChat: () => void;
  onMessageBubblePress: (item: {
    id: string;
    text?: string;
    clientId?: string;
    sendStatus?: "sending" | "failed";
    reactions?: Record<string, string>;
  }) => void;
  onMessageLongPress?: (item: {
    id: string;
    senderId: string;
    text: string;
  }) => void;
  onIdeaBubblePress: (
    item: { id: string; reactions?: Record<string, string> },
    mapsPayload: { name: string; address: string }
  ) => void;
  ChatMessageBubble: ComponentType<{
    text: string;
    bubbleCap: number;
    isMe: boolean;
    onPress: () => void;
    heartCount: number;
    sendStatus?: "sending" | "failed";
  }>;
  iMessageBubbleColumnMaxWidth: (windowWidth: number, isOutgoing: boolean) => number;
  windowWidth: number;
  currentUserId?: string;
  /** Live profile photos from Firestore; keeps bubbles in sync when avatars change mid-chat. */
  liveParticipantImages?: Record<string, string>;
  /** Bumped each time a chat is opened from inbox / notification (not profile back). */
  chatOpenAnchorKey?: number;
};

const CHAT_AI_SUBTITLE_SLOT_HEIGHT = 26;

export default function MessagesChatPane({
  styles,
  insetsTop,
  activeChat,
  chatTitle,
  renderAvatarStack,
  rotatingAIText,
  pendingScrollToMessageId,
  setPendingScrollToMessageId,
  flatListRef,
  messages,
  messagesReady,
  listenerError = null,
  onRetryMessages,
  hasEarlierMessages = false,
  loadingEarlier = false,
  onLoadEarlier,
  typingUserIds = [],
  onComposerChange,
  showAICard,
  aiResponse,
  inputText,
  setInputText,
  setMessagesPane,
  onBackFromChat,
  setShowAICard,
  setShowOptionsList,
  setPendingNewChat,
  showAISuggestions,
  showAIUnavailableMessage = false,
  onOpenAISuggestions,
  onOpenFriendProfile,
  sendMessage,
  sendAISuggestionToChat,
  onMessageBubblePress,
  onMessageLongPress,
  onIdeaBubblePress,
  ChatMessageBubble,
  iMessageBubbleColumnMaxWidth,
  windowWidth,
  currentUserId,
  liveParticipantImages,
  chatOpenAnchorKey = 0,
}: Props) {
  const insets = useSafeAreaInsets();
  const canSend = inputText.trim().length > 0;
  const listHeightRef = useRef(0);
  const contentHeightRef = useRef(0);
  const scrollOffsetRef = useRef(0);
  const listScrollableRef = useRef(false);
  const scrollRafRef = useRef<number | null>(null);
  const [listScrollable, setListScrollable] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const isKeyboardOpenRef = useRef(false);
  const activeChatRef = useRef(activeChat);
  activeChatRef.current = activeChat;
  const liveImagesRef = useRef(liveParticipantImages);
  liveImagesRef.current = liveParticipantImages;
  const knownMessageIdsRef = useRef<Set<string>>(new Set());
  const chatSeededRef = useRef(false);
  const prevChatIdRef = useRef<string | undefined>(undefined);
  const anchorBottomRef = useRef(true);
  const pendingNormalScrollRef = useRef(false);
  const prevAnchorKeyRef = useRef(chatOpenAnchorKey);
  const prevMessagesLenByChatRef = useRef<Record<string, number>>({});
  const prevHasEarlierRef = useRef(hasEarlierMessages);
  const layoutSettlingRef = useRef(false);
  const openSettleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listData = messages;

  const scheduleOpenAnchor = useCallback((messageCount: number) => {
    if (messageCount <= 0) {
      pendingNormalScrollRef.current = false;
      layoutSettlingRef.current = false;
      if (openSettleTimerRef.current) {
        clearTimeout(openSettleTimerRef.current);
        openSettleTimerRef.current = null;
      }
      return;
    }

    // Already anchoring this open — avoid resetting the settle window (double-fire flicker).
    if (pendingNormalScrollRef.current || layoutSettlingRef.current) {
      anchorBottomRef.current = true;
      return;
    }

    anchorBottomRef.current = true;
    pendingNormalScrollRef.current = true;
    layoutSettlingRef.current = true;
    openSettleTimerRef.current = setTimeout(() => {
      layoutSettlingRef.current = false;
      openSettleTimerRef.current = null;
      setListScrollable(listScrollableRef.current);
    }, CHAT_OPEN_LAYOUT_SETTLE_MS);
  }, []);

  const headerProfileFriendId = useMemo(() => {
    const participantIds = activeChat?.participants?.length
      ? activeChat.participants
      : Object.keys(activeChat?.participantImages ?? {});
    const otherIds = participantIds.filter(
      (id: string) => id && id !== currentUserId
    );
    return otherIds.length === 1 ? otherIds[0] : null;
  }, [activeChat?.participants, activeChat?.participantImages, currentUserId]);

  const canExpandChatTitle = useMemo(() => {
    if (!activeChat) return false;
    if (activeChat.customName?.trim()) return true;
    const participantIds = activeChat.participants?.length
      ? activeChat.participants
      : Object.keys(activeChat.participantImages ?? {});
    const otherIds = participantIds.filter(
      (id: string) => id && id !== currentUserId
    );
    return otherIds.length > 1;
  }, [
    activeChat,
    activeChat?.customName,
    activeChat?.participants,
    activeChat?.participantImages,
    currentUserId,
  ]);

  const [chatTitleExpanded, setChatTitleExpanded] = useState(false);

  useEffect(() => {
    setChatTitleExpanded(false);
  }, [activeChat?.id]);

  const otherParticipants = useMemo(
    () => getOtherChatParticipants(activeChat, currentUserId),
    [
      activeChat,
      currentUserId,
      activeChat?.participantNames
        ? Object.entries(activeChat.participantNames as Record<string, string>)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([uid, name]) => `${uid}:${name}`)
            .join("|")
        : "",
    ]
  );

  const chatCustomName =
    typeof activeChat?.customName === "string"
      ? activeChat.customName.trim()
      : "";

  const toggleChatTitleExpanded = useCallback(() => {
    if (!canExpandChatTitle) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setChatTitleExpanded((expanded) => !expanded);
  }, [canExpandChatTitle]);

  const renderAiChip = useCallback(
    (chipMarginTop?: number) => (
      <TouchableOpacity
        onPress={() => {
          Keyboard.dismiss();
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onOpenAISuggestions();
        }}
        style={[
          styles.aiChipPremium,
          chipMarginTop != null && { marginTop: chipMarginTop },
        ]}
        activeOpacity={0.82}
        accessibilityRole="button"
        accessibilityLabel="Open Synq AI place suggestions"
      >
        <Ionicons name="sparkles" size={11} color={ACCENT} />
        <Text style={styles.aiChipTextPremium} numberOfLines={1}>
          {rotatingAIText}
        </Text>
        <Ionicons name="chevron-forward" size={11} color={MUTED2} />
      </TouchableOpacity>
    ),
    [onOpenAISuggestions, rotatingAIText, styles.aiChipPremium, styles.aiChipTextPremium]
  );

  const handleOpenFriendProfile = useCallback(
    (friendId: string) => {
      if (!friendId || friendId === currentUserId) return;
      Keyboard.dismiss();
      onOpenFriendProfile?.(friendId);
    },
    [currentUserId, onOpenFriendProfile]
  );

  useEffect(() => {
    const prevId = prevChatIdRef.current;
    const nextId = activeChat?.id;
    const chatChanged = prevId !== nextId;
    prevChatIdRef.current = nextId;

    if (chatChanged) {
      scrollOffsetRef.current = 0;
      prevHasEarlierRef.current = hasEarlierMessages;
      if (nextId) {
        prevMessagesLenByChatRef.current[nextId] = messages.length;
        scheduleOpenAnchor(messages.length);
      }
      if (messages.length > 0) {
        messages.forEach((message) => knownMessageIdsRef.current.add(message.id));
        chatSeededRef.current = true;
      } else {
        knownMessageIdsRef.current = new Set();
        chatSeededRef.current = false;
        pendingNormalScrollRef.current = false;
      }

      const pendingToReal =
        prevId === "__pending__" && !!nextId && nextId !== "__pending__";
      if (!pendingToReal) {
        isKeyboardOpenRef.current = false;
        setKeyboardOpen(false);
        setKeyboardInset(0);
      }
    }

    if (messages.length > 0 && !chatSeededRef.current) {
      messages.forEach((message) => knownMessageIdsRef.current.add(message.id));
      chatSeededRef.current = true;
    }
  }, [
    activeChat?.id,
    messages.length,
    hasEarlierMessages,
    scheduleOpenAnchor,
  ]);

  useEffect(() => {
    const chatId = activeChat?.id;
    if (!chatId || !messagesReady || messages.length === 0) return;
    if (pendingScrollToMessageId) return;

    const prevLen = prevMessagesLenByChatRef.current[chatId] ?? 0;
    prevMessagesLenByChatRef.current[chatId] = messages.length;

    if (prevLen === 0 && messages.length > 0) {
      scheduleOpenAnchor(messages.length);
    }
  }, [
    activeChat?.id,
    messages.length,
    messagesReady,
    pendingScrollToMessageId,
    scheduleOpenAnchor,
  ]);

  useEffect(() => {
    if (prevAnchorKeyRef.current === chatOpenAnchorKey) return;
    prevAnchorKeyRef.current = chatOpenAnchorKey;
    if (chatOpenAnchorKey === 0 || pendingScrollToMessageId) return;

    if (messages.length > 0) {
      scheduleOpenAnchor(messages.length);
    }
  }, [
    chatOpenAnchorKey,
    messages.length,
    pendingScrollToMessageId,
    scheduleOpenAnchor,
  ]);

  useEffect(() => {
    return () => {
      if (openSettleTimerRef.current) {
        clearTimeout(openSettleTimerRef.current);
      }
    };
  }, []);

  const composerBottomInset = Math.max(insets.bottom, 10) + 6;
  const composerPaddingBottom = keyboardOpen
    ? COMPOSER_KEYBOARD_GAP
    : composerBottomInset;
  useLayoutEffect(() => {
    if (!messagesReady || messages.length === 0) {
      if (messagesReady && messages.length === 0) {
        chatSeededRef.current = true;
      }
      return;
    }

    if (!chatSeededRef.current) {
      messages.forEach((message) => knownMessageIdsRef.current.add(message.id));
      chatSeededRef.current = true;
    }
  }, [messages, messagesReady]);

  const shouldAnimateMessage = useCallback(
    (item: { id: string; senderId?: string; clientId?: string }) => {
      const rowKey = item.clientId ?? item.id;
      if (!chatSeededRef.current) return false;
      if (
        knownMessageIdsRef.current.has(item.id) ||
        knownMessageIdsRef.current.has(rowKey)
      ) {
        return false;
      }
      if (item.senderId === currentUserId) {
        knownMessageIdsRef.current.add(item.id);
        knownMessageIdsRef.current.add(rowKey);
        return false;
      }
      knownMessageIdsRef.current.add(item.id);
      if (item.clientId) knownMessageIdsRef.current.add(item.clientId);
      return true;
    },
    [currentUserId]
  );

  const handleSend = () => {
    if (!canSend) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    anchorBottomRef.current = true;
    sendMessage();
  };

  const syncListScrollable = useCallback(() => {
    const listH = listHeightRef.current;
    const contentH = contentHeightRef.current;
    const scrollable =
      listH > 0 && contentH > listH + LIST_SCROLL_OVERFLOW_SLACK;
    if (scrollable !== listScrollableRef.current) {
      listScrollableRef.current = scrollable;
      if (!layoutSettlingRef.current) {
        setListScrollable(scrollable);
      }
    }
    return scrollable;
  }, []);

  /** Coalesce scroll-to-bottom work to one frame (avoids jank on long threads). */
  const scrollToLatestRef = useRef<(animated?: boolean) => boolean>(() => false);
  const scheduleScrollToLatest = useCallback((animated = false) => {
    if (scrollRafRef.current != null) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      scrollToLatestRef.current(animated);
    });
  }, []);

  const listPanActive = listScrollable || keyboardOpen || messages.length > 0;

  const maxScrollOffset = useCallback(() => {
    const listH = listHeightRef.current;
    const contentH = contentHeightRef.current;
    return Math.max(0, contentH - listH);
  }, []);

  const syncAnchoredToLatest = useCallback(
    (offsetY: number) => {
      const maxOffset = maxScrollOffset();
      const atLatest =
        maxOffset <= CHAT_BOTTOM_SCROLL_TOLERANCE ||
        offsetY >= maxOffset - CHAT_BOTTOM_SCROLL_TOLERANCE;
      anchorBottomRef.current = atLatest;
      return atLatest;
    },
    [maxScrollOffset]
  );

  const handleChatScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!listScrollableRef.current) return;
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const maxOffset = Math.max(
        0,
        contentSize.height - layoutMeasurement.height
      );
      let y = contentOffset.y;
      if (y > maxOffset + CHAT_BOTTOM_SCROLL_TOLERANCE) {
        flatListRef.current?.scrollToOffset({ offset: maxOffset, animated: false });
        y = maxOffset;
      }
      scrollOffsetRef.current = y;
      syncAnchoredToLatest(y);
    },
    [flatListRef, syncAnchoredToLatest]
  );

  const handleChatScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!listScrollableRef.current) return;
      syncAnchoredToLatest(event.nativeEvent.contentOffset.y);
    },
    [syncAnchoredToLatest]
  );

  const scrollToLatest = useCallback(
    (animated = false) => {
      if (messages.length === 0) return false;

      const listH = listHeightRef.current;
      const contentH = contentHeightRef.current;
      if (listH <= 0 || contentH <= listH + LIST_SCROLL_OVERFLOW_SLACK) {
        syncAnchoredToLatest(0);
        return false;
      }

      const offset = contentH - listH;
      if (
        Math.abs(scrollOffsetRef.current - offset) <= CHAT_BOTTOM_SCROLL_TOLERANCE
      ) {
        syncAnchoredToLatest(offset);
        return false;
      }

      flatListRef.current?.scrollToOffset({ offset, animated });
      scrollOffsetRef.current = offset;
      syncAnchoredToLatest(offset);
      return true;
    },
    [messages.length, flatListRef, syncAnchoredToLatest]
  );

  scrollToLatestRef.current = scrollToLatest;

  const anchorInitialScrollIfNeeded = useCallback(() => {
    if (!pendingNormalScrollRef.current || pendingScrollToMessageId) return false;

    const listH = listHeightRef.current;
    const contentH = contentHeightRef.current;
    if (listH <= 0 || contentH <= 0) return false;

    const scrollable = contentH > listH + LIST_SCROLL_OVERFLOW_SLACK;
    if (scrollable !== listScrollableRef.current) {
      listScrollableRef.current = scrollable;
      if (!layoutSettlingRef.current) {
        setListScrollable(scrollable);
      }
    }

    if (!scrollable) {
      pendingNormalScrollRef.current = false;
      anchorBottomRef.current = true;
      scrollOffsetRef.current = 0;
      return true;
    }

    const offset = contentH - listH;
    flatListRef.current?.scrollToOffset({ offset, animated: false });
    scrollOffsetRef.current = offset;
    anchorBottomRef.current = true;
    syncAnchoredToLatest(offset);
    pendingNormalScrollRef.current = false;
    return true;
  }, [flatListRef, pendingScrollToMessageId, syncAnchoredToLatest]);

  useLayoutEffect(() => {
    const wasEarlier = prevHasEarlierRef.current;
    prevHasEarlierRef.current = hasEarlierMessages;
    if (
      !wasEarlier &&
      hasEarlierMessages &&
      anchorBottomRef.current &&
      !pendingScrollToMessageId
    ) {
      pendingNormalScrollRef.current = true;
    }
  }, [hasEarlierMessages, pendingScrollToMessageId]);

  useLayoutEffect(() => {
    if (pendingScrollToMessageId) return;
    if (!messagesReady || messages.length === 0) return;
    if (!pendingNormalScrollRef.current) return;
    anchorInitialScrollIfNeeded();
  }, [
    messagesReady,
    messages.length,
    pendingScrollToMessageId,
    anchorInitialScrollIfNeeded,
    activeChat?.id,
  ]);

  useEffect(() => {
    if (!pendingScrollToMessageId || !messages.length) return;

    pendingNormalScrollRef.current = false;
    anchorBottomRef.current = false;
    const targetIndex = listData.findIndex(
      (message) => message.id === pendingScrollToMessageId
    );
    if (targetIndex < 0) return;

    const timer = setTimeout(() => {
      try {
        flatListRef.current?.scrollToIndex({
          index: targetIndex,
          animated: false,
          viewPosition: 0.4,
        });
      } catch {
        scrollToLatest(false);
      }
      setPendingScrollToMessageId(null);
    }, CHAT_PANE_ENTER_MS + 80);

    return () => clearTimeout(timer);
  }, [
    pendingScrollToMessageId,
    messages.length,
    listData,
    flatListRef,
    setPendingScrollToMessageId,
    scrollToLatest,
  ]);

  const flatListInitialRender = CHAT_LIST_INITIAL_RENDER_MIN;

  const getMessageItemLayout = useCallback(
    (_data: ArrayLike<unknown> | null | undefined, index: number) => ({
      length: CHAT_ESTIMATED_ROW_HEIGHT,
      offset: CHAT_ESTIMATED_ROW_HEIGHT * index,
      index,
    }),
    []
  );

  const setKeyboardVisible = useCallback((visible: boolean) => {
    isKeyboardOpenRef.current = visible;
    setKeyboardOpen(visible);
  }, []);

  useEffect(() => {
    const applyInset = (event: KeyboardEvent) => {
      setKeyboardInset(getKeyboardInset(event));
    };
    const onShow = (event: KeyboardEvent) => {
      applyInset(event);
      setKeyboardVisible(true);
      scheduleScrollToLatest(false);
    };
    const onHide = () => {
      setKeyboardInset(0);
      setKeyboardVisible(false);
    };

    if (Platform.OS === "ios") {
      const frameSub = Keyboard.addListener("keyboardWillChangeFrame", applyInset);
      const showSub = Keyboard.addListener("keyboardWillShow", (event) => {
        onShow(event);
        const delay = event.duration ?? 250;
        setTimeout(() => scheduleScrollToLatest(false), delay);
      });
      const hideSub = Keyboard.addListener("keyboardWillHide", onHide);
      return () => {
        frameSub.remove();
        showSub.remove();
        hideSub.remove();
      };
    }

    const showSub = Keyboard.addListener("keyboardDidShow", onShow);
    const hideSub = Keyboard.addListener("keyboardDidHide", onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [scheduleScrollToLatest, setKeyboardVisible]);

  useLayoutEffect(() => {
    if (keyboardOpen) {
      scheduleScrollToLatest(false);
    }
  }, [keyboardOpen, scheduleScrollToLatest]);

  const handleComposerFocus = useCallback(() => {
    anchorBottomRef.current = true;
    scheduleScrollToLatest(false);
  }, [scheduleScrollToLatest]);

  useEffect(() => {
    return () => {
      if (scrollRafRef.current != null) {
        cancelAnimationFrame(scrollRafRef.current);
      }
    };
  }, []);

  const listContentStyle = useMemo(
    () => [
      styles.chatListContent,
      messages.length > 0 && {
        paddingTop: 12 + CHAT_LIST_HEADER_FADE_CLEARANCE,
        paddingBottom: 10,
      },
      messagesReady && messages.length === 0 && styles.chatListContentEmpty,
    ],
    [messages.length, messagesReady, styles.chatListContent, styles.chatListContentEmpty]
  );

  const listAvatarRevision = useMemo(() => {
    const live = liveParticipantImages ?? {};
    return Object.keys(live)
      .sort()
      .map((uid) => `${uid}:${live[uid] ?? ""}`)
      .join("|");
  }, [liveParticipantImages]);

  const listExtraData = listAvatarRevision;

  const headerAvatar = useMemo(
    () => renderAvatarStack(activeChat?.participantImages, activeChat?.participants),
    [activeChat?.participantImages, activeChat?.participants, renderAvatarStack]
  );

  const renderMessage = useCallback(
    ({ item }: { item: any }) => {
      const animateEntry = shouldAnimateMessage(item);
      const isMe = item.senderId === currentUserId;
      const isSystemMessage = item.type === "system";
      const isSystemIdea = isAiSuggestionMessage(item);
      const chat = activeChatRef.current;
      const senderAvatar = resolveChatSenderAvatar(item.senderId, {
        participantImages: chat?.participantImages,
        liveImages: liveImagesRef.current,
        messageImageUrl: item.imageurl,
      });
      const RowWrapper = animateEntry ? Animated.View : View;
      const rowWrapperProps = animateEntry ? { entering: MESSAGE_ENTER } : {};

      if (isSystemMessage) {
        return (
          <RowWrapper {...rowWrapperProps}>
            <View style={styles.centeredIdeaContainer}>
              <Text style={styles.systemMessageText}>{item.text}</Text>
              <Text style={styles.timestampCentered}>{formatTime(item.createdAt)}</Text>
            </View>
          </RowWrapper>
        );
      }

      if (isSystemIdea) {
        const { name, address } = parseIdeaText(item.text);
        const isLegacyAiSuggestion = isLegacyAiSuggestionText(item.text);
        const ideaHeartCount = countHeartReactions(item.reactions);

        return (
          <RowWrapper {...rowWrapperProps}>
            <View style={styles.centeredIdeaContainer}>
              <View style={styles.ideaCardSlot}>
                <AISuggestionBubble
                  text={item.text}
                  isLegacy={isLegacyAiSuggestion}
                  name={name}
                  address={address}
                  heartCount={ideaHeartCount || 0}
                  onPress={() =>
                    onIdeaBubblePress(
                      { id: item.id, reactions: item.reactions },
                      { name, address }
                    )
                  }
                />
              </View>

              <Text style={styles.timestampCentered}>{formatTime(item.createdAt)}</Text>
            </View>
          </RowWrapper>
        );
      }

      const bubbleCap = iMessageBubbleColumnMaxWidth(windowWidth, isMe);
      const heartCount = countHeartReactions(item.reactions);

      return (
        <RowWrapper {...rowWrapperProps}>
          <View
            style={[
              styles.msgContainer,
              {
                alignItems: isMe ? "flex-end" : "flex-start",
              },
            ]}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-end",
              }}
            >
              {!isMe && (
                <Pressable
                  onPress={() => handleOpenFriendProfile(item.senderId)}
                  accessibilityRole="button"
                  accessibilityLabel="View profile"
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <ExpoImage
                    source={{ uri: senderAvatar }}
                    style={styles.chatAvatar}
                    cachePolicy="memory-disk"
                    transition={0}
                    recyclingKey={`${item.senderId}-${senderAvatar}`}
                  />
                </Pressable>
              )}

              <View
                style={[
                  styles.messageBubbleColumn,
                  {
                    maxWidth: bubbleCap,
                    alignSelf: isMe ? "flex-end" : "flex-start",
                    alignItems: isMe ? "flex-end" : "flex-start",
                  },
                ]}
              >
                <Pressable
                  onLongPress={() =>
                    onMessageLongPress?.({
                      id: item.id,
                      senderId: item.senderId,
                      text: item.text,
                    })
                  }
                  delayLongPress={400}
                >
                  <ChatMessageBubble
                    text={item.text}
                    bubbleCap={bubbleCap}
                    isMe={isMe}
                    heartCount={heartCount || 0}
                    sendStatus={item.sendStatus}
                    onPress={() =>
                      onMessageBubblePress({
                        id: item.id,
                        clientId: item.clientId,
                        text: item.text,
                        sendStatus: item.sendStatus,
                        reactions: item.reactions,
                      })
                    }
                  />
                </Pressable>
              </View>
            </View>
            <Text
              style={[
                styles.chatTimestamp,
                {
                  marginLeft: isMe ? 0 : 44,
                  alignSelf: isMe ? "flex-end" : "flex-start",
                },
              ]}
            >
              {formatTime(item.createdAt)}
            </Text>
          </View>
        </RowWrapper>
      );
    },
    [
      ChatMessageBubble,
      currentUserId,
      iMessageBubbleColumnMaxWidth,
      handleOpenFriendProfile,
      onIdeaBubblePress,
      onMessageBubblePress,
      onMessageLongPress,
      shouldAnimateMessage,
      styles,
      windowWidth,
    ]
  );

  const chatHeaderContentPaddingTop =
    Math.max(insets.top, insetsTop, 10) + PROFILE_HEADER_TOP_OFFSET + 4;
  const compactChatHeader = !showAISuggestions;
  const aiPillBelowTitle = showAISuggestions && canExpandChatTitle;
  const headerFadeHeight = chatTitleExpanded
    ? CHAT_HEADER_FADE_EXPANDED
    : CHAT_HEADER_FADE_BELOW_AI;
  const showMemberRoster = otherParticipants.length > 1;
  const memberCountLabel =
    otherParticipants.length === 1
      ? "1 person"
      : `${otherParticipants.length} people`;

  const renderCollapsedTitle = () => (
    <Pressable
      onPress={toggleChatTitleExpanded}
      style={chatHeaderOverlayStyles.titlePressable}
      accessibilityRole="button"
      accessibilityLabel="Expand participant list"
      accessibilityState={{ expanded: false }}
    >
      <Text
        style={[styles.chatTitle, chatHeaderOverlayStyles.collapsedTitleText]}
        numberOfLines={1}
      >
        {chatTitle}
      </Text>
      {showMemberRoster ? (
        <Text style={chatHeaderOverlayStyles.memberSubtitle}>
          {memberCountLabel}
        </Text>
      ) : null}
    </Pressable>
  );

  const renderExpandedTitle = () => (
    <Pressable
      onPress={toggleChatTitleExpanded}
      style={chatHeaderOverlayStyles.titlePressable}
      accessibilityRole="button"
      accessibilityLabel="Collapse participant list"
      accessibilityState={{ expanded: true }}
    >
      {chatCustomName ? (
        <Text style={chatHeaderOverlayStyles.expandedHeadline} numberOfLines={1}>
          {chatCustomName}
        </Text>
      ) : (
        <Text
          style={[styles.chatTitle, chatHeaderOverlayStyles.collapsedTitleText]}
          numberOfLines={1}
        >
          {chatTitle}
        </Text>
      )}
      <Text style={chatHeaderOverlayStyles.showLessLink}>Show less</Text>
    </Pressable>
  );

  const renderMemberStrip = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={chatHeaderOverlayStyles.memberStripScroll}
      contentContainerStyle={chatHeaderOverlayStyles.memberStripContent}
    >
      {otherParticipants.map((participant) => {
        const avatarUri = resolveChatSenderAvatar(participant.uid, {
          participantImages: activeChat?.participantImages,
          liveImages: liveParticipantImages,
        });

        return (
          <Pressable
            key={participant.uid}
            onPress={() => handleOpenFriendProfile(participant.uid)}
            disabled={!onOpenFriendProfile}
            style={({ pressed }) => [
              chatHeaderOverlayStyles.memberTile,
              pressed && onOpenFriendProfile
                ? chatHeaderOverlayStyles.memberTilePressed
                : null,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`View ${participant.name}'s profile`}
          >
            <View style={chatHeaderOverlayStyles.memberTileAvatarWrap}>
              <ExpoImage
                source={{ uri: avatarUri }}
                style={chatHeaderOverlayStyles.memberTileAvatar}
                cachePolicy="memory-disk"
                transition={0}
                recyclingKey={avatarUri}
              />
            </View>
            <Text style={chatHeaderOverlayStyles.memberTileName} numberOfLines={1}>
              {participantFirstName(participant.name)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  return (
    <View style={styles.modalBg}>
      <View
        style={[
          chatHeaderOverlayStyles.shell,
          { marginBottom: -headerFadeHeight },
        ]}
      >
        <View
          style={[
            chatHeaderOverlayStyles.headerShell,
            chatTitleExpanded && chatHeaderOverlayStyles.headerShellExpanded,
            { paddingTop: chatHeaderContentPaddingTop },
          ]}
        >
          <View
            style={[
              styles.chatHeader,
              chatTitleExpanded && chatHeaderOverlayStyles.headerTitleRowExpanded,
            ]}
          >
            <View style={styles.chatHeaderMain}>
              <View
                style={[
                  styles.chatHeaderIdentityRow,
                  chatTitleExpanded
                    ? chatHeaderOverlayStyles.identityRowExpanded
                    : chatHeaderOverlayStyles.identityRowCollapsed,
                ]}
              >
                <View style={styles.chatHeaderAvatarSlot}>
                  {headerProfileFriendId && onOpenFriendProfile ? (
                    <Pressable
                      onPress={() => handleOpenFriendProfile(headerProfileFriendId)}
                      accessibilityRole="button"
                      accessibilityLabel="View profile"
                    >
                      {headerAvatar}
                    </Pressable>
                  ) : (
                    headerAvatar
                  )}
                </View>
                <View
                  style={[
                    styles.chatHeaderTextCol,
                    compactChatHeader && styles.chatHeaderTextColCompact,
                    chatTitleExpanded
                      ? chatHeaderOverlayStyles.textColExpanded
                      : chatHeaderOverlayStyles.textColCollapsed,
                  ]}
                >
                  {canExpandChatTitle ? (
                    chatTitleExpanded ? (
                      renderExpandedTitle()
                    ) : (
                      renderCollapsedTitle()
                    )
                  ) : (
                    <Text style={styles.chatTitle} numberOfLines={1}>
                      {chatTitle}
                    </Text>
                  )}
                  {typingUserIds.length > 0 ? (
                    <Text style={styles.typingIndicatorText}>Typing…</Text>
                  ) : null}
                  {showAISuggestions && !aiPillBelowTitle ? (
                    <View style={chatHeaderOverlayStyles.aiSubtitleSlot}>
                      {renderAiChip()}
                    </View>
                  ) : null}
                </View>
              </View>
            </View>
            <CloseButton
              onPress={onBackFromChat}
              accessibilityLabel="Close chat"
              style={
                chatTitleExpanded ? chatHeaderOverlayStyles.closeBtnExpanded : undefined
              }
            />
          </View>
          {chatTitleExpanded && showMemberRoster ? renderMemberStrip() : null}
          {aiPillBelowTitle ? (
            <View style={chatHeaderOverlayStyles.aiSubtitleSlotExpanded}>
              {renderAiChip(0)}
            </View>
          ) : null}
          {showAIUnavailableMessage ? (
            <Text
              style={[styles.aiUnavailableHint, styles.chatHeaderUnavailableHint]}
              numberOfLines={2}
            >
              AI isn't available for this chat until everyone enters their
              locations.
            </Text>
          ) : null}
        </View>
        <LinearGradient
          pointerEvents="none"
          colors={[...CHAT_HEADER_FADE_GRADIENT]}
          locations={[...CHAT_HEADER_FADE_LOCATIONS]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={[chatHeaderOverlayStyles.fadeBelowAi, { height: headerFadeHeight }]}
        />
      </View>

      <View style={{ flex: 1, paddingBottom: keyboardInset }}>
        {listenerError ? (
          <Pressable
            style={chatHeaderOverlayStyles.chatErrorBanner}
            onPress={onRetryMessages}
            accessibilityRole="button"
            accessibilityLabel="Retry loading messages"
          >
            <Text style={chatHeaderOverlayStyles.chatErrorBannerText}>{listenerError}</Text>
            <Text style={chatHeaderOverlayStyles.chatErrorBannerAction}>Tap to retry</Text>
          </Pressable>
        ) : null}
        <View style={styles.chatBody}>
          <View style={styles.chatList}>
          <FlatList
            key={activeChat?.id ?? "chat"}
            ref={flatListRef}
            style={styles.chatListFill}
            data={listData}
            extraData={listExtraData}
            keyExtractor={(item, index) => {
              const key = item?.clientId ?? item?.id;
              return key ? String(key) : `message-${index}`;
            }}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews
            initialNumToRender={flatListInitialRender}
            getItemLayout={hasEarlierMessages ? undefined : getMessageItemLayout}
            maxToRenderPerBatch={6}
            windowSize={7}
            updateCellsBatchingPeriod={40}
            scrollEnabled={listPanActive}
            directionalLockEnabled={listPanActive}
            bounces={keyboardOpen}
            alwaysBounceVertical={keyboardOpen}
            overScrollMode={keyboardOpen ? "always" : "never"}
            maintainVisibleContentPosition={
              loadingEarlier && messages.length > 0
                ? { minIndexForVisible: 0, autoscrollToTopThreshold: 24 }
                : undefined
            }
            onLayout={(event) => {
              listHeightRef.current = event.nativeEvent.layout.height;
              syncListScrollable();
              anchorInitialScrollIfNeeded();
            }}
            onContentSizeChange={(_width, height) => {
              contentHeightRef.current = height;
              const scrollable = syncListScrollable();

              if (anchorInitialScrollIfNeeded()) {
                return;
              }

              if (layoutSettlingRef.current) {
                return;
              }

              if (isKeyboardOpenRef.current) {
                scheduleScrollToLatest(false);
                return;
              }
              if (anchorBottomRef.current && scrollable) {
                scheduleScrollToLatest(false);
              }
            }}
            scrollEventThrottle={16}
            onScroll={listPanActive ? handleChatScroll : undefined}
            onScrollBeginDrag={
              listPanActive
                ? () => {
                    anchorBottomRef.current = false;
                  }
                : undefined
            }
            onScrollEndDrag={listPanActive ? handleChatScrollEnd : undefined}
            onMomentumScrollEnd={listPanActive ? handleChatScrollEnd : undefined}
            ListHeaderComponent={
              hasEarlierMessages ? (
                <Pressable
                  style={chatHeaderOverlayStyles.loadEarlierBtn}
                  onPress={onLoadEarlier}
                  disabled={loadingEarlier}
                  accessibilityRole="button"
                  accessibilityLabel="Load earlier messages"
                >
                  {loadingEarlier ? (
                    <ActivityIndicator size="small" color={ACCENT} />
                  ) : (
                    <Text style={chatHeaderOverlayStyles.loadEarlierText}>Load earlier messages</Text>
                  )}
                </Pressable>
              ) : null
            }
            ListEmptyComponent={
              messagesReady ? (
                <View style={styles.chatEmptyWrap}>
                  <View style={styles.chatEmptyIconWrap}>
                    <Ionicons name="chatbubble-ellipses-outline" size={26} color={ACCENT} />
                  </View>
                  <Text style={styles.chatEmptyTitle}>Start the conversation</Text>
                  <Text style={styles.chatEmptyText}>
                    Say hi to kick this Synq off.
                  </Text>
                </View>
              ) : (
                <View style={styles.chatLoadingWrap} accessibilityLabel="Loading messages">
                  <ActivityIndicator size="small" color={ACCENT} />
                </View>
              )
            }
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            renderItem={renderMessage}
            onScrollToIndexFailed={(info) => {
              const delay = Math.min(
                Math.max(info.averageItemLength || 72, 48) *
                  Math.max(info.index, 1),
                400
              );
              setTimeout(() => {
                try {
                  flatListRef.current?.scrollToIndex({
                    index: info.index,
                    animated: true,
                    viewPosition: isKeyboardOpenRef.current ? 1 : 0.4,
                  });
                } catch {
                  scrollToLatest(false);
                }
              }, delay);
            }}
            contentContainerStyle={listContentStyle}
          />
          </View>

          {showAICard && (
            <View style={styles.inChatAICardContainer}>
              <View style={styles.inChatAICard}>
                <View style={styles.aiCardHeader}>
                  <TouchableOpacity
                    style={{ marginLeft: "auto" }}
                    onPress={() => setShowAICard(false)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <CloseIcon variant="inline" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.aiCardBodySmall}>{aiResponse}</Text>
                <TouchableOpacity style={styles.aiShareBtnSmall} onPress={sendAISuggestionToChat}>
                  <Text style={styles.aiShareBtnText}>Send to Chat</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        <View
          style={[
            styles.composerDock,
            {
              backgroundColor: BG,
              paddingBottom: composerPaddingBottom,
            },
          ]}
        >
          <View style={styles.composerShell}>
            <TextInput
              style={styles.composerInput}
              value={inputText}
              onChangeText={onComposerChange ?? setInputText}
              onFocus={handleComposerFocus}
              placeholder="Message"
              placeholderTextColor={MUTED3}
              multiline
              textAlignVertical="center"
              scrollEnabled
              returnKeyType="default"
            />
            <TouchableOpacity
              onPress={handleSend}
              style={[
                styles.sendBtnInset,
                !canSend && styles.sendBtnInsetDisabled,
              ]}
              activeOpacity={canSend ? 0.85 : 1}
              disabled={!canSend}
              accessibilityRole="button"
              accessibilityLabel="Send message"
              accessibilityState={{ disabled: !canSend }}
            >
              <View style={styles.sendIconWrap}>
                <Ionicons
                  name="send"
                  size={18}
                  color={canSend ? ON_ACCENT_TEXT : MUTED2}
                  style={canSend ? styles.sendIcon : styles.sendIconDisabled}
                />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const chatHeaderOverlayStyles = RNStyleSheet.create({
  shell: {
    position: "relative",
    zIndex: 2,
  },
  headerShell: {
    backgroundColor: HEADER_BLACK,
    paddingBottom: 6,
  },
  headerShellExpanded: {
    paddingBottom: 8,
  },
  headerTitleRowExpanded: {
    alignItems: "flex-start",
    paddingBottom: 4,
  },
  identityRowCollapsed: {
    alignItems: "center",
    flex: 1,
  },
  identityRowExpanded: {
    alignItems: "flex-start",
    flex: 0,
  },
  textColCollapsed: {
    justifyContent: "center",
    paddingTop: 2,
  },
  textColExpanded: {
    justifyContent: "flex-start",
    paddingTop: 0,
  },
  titlePressable: {
    alignSelf: "stretch",
    minWidth: 0,
  },
  collapsedTitleText: {
    flexShrink: 1,
  },
  memberSubtitle: {
    marginTop: 2,
    color: MUTED2,
    fontSize: TYPE_CAPTION,
    fontFamily: fonts.book,
    letterSpacing: 0.1,
  },
  expandedHeadline: {
    ...heroTitleText,
    letterSpacing: 0.15,
  },
  showLessLink: {
    marginTop: 3,
    color: MUTED2,
    fontSize: TYPE_CAPTION,
    fontFamily: fonts.medium,
  },
  memberStripScroll: {
    marginTop: 2,
    marginBottom: 2,
  },
  memberStripContent: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 4,
  },
  memberTile: {
    width: CHAT_MEMBER_TILE_WIDTH,
    alignItems: "center",
    marginRight: 12,
  },
  memberTilePressed: {
    opacity: 0.72,
  },
  memberTileAvatarWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: SURFACE_ELEVATED,
    overflow: "hidden",
  },
  memberTileAvatar: {
    width: "100%",
    height: "100%",
  },
  memberTileName: {
    marginTop: 7,
    width: CHAT_MEMBER_TILE_WIDTH,
    color: MUTED2,
    fontSize: TYPE_FINE,
    fontFamily: fonts.medium,
    textAlign: "center",
    letterSpacing: 0.1,
  },
  closeBtnExpanded: {
    marginTop: 2,
  },
  fadeBelowAi: {
    height: CHAT_HEADER_FADE_BELOW_AI,
  },
  aiSubtitleSlot: {
    minHeight: CHAT_AI_SUBTITLE_SLOT_HEIGHT,
    justifyContent: "center",
  },
  aiSubtitleSlotExpanded: {
    marginLeft: CHAT_HEADER_TITLE_INDENT,
    marginTop: 4,
    minHeight: CHAT_AI_SUBTITLE_SLOT_HEIGHT,
    justifyContent: "center",
  },
  typingIndicatorText: {
    color: MUTED2,
    fontSize: TYPE_FINE,
    marginTop: 2,
  },
  chatErrorBanner: {
    backgroundColor: DESTRUCTIVE_IOS_FILL,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: RNStyleSheet.hairlineWidth,
    borderBottomColor: BORDER_LIGHT,
  },
  chatErrorBannerText: {
    color: TEXT,
    fontSize: TYPE_CAPTION,
  },
  chatErrorBannerAction: {
    color: ACCENT,
    fontSize: TYPE_FINE,
    marginTop: 2,
    fontFamily: fonts.heavy,
  },
  loadEarlierBtn: {
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  loadEarlierText: {
    color: ACCENT,
    fontSize: TYPE_CAPTION,
    fontFamily: fonts.heavy,
  },
  chatLoadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 48,
    gap: 10,
  },
  chatLoadingText: {
    color: MUTED2,
    fontSize: TYPE_LEAD,
  },
});