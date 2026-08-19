import {
  ACCENT,
  BG,
  BG_TRANSPARENT,
  BORDER_LIGHT,
  DESTRUCTIVE_IOS_FILL,
  fonts,
  heroTitleText,
  MUTED2,
  MUTED3,
  ON_ACCENT_TEXT,
  messagesModalHeaderPaddingTop,
  RADIUS_XL,
  SURFACE_ELEVATED,
  SYNQ_AI_PILL_LABEL,
  TEXT,
  TYPE_CAPTION,
  TYPE_FINE,
  TYPE_LEAD,
  TYPE_MICRO
} from "@/constants/Variables";
import CloseButton from "@/src/components/CloseButton";
import CloseIcon from "@/src/components/CloseIcon";
import { ListRowsSkeleton } from "@/src/components/loading/BrandSkeletons";
import { isPollMessage } from "@/src/lib/chatPoll";
import {
  formatTime,
  getOtherChatParticipants,
  isAiSuggestionMessage,
  isLegacyAiSuggestionText,
  parseIdeaText,
  resolveChatSenderAvatar
} from "@/src/lib/helpers";
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
  FlatList,
  Keyboard,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet as RNStyleSheet,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { initialWindowMetrics, useSafeAreaInsets } from "react-native-safe-area-context";
import AISuggestionBubble from "./AISuggestionBubble";
import CreatePollSheet from "./CreatePollSheet";
import { MESSAGES_STACK_DURATION_MS } from "./MessagesModalStack";
import PollBubble from "./PollBubble";

const COMPOSER_KEYBOARD_GAP = 10;
/** Extra lift while the keyboard is open so the field isn’t covered. */
const COMPOSER_KEYBOARD_CLEARANCE = 20;
/** Inverted list: paddingTop = visual gap between the latest message and the composer. */
const CHAT_LIST_COMPOSER_CLEARANCE = 18;
const LIST_SCROLL_OVERFLOW_SLACK = 4;

/** Matches MessagesModalStack push/pop timing. */
const CHAT_PANE_ENTER_MS = MESSAGES_STACK_DURATION_MS;
/** Clamp overscroll at the latest-message edge (inverted list, offset near 0). */
const CHAT_LATEST_SCROLL_TOLERANCE = 2;
/** Brief settle after open anchor before enabling bounce/follow-up scrolls. */
const CHAT_OPEN_LAYOUT_SETTLE_MS = 220;
/** Soft reveal after stack push + first layout (hides scroll/layout flash). */
const CHAT_THREAD_REVEAL_MS = 160;
/** Fade from black into the message list, starting just under the AI chip row. */
const CHAT_HEADER_FADE_BELOW_AI = 44;
const CHAT_HEADER_FADE_EXPANDED = 52;
/** Title column starts at 88; nudge left so the chip isn’t inset by its own padding. */
const CHAT_HEADER_TITLE_INDENT = 80;
const CHAT_MEMBER_TILE_WIDTH = 68;
const THREAD_REVEAL_EASING = Easing.bezier(0.22, 1, 0.36, 1);

/** Instagram-like: only surface a time divider after this idle gap. */
const CHAT_TIMESTAMP_GAP_MS = 60 * 60 * 1000;
/** Same-sender bursts within this window share one trailing avatar. */
const CHAT_AVATAR_CLUSTER_MS = 60 * 1000;
function messageCreatedAtMs(createdAt: unknown): number {
  if (!createdAt) return 0;
  const anyTs = createdAt as { toDate?: () => Date; seconds?: number };
  if (typeof anyTs.toDate === "function") {
    const d = anyTs.toDate();
    return Number.isNaN(d.getTime()) ? 0 : d.getTime();
  }
  if (typeof anyTs.seconds === "number") return anyTs.seconds * 1000;
  const d = new Date(createdAt as string | number | Date);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

function isChatBurstNeighbor(
  a: { type?: string; senderId?: string; createdAt?: unknown } | null,
  b: { type?: string; senderId?: string; createdAt?: unknown },
  bMs: number
): boolean {
  if (
    !a ||
    a.type === "system" ||
    b.type === "system" ||
    isAiSuggestionMessage(a) ||
    isAiSuggestionMessage(b) ||
    isPollMessage(a) ||
    isPollMessage(b)
  ) {
    return false;
  }
  if (a.senderId !== b.senderId) return false;
  const aMs = messageCreatedAtMs(a.createdAt);
  if (aMs <= 0 || bMs <= 0) return false;
  return Math.abs(aMs - bMs) < CHAT_AVATAR_CLUSTER_MS;
}

function formatMessageDividerTime(createdAt: unknown): string {
  if (!createdAt) return "";
  const anyTs = createdAt as { toDate?: () => Date };
  const date =
    typeof anyTs.toDate === "function"
      ? anyTs.toDate()
      : new Date(createdAt as string | number | Date);
  if (Number.isNaN(date.getTime())) return "";

  const time = date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startMsg = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDiff = Math.round(
    (startToday.getTime() - startMsg.getTime()) / 86_400_000
  );
  if (dayDiff <= 0) return time;
  if (dayDiff === 1) return `Yesterday ${time}`;
  if (dayDiff < 7) {
    return `${date.toLocaleDateString(undefined, { weekday: "long" })} ${time}`;
  }

  const weekday = date.toLocaleDateString(undefined, { weekday: "short" });
  const monthDay = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const yearSuffix =
    date.getFullYear() !== now.getFullYear() ? `, ${date.getFullYear()}` : "";
  return `${weekday}, ${monthDay}${yearSuffix} at ${time}`;
}

/** Max iMessage-style swipe reveal for per-message times. */
const CHAT_SWIPE_REVEAL_MAX = 64;
/** Matches `chatAvatar` width + marginRight in tab styles. */
const CHAT_AVATAR_SLOT = 41;

function ChatSwipeRevealRow({
  revealX,
  timeLabel,
  children,
}: {
  revealX: SharedValue<number>;
  timeLabel: string;
  children: React.ReactNode;
}) {
  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: revealX.value }],
  }));
  const timeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      revealX.value,
      [-CHAT_SWIPE_REVEAL_MAX, -16, 0],
      [1, 0.4, 0],
      Extrapolation.CLAMP
    ),
  }));

  return (
    <View style={{ width: "100%", position: "relative" }}>
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            right: 6,
            top: 0,
            bottom: 0,
            width: CHAT_SWIPE_REVEAL_MAX - 6,
            justifyContent: "center",
            alignItems: "flex-end",
          },
          timeStyle,
        ]}
      >
        <Text
          style={{
            color: MUTED3,
            fontSize: TYPE_MICRO,
            fontFamily: fonts.medium,
            letterSpacing: 0.15,
            fontVariant: ["tabular-nums"],
          }}
          numberOfLines={1}
        >
          {timeLabel}
        </Text>
      </Animated.View>
      <Animated.View style={[rowStyle, { width: "100%" }]}>{children}</Animated.View>
    </View>
  );
}

function participantFirstName(fullName: string) {
  return (fullName || "").trim().split(/\s+/)[0];
}

const CHAT_LIST_HEADER_FADE_CLEARANCE = 10;
const CHAT_LIST_INITIAL_RENDER_MIN = 10;
const CHAT_HEADER_FADE_GRADIENT = [
  BG,
  "rgba(9,10,11,0.94)",
  "rgba(9,10,11,0.72)",
  "rgba(9,10,11,0.42)",
  "rgba(9,10,11,0.16)",
  BG_TRANSPARENT,
] as const;
const CHAT_HEADER_FADE_LOCATIONS = [0, 0.1, 0.3, 0.52, 0.76, 1] as const;

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
  onOpenAISuggestions: () => void;
  onOpenFriendProfile?: (friendId: string) => void;
  isSending?: boolean;
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
    reactions?: Record<string, string>;
  }) => void;
  onIdeaBubblePress: (
    item: { id: string; reactions?: Record<string, string> },
    mapsPayload: { name: string; address: string }
  ) => void;
  onSendPoll?: (question: string, options: string[]) => boolean | Promise<boolean>;
  onPollVote?: (messageId: string, optionIndex: number, currentVote?: number) => void;
  ChatMessageBubble: ComponentType<{
    text: string;
    bubbleCap: number;
    isMe: boolean;
    onPress: () => void;
    onLongPress?: () => void;
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
  onOpenAISuggestions,
  onOpenFriendProfile,
  isSending = false,
  sendMessage,
  sendAISuggestionToChat,
  onMessageBubblePress,
  onMessageLongPress,
  onIdeaBubblePress,
  onSendPoll,
  onPollVote,
  ChatMessageBubble,
  iMessageBubbleColumnMaxWidth,
  windowWidth,
  currentUserId,
  liveParticipantImages,
  chatOpenAnchorKey = 0,
}: Props) {
  const insets = useSafeAreaInsets();
  const canSend = inputText.trim().length > 0 && !isSending;
  const [pollSheetVisible, setPollSheetVisible] = useState(false);
  const canCreatePoll = typeof onSendPoll === "function";
  const listHeightRef = useRef(0);
  const contentHeightRef = useRef(0);
  const scrollOffsetRef = useRef(0);
  const listScrollableRef = useRef(false);
  const scrollRafRef = useRef<number | null>(null);
  const [listScrollable, setListScrollable] = useState(false);
  const [headerOverlayHeight, setHeaderOverlayHeight] = useState(0);
  const { height: keyboardHeight } = useReanimatedKeyboardAnimation();
  /**
   * Modal often reports bottom=0 on the first frame after remount.
   * Prefer the larger of live insets vs boot-time window metrics so padding
   * never flips 0 ↔ home-indicator between navigations.
   */
  const bottomInset = Math.max(
    insets.bottom,
    initialWindowMetrics?.insets.bottom ?? 0
  );
  const bottomInsetSV = useSharedValue(bottomInset);
  useEffect(() => {
    bottomInsetSV.value = bottomInset;
  }, [bottomInset, bottomInsetSV]);
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
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const threadOpacity = useSharedValue(0);
  const swipeRevealX = useSharedValue(0);
  const swipeRevealStartX = useSharedValue(0);
  const threadVisibleRef = useRef(false);

  const listData = useMemo(
    () => (messages.length > 1 ? [...messages].reverse() : messages),
    [messages]
  );

  const revealThread = useCallback(() => {
    threadVisibleRef.current = true;
    threadOpacity.value = withTiming(1, {
      duration: CHAT_THREAD_REVEAL_MS,
      easing: THREAD_REVEAL_EASING,
    });
  }, [threadOpacity]);

  const hideThread = useCallback(() => {
    threadVisibleRef.current = false;
    threadOpacity.value = 0;
  }, [threadOpacity]);

  const threadRevealStyle = useAnimatedStyle(() => ({
    opacity: threadOpacity.value,
  }));

  const swipeRevealGesture = useMemo(
    () =>
      Gesture.Pan()
        // Stay out of the way of bubble long-press / tap until a clear horizontal swipe.
        .activeOffsetX([-22, 22])
        .failOffsetY([-16, 16])
        .onBegin(() => {
          swipeRevealStartX.value = swipeRevealX.value;
        })
        .onUpdate((e) => {
          const next = swipeRevealStartX.value + e.translationX;
          swipeRevealX.value = Math.min(
            0,
            Math.max(-CHAT_SWIPE_REVEAL_MAX, next)
          );
        })
        .onEnd(() => {
          // iMessage-style peek: snap closed when the finger lifts.
          swipeRevealX.value = withTiming(0, { duration: 200 });
        }),
    [swipeRevealStartX, swipeRevealX]
  );

  useEffect(() => {
    swipeRevealX.value = 0;
  }, [activeChat?.id, swipeRevealX]);

  /**
   * List spacer tracks keyboard height only (UI thread).
   */
  const keyboardSpacerStyle = useAnimatedStyle(() => {
    // Ignore sub-pixel residue after dismiss / remount.
    const lift = keyboardHeight.value > -2 ? 0 : keyboardHeight.value;
    const absLift = -lift;
    const inset = bottomInsetSV.value;
    // Reclaim safe-area padding as the keyboard covers the home indicator.
    const reclaim = absLift <= 0 ? 0 : Math.min(inset, absLift);
    const clearance =
      absLift <= 0
        ? 0
        : COMPOSER_KEYBOARD_CLEARANCE * Math.min(1, absLift / 48);
    return {
      height: Math.max(0, absLift - reclaim + clearance),
    };
  });

  const composerDockAnimStyle = useAnimatedStyle(() => {
    const lift = keyboardHeight.value > -2 ? 0 : keyboardHeight.value;
    const absLift = -lift;
    const inset = bottomInsetSV.value;
    const reclaim = absLift <= 0 ? 0 : Math.min(inset, absLift);
    const clearance =
      absLift <= 0
        ? 0
        : COMPOSER_KEYBOARD_CLEARANCE * Math.min(1, absLift / 48);
    return {
      transform: [{ translateY: lift + reclaim - clearance }],
    };
  });

  const composerClosedPad = bottomInset + COMPOSER_KEYBOARD_GAP;

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
        accessibilityLabel={SYNQ_AI_PILL_LABEL}
      >
        <Ionicons name="sparkles" size={11} color={ACCENT} />
        <Text style={styles.aiChipTextPremium} numberOfLines={1}>
          {SYNQ_AI_PILL_LABEL}
        </Text>
        <Ionicons name="chevron-forward" size={11} color={MUTED2} />
      </TouchableOpacity>
    ),
    [onOpenAISuggestions, styles.aiChipPremium, styles.aiChipTextPremium]
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

    const pendingToReal =
      chatChanged &&
      prevId === "__pending__" &&
      !!nextId &&
      nextId !== "__pending__";

      const pendingHandoffGap =
      chatChanged && prevId === "__pending__" && !nextId;
    const keepThreadThroughHandoff = pendingToReal || pendingHandoffGap;

    if (chatChanged) {
      if (!keepThreadThroughHandoff) {
        hideThread();
        Keyboard.dismiss();
      }

      scrollOffsetRef.current = 0;
      prevHasEarlierRef.current = hasEarlierMessages;
      if (nextId) {
        prevMessagesLenByChatRef.current[nextId] = messages.length;
        if (!keepThreadThroughHandoff) {
          scheduleOpenAnchor(messages.length);
        }
      }
      if (messages.length > 0) {
        messages.forEach((message) => {
          knownMessageIdsRef.current.add(message.id);
          if (message.clientId) knownMessageIdsRef.current.add(message.clientId);
        });
        chatSeededRef.current = true;
      } else if (!keepThreadThroughHandoff) {
        knownMessageIdsRef.current = new Set();
        chatSeededRef.current = false;
        pendingNormalScrollRef.current = false;
      }
    }

    if (messages.length > 0 && !chatSeededRef.current) {
      messages.forEach((message) => {
        knownMessageIdsRef.current.add(message.id);
        if (message.clientId) knownMessageIdsRef.current.add(message.clientId);
      });
      chatSeededRef.current = true;
    }
  }, [
    activeChat?.id,
    messages,
    hasEarlierMessages,
    scheduleOpenAnchor,
    hideThread,
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

    hideThread();
    if (messages.length > 0) {
      scheduleOpenAnchor(messages.length);
    }
  }, [
    chatOpenAnchorKey,
    messages.length,
    pendingScrollToMessageId,
    scheduleOpenAnchor,
    hideThread,
  ]);

  useEffect(() => {
    return () => {
      if (openSettleTimerRef.current) {
        clearTimeout(openSettleTimerRef.current);
      }
      if (revealTimerRef.current) {
        clearTimeout(revealTimerRef.current);
      }
    };
  }, []);

  /** Reveal after the stack push settles (skeleton or content). */
  useEffect(() => {
    if (!activeChat?.id) return;
    if (revealTimerRef.current) {
      clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }

    // pending → real chat keeps opacity at 1; don't wait for the page-enter delay.
    if (threadVisibleRef.current) {
      revealThread();
      return;
    }

    revealTimerRef.current = setTimeout(() => {
      revealTimerRef.current = null;
      revealThread();
    }, CHAT_PANE_ENTER_MS);
    return () => {
      if (revealTimerRef.current) {
        clearTimeout(revealTimerRef.current);
        revealTimerRef.current = null;
      }
    };
  }, [activeChat?.id, chatOpenAnchorKey, revealThread]);

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
      knownMessageIdsRef.current.add(item.id);
      if (item.clientId) knownMessageIdsRef.current.add(item.clientId);
      return false;
    },
    []
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

  /** Coalesce scroll-to-latest work to one frame (avoids jank on long threads). */
  const scrollToLatestRef = useRef<(animated?: boolean) => boolean>(() => false);
  const scheduleScrollToLatest = useCallback((animated = false) => {
    if (scrollRafRef.current != null) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      scrollToLatestRef.current(animated);
    });
  }, []);

  const listPanActive = listScrollable || messages.length > 0;

  const syncAnchoredToLatest = useCallback((offsetY: number) => {
    const atLatest = offsetY <= CHAT_LATEST_SCROLL_TOLERANCE;
    anchorBottomRef.current = atLatest;
    return atLatest;
  }, []);

  const handleChatScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!listScrollableRef.current) return;

      const y = event.nativeEvent.contentOffset.y;
      scrollOffsetRef.current = y;
      syncAnchoredToLatest(y);
    },
    [syncAnchoredToLatest]
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

      if (scrollOffsetRef.current <= CHAT_LATEST_SCROLL_TOLERANCE) {
        syncAnchoredToLatest(0);
        return false;
      }

      flatListRef.current?.scrollToOffset({ offset: 0, animated });
      scrollOffsetRef.current = 0;
      syncAnchoredToLatest(0);
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

    // Inverted list opens at offset 0 (latest). Only nudge if we drifted.
    if (scrollable && scrollOffsetRef.current > CHAT_LATEST_SCROLL_TOLERANCE) {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
    }
    scrollOffsetRef.current = 0;
    anchorBottomRef.current = true;
    syncAnchoredToLatest(0);
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

  const handleComposerFocus = useCallback(() => {
    anchorBottomRef.current = true;
    scheduleScrollToLatest(true);
  }, [scheduleScrollToLatest]);

  /** Keep pinned to latest when new messages arrive (not on keyboard layout). */
  useEffect(() => {
    if (!anchorBottomRef.current || layoutSettlingRef.current) return;
    if (messages.length === 0) return;
    scheduleScrollToLatest(false);
  }, [messages.length, scheduleScrollToLatest]);

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
        // inverted: paddingTop = visual bottom (above composer)
        paddingTop: CHAT_LIST_COMPOSER_CLEARANCE,
        // inverted: paddingBottom = visual top (under absolute header)
        paddingBottom:
          Math.max(headerOverlayHeight, 88) + CHAT_LIST_HEADER_FADE_CLEARANCE,
      },
      messagesReady && messages.length === 0 && styles.chatListContentEmpty,
    ],
    [
      messages.length,
      messagesReady,
      headerOverlayHeight,
      styles.chatListContent,
      styles.chatListContentEmpty,
    ]
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
    ({ item, index }: { item: any; index: number }) => {
      shouldAnimateMessage(item);
      const isMe = item.senderId === currentUserId;
      const isSystemMessage = item.type === "system";
      const isSystemIdea = isAiSuggestionMessage(item);
      const chat = activeChatRef.current;
      const senderAvatar = resolveChatSenderAvatar(item.senderId, {
        participantImages: chat?.participantImages,
        liveImages: liveImagesRef.current,
        messageImageUrl: item.imageurl,
      });
      const isGroupChat = (chat?.participants?.length ?? 0) > 2;
      // listData is newest-first; prior = older, newer = more recent.
      const prior = index + 1 < listData.length ? listData[index + 1] : null;
      const newer = index > 0 ? listData[index - 1] : null;
      const itemMs = messageCreatedAtMs(item.createdAt);
      const priorMs = prior ? messageCreatedAtMs(prior.createdAt) : 0;
      // Collapsed burst only when same sender and within 1 minute.
      const inBurstWithNewer = isChatBurstNeighbor(newer, item, itemMs);
      const inBurstWithPrior = isChatBurstNeighbor(prior, item, itemMs);
      const priorIsClusterBreak = !inBurstWithPrior;
      const newerIsClusterBreak = !inBurstWithNewer;
      // Avatar on the last bubble of a ≤1min same-sender burst (newest in that group).
      const showAvatar = !isMe && !inBurstWithNewer;
      const showSenderName = isGroupChat && !isMe && priorIsClusterBreak;
      // Inverted list: marginBottom separates this row from the newer row below it.
      const gapToNewer = newer ? (newerIsClusterBreak ? 18 : 8) : 6;
      const senderName =
        chat?.participantNames?.[item.senderId]?.trim() ||
        item.senderName?.trim() ||
        "Someone";
      const senderLabel = showSenderName ? senderName : "";
      const showTimeDivider =
        !prior ||
        priorMs <= 0 ||
        itemMs <= 0 ||
        itemMs - priorMs >= CHAT_TIMESTAMP_GAP_MS;
      const timeDividerLabel = showTimeDivider
        ? formatMessageDividerTime(item.createdAt)
        : "";
      const swipeTimeLabel = formatTime(item.createdAt);

      if (isSystemMessage) {
        return (
          <View style={styles.centeredIdeaContainer}>
            <Text style={styles.systemMessageText}>{item.text}</Text>
            <Text style={styles.timestampCentered}>{formatTime(item.createdAt)}</Text>
          </View>
        );
      }

      if (isSystemIdea) {
        const { name, address } = parseIdeaText(item.text);
        const isLegacyAiSuggestion = isLegacyAiSuggestionText(item.text);
        const ideaHeartCount = countHeartReactions(item.reactions);
        const ideaCap = Math.min(
          iMessageBubbleColumnMaxWidth(windowWidth, isMe) + 24,
          Math.round(windowWidth * (isMe ? 0.68 : 0.74))
        );

        return (
          <View
            style={[
              styles.msgContainer,
              {
                alignItems: isMe ? "flex-end" : "flex-start",
                marginBottom: gapToNewer,
              },
            ]}
          >
            {timeDividerLabel ? (
              <Text style={styles.chatTimeDivider}>{timeDividerLabel}</Text>
            ) : null}
            <ChatSwipeRevealRow
              revealX={swipeRevealX}
              timeLabel={swipeTimeLabel}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-end",
                  alignSelf: "stretch",
                  justifyContent: isMe ? "flex-end" : "flex-start",
                  width: "100%",
                }}
              >
                {!isMe ? (
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
                ) : null}
                <View
                  style={[
                    styles.messageBubbleColumn,
                    styles.ideaCardSlot,
                    {
                      maxWidth: ideaCap,
                      width: ideaCap,
                      alignSelf: isMe ? "flex-end" : "flex-start",
                      alignItems: isMe ? "flex-end" : "flex-start",
                    },
                  ]}
                >
                  {!isMe ? (
                    <Text
                      style={styles.chatSenderName}
                      numberOfLines={1}
                    >
                      {senderName}
                    </Text>
                  ) : null}
                  <AISuggestionBubble
                    text={item.text}
                    isLegacy={isLegacyAiSuggestion}
                    name={name}
                    address={address}
                    why={typeof item.why === "string" ? item.why : undefined}
                    category={
                      typeof item.category === "string" ? item.category : undefined
                    }
                    heartCount={ideaHeartCount || 0}
                    onPress={() =>
                      onIdeaBubblePress(
                        { id: item.id, reactions: item.reactions },
                        { name, address }
                      )
                    }
                    onLongPress={() =>
                      onMessageLongPress?.({
                        id: item.id,
                        senderId: item.senderId,
                        text: item.text,
                        reactions: item.reactions,
                      })
                    }
                  />
                </View>
              </View>
            </ChatSwipeRevealRow>
          </View>
        );
      }

      if (isPollMessage(item)) {
        const pollOptions = Array.isArray(item.pollOptions)
          ? item.pollOptions.map((option: unknown) => String(option || "").trim()).filter(Boolean)
          : [];
        const pollCap = Math.min(
          iMessageBubbleColumnMaxWidth(windowWidth, isMe) + 24,
          Math.round(windowWidth * (isMe ? 0.72 : 0.78))
        );

        return (
          <View
            style={[
              styles.msgContainer,
              {
                alignItems: isMe ? "flex-end" : "flex-start",
                marginBottom: gapToNewer,
              },
            ]}
          >
            {timeDividerLabel ? (
              <Text style={styles.chatTimeDivider}>{timeDividerLabel}</Text>
            ) : null}
            <ChatSwipeRevealRow
              revealX={swipeRevealX}
              timeLabel={swipeTimeLabel}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-end",
                  alignSelf: "stretch",
                  justifyContent: isMe ? "flex-end" : "flex-start",
                  width: "100%",
                }}
              >
                {!isMe ? (
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
                ) : null}
                <View
                  style={[
                    styles.messageBubbleColumn,
                    styles.ideaCardSlot,
                    {
                      maxWidth: pollCap,
                      width: pollCap,
                      alignSelf: isMe ? "flex-end" : "flex-start",
                      alignItems: isMe ? "flex-end" : "flex-start",
                    },
                  ]}
                >
                  {!isMe ? (
                    <Text style={styles.chatSenderName} numberOfLines={1}>
                      {senderName}
                    </Text>
                  ) : null}
                  <PollBubble
                    question={String(item.text || "")}
                    options={pollOptions}
                    votes={item.pollVotes}
                    currentUserId={currentUserId}
                    onVote={(optionIndex) => {
                      if (String(item.id).startsWith("pending-")) return;
                      onPollVote?.(
                        item.id,
                        optionIndex,
                        typeof item.pollVotes?.[currentUserId || ""] === "number"
                          ? item.pollVotes[currentUserId || ""]
                          : undefined
                      );
                    }}
                    onLongPress={() =>
                      onMessageLongPress?.({
                        id: item.id,
                        senderId: item.senderId,
                        text: item.text,
                        reactions: item.reactions,
                      })
                    }
                  />
                </View>
              </View>
            </ChatSwipeRevealRow>
          </View>
        );
      }

      const bubbleCap = iMessageBubbleColumnMaxWidth(windowWidth, isMe);
      const heartCount = countHeartReactions(item.reactions);

      return (
          <View
            style={[
              styles.msgContainer,
              {
                alignItems: isMe ? "flex-end" : "flex-start",
                marginBottom: gapToNewer,
              },
            ]}
          >
            {timeDividerLabel ? (
              <Text style={styles.chatTimeDivider}>{timeDividerLabel}</Text>
            ) : null}
            <ChatSwipeRevealRow
              revealX={swipeRevealX}
              timeLabel={swipeTimeLabel}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-end",
                  alignSelf: "stretch",
                  justifyContent: isMe ? "flex-end" : "flex-start",
                  width: "100%",
                }}
              >
                {!isMe &&
                  (showAvatar ? (
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
                  ) : (
                    <View style={{ width: CHAT_AVATAR_SLOT }} />
                  ))}

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
                  {showSenderName ? (
                    <Text style={styles.chatSenderName} numberOfLines={1}>
                      {senderLabel}
                    </Text>
                  ) : null}
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
                    onLongPress={() =>
                      onMessageLongPress?.({
                        id: item.id,
                        senderId: item.senderId,
                        text: item.text,
                        reactions: item.reactions,
                      })
                    }
                  />
                </View>
              </View>
            </ChatSwipeRevealRow>
          </View>
      );
    },
    [
      ChatMessageBubble,
      currentUserId,
      iMessageBubbleColumnMaxWidth,
      handleOpenFriendProfile,
      listData,
      onIdeaBubblePress,
      onMessageBubblePress,
      onMessageLongPress,
      onPollVote,
      shouldAnimateMessage,
      styles,
      swipeRevealX,
      windowWidth,
    ]
  );

  const chatHeaderContentPaddingTop = messagesModalHeaderPaddingTop(
    Math.max(insets.top, insetsTop)
  );
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
      {listenerError ? (
        <Pressable
          style={[
            chatHeaderOverlayStyles.chatErrorBanner,
            { marginTop: Math.max(headerOverlayHeight, 96) },
          ]}
          onPress={onRetryMessages}
          accessibilityRole="button"
          accessibilityLabel="Retry loading messages"
        >
          <Text style={chatHeaderOverlayStyles.chatErrorBannerText}>{listenerError}</Text>
          <Text style={chatHeaderOverlayStyles.chatErrorBannerAction}>Tap to retry</Text>
        </Pressable>
      ) : null}
      <View style={styles.chatBody}>
        <Animated.View style={[styles.chatList, threadRevealStyle]}>
          <GestureDetector gesture={swipeRevealGesture}>
            <Animated.View style={styles.chatListFill}>
          <FlatList
            ref={flatListRef}
            style={styles.chatListFill}
            data={listData}
            inverted
            extraData={listExtraData}
            keyExtractor={(item, index) => {
              const key = item?.clientId ?? item?.id;
              return key ? String(key) : `message-${index}`;
            }}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={Platform.OS === "android"}
            initialNumToRender={flatListInitialRender}
            maxToRenderPerBatch={8}
            windowSize={9}
            updateCellsBatchingPeriod={50}
            scrollEnabled={listPanActive}
            directionalLockEnabled={listPanActive}
            bounces
            alwaysBounceVertical
            overScrollMode="auto"
            maintainVisibleContentPosition={
              loadingEarlier && messages.length > 0
                ? { minIndexForVisible: 1, autoscrollToTopThreshold: 24 }
                : undefined
            }
            onLayout={(event) => {
              listHeightRef.current = event.nativeEvent.layout.height;
              syncListScrollable();
              anchorInitialScrollIfNeeded();
            }}
            onContentSizeChange={(_width, height) => {
              contentHeightRef.current = height;
              syncListScrollable();
              anchorInitialScrollIfNeeded();
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
            ListFooterComponent={
              hasEarlierMessages ? (
                <Pressable
                  style={chatHeaderOverlayStyles.loadEarlierBtn}
                  onPress={onLoadEarlier}
                  disabled={loadingEarlier}
                  accessibilityRole="button"
                  accessibilityLabel="Load earlier messages"
                >
                  <Text
                    style={[
                      chatHeaderOverlayStyles.loadEarlierText,
                      loadingEarlier && { opacity: 0.5 },
                    ]}
                  >
                    Load earlier messages
                  </Text>
                </Pressable>
              ) : null
            }
            ListEmptyComponent={null}
            keyboardDismissMode="interactive"
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
                    viewPosition: 0.4,
                  });
                } catch {
                  scrollToLatest(false);
                }
              }, delay);
            }}
            contentContainerStyle={listContentStyle}
          />
          {listData.length === 0 ? (
            <View
              pointerEvents="none"
              style={chatEmptyOverlayStyles.host}
            >
              {messagesReady ? (
                <View style={styles.chatEmptyWrap}>
                  <View style={styles.chatEmptyIconWrap}>
                    <Ionicons
                      name="chatbubble-ellipses-outline"
                      size={26}
                      color={ACCENT}
                    />
                  </View>
                  <Text style={styles.chatEmptyTitle}>Start the conversation</Text>
                  <Text style={styles.chatEmptyText}>
                    Say hi to kick this Synq off.
                  </Text>
                </View>
              ) : (
                <View
                  style={styles.chatLoadingWrap}
                  accessibilityLabel="Loading messages"
                >
                  <ListRowsSkeleton count={4} withAvatar={false} />
                </View>
              )}
            </View>
          ) : null}
            </Animated.View>
          </GestureDetector>
        </Animated.View>

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

        {/* Shrinks the list viewport in sync with the keyboard (UI thread). */}
        <Animated.View style={keyboardSpacerStyle} />
      </View>

      <Animated.View
        style={[
          styles.composerDock,
          {
            backgroundColor: BG,
            paddingBottom: composerClosedPad,
          },
          composerDockAnimStyle,
        ]}
      >
        <View
          style={[
            styles.composerShell,
            canCreatePoll ? chatComposerStyles.shellWithPoll : null,
          ]}
        >
          {canCreatePoll ? (
            <TouchableOpacity
              onPress={() => {
                Keyboard.dismiss();
                setPollSheetVisible(true);
              }}
              style={chatComposerStyles.pollBtn}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Create poll"
            >
              <Ionicons name="add" size={22} color={MUTED2} />
            </TouchableOpacity>
          ) : null}
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
      </Animated.View>

      <View
        style={chatHeaderOverlayStyles.shell}
        onLayout={(event) => {
          const next = Math.ceil(event.nativeEvent.layout.height);
          if (next > 0 && next !== headerOverlayHeight) {
            setHeaderOverlayHeight(next);
          }
        }}
        pointerEvents="box-none"
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
                  {showAISuggestions && !aiPillBelowTitle && !chatTitleExpanded ? (
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
          {aiPillBelowTitle && !chatTitleExpanded ? (
            <View style={chatHeaderOverlayStyles.aiSubtitleSlotExpanded}>
              {renderAiChip(0)}
            </View>
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

      {typeof onSendPoll === "function" ? (
        <CreatePollSheet
          visible={pollSheetVisible}
          onClose={() => setPollSheetVisible(false)}
          onSend={async (question, options) => {
            const ok = await onSendPoll(question, options);
            if (ok) setPollSheetVisible(false);
            return ok;
          }}
        />
      ) : null}
    </View>
  );
}

const chatEmptyOverlayStyles = RNStyleSheet.create({
  host: {
    ...RNStyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
});

const chatHeaderOverlayStyles = RNStyleSheet.create({
  shell: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
  },
  headerShell: {
    backgroundColor: BG,
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
    borderRadius: RADIUS_XL,
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
    marginTop: 0,
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

const chatComposerStyles = RNStyleSheet.create({
  shellWithPoll: {
    paddingLeft: 6,
  },
  pollBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    flexShrink: 0,
  },
});