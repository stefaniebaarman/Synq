import ProfileTabHeaderOverlay from '@/src/components/ProfileTabHeaderOverlay';
import { useChatMessages } from '@/src/hooks/useChatMessages';
import { useSendMessage } from '@/src/hooks/useSendMessage';
import { useTypingIndicator } from '@/src/hooks/useTypingIndicator';
import { mergeMessages, pendingMatchesServer, type ChatMessage } from '@/src/lib/chatMessages';
import { trackEvent } from '@/src/lib/analytics';
import { useBlockedUsers } from '@/src/lib/blockedUsers';
import { deleteChat } from '@/src/lib/chats';
import { filterOrReject } from '@/src/lib/contentFilter';
import { ignoreSnapshotPermissionDenied } from '@/src/lib/firestoreListeners';
import { subscribeFriendGroups, type FriendGroup } from '@/src/lib/friendGroups';
import {
  findChatWithParticipants,
  mergeParticipantMaps,
  mergeParticipantSets,
  participantsMatch,
  uniqueChatIds,
} from '@/src/lib/mergeChats';
import {
  friendGroupsCacheByUser,
  friendsListCacheByUser,
  pollSynqActiveFriends,
  SYNQ_FRIEND_POLL_TTL_MS,
} from '@/src/lib/socialCache';
import {
  buildSynqBroadcastFirestorePayload,
  filterActiveFriendsForInbound,
  formatSynqAudienceLabel,
  getMyAudienceSet,
  loadSynqAudiencePreference,
  saveSynqAudiencePreference,
  selectionFromUserBroadcastFields,
  type SynqAudienceSelection,
} from '@/src/lib/synqBroadcast';
import { useSynqBoot } from '@/src/lib/synqBootContext';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image as ExpoImage } from "expo-image";
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  limit,
  serverTimestamp,
  updateDoc,
  where
} from 'firebase/firestore';
import React, { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import {
  Animated,
  ActivityIndicator,
  BackHandler,
  DeviceEventEmitter,
  Easing,
  FlatList,
  InteractionManager,
  Keyboard,
  Modal,
  PixelRatio,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  useWindowDimensions,
  Vibration,
  View
} from 'react-native';
import Reanimated, {
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

type MessagesPane = "inbox" | "chat" | "profile";
import {
  ACCENT,
  AI_PLACE_SUGGESTIONS_ENABLED,
  BG,
  BORDER,
  BORDER_MUTED,
  BUTTON_RADIUS,
  DESTRUCTIVE,
  DISABLED_CTA,
  EXPIRATION_HOURS,
  GROUP_BORDER,
  HEADER_BLACK,
  MODAL_RADIUS,
  MUTED,
  MUTED2,
  MUTED3,
  ON_ACCENT_TEXT,
  PRIMARY_CTA_HEIGHT,
  PRIMARY_CTA_WIDTH,
  SHEET_SURFACE,
  SPACE_3,
  SPACE_4,
  SPACE_5,
  STATUS_AVAILABLE,
  SURFACE,
  SURFACE_ELEVATED,
  SURFACE_INPUT,
  SURFACE_LIFTED,
  SURFACE_PANEL,
  SURFACE_SHEET_ALT,
  SURFACE_WELL,
  TEXT,
  TEXT_MUTED_HEX,
  TYPE_BODY,
  TYPE_BUTTON,
  TYPE_CAPTION,
  TYPE_FINE,
  TYPE_LEAD,
  TYPE_MICRO,
  TYPE_MODAL_TITLE,
  TYPE_SECTION,
  TYPE_SUBHEAD,
  TYPE_TITLE,
  aiPrompts,
  cardMetaText,
  cardTitleText,
  eyebrowLabel,
  fonts,
  listSectionTitle,
  tabScreenMainHeaderTitle,
} from '../../constants/Variables';
import ActiveSynqSection from '../../src/components/synq/ActiveSynqSection';
import MessagesChatPane from '../../src/components/synq/MessagesChatPane';
import MessagesInboxPane from '../../src/components/synq/MessagesInboxPane';
import MessagesModalStack from '../../src/components/synq/MessagesModalStack';
import { auth, db } from '../../src/lib/firebase';
import {
  buildLocationPrompt,
  formatUserLocationLabel,
  uniqueLocationLabels,
  type ChatAiLocationStatus,
} from "../../src/lib/chatAiLocation";
import {
  allParticipantsHaveCachedCitySuggestions,
  getCachedCitySuggestions,
  hasCachedCitySuggestions,
} from "../../src/lib/citySuggestions";
import type { SynqSuggestion } from "../../src/lib/synqSuggestions";
import {
  computeSynqActiveFromUserData,
  getCachedSynqActiveSync,
  writeCachedSynqActive,
} from "../../src/lib/synqSession";
import { registerDismissNavigationOverlaysHandler } from "../../src/lib/navigationOverlayEvents";
import { consumePendingChatOpen, peekPendingChatOpen, subscribePendingChatOpen } from "../../src/lib/pendingChatOpen";
import { CHATS_LISTENER_LIMIT } from "../../src/lib/listenerLimits";
import {
  subscribeFriendsIdsMultiplexed,
  subscribeUserDocMultiplexed,
} from "../../src/lib/socialListenerHub";
import { computeTopSynqRows, getCachedOwnProfile } from "../../src/lib/ownProfileCache";
import { userHasLocation } from "../../src/lib/userProfile";
import { useAuthRefresh } from '../_layout';
import AlertModal from '../alert-modal';
import ConfirmModal from '../confirm-modal';
import ExploreModal from '../explore-modal';
import {
  GROUP_SURFACE,
} from '../../src/components/friends/groupsListStyles';
import FriendProfile from '../friend-profile';
import {
  getChatTitle as buildChatTitle,
  getStackAvatarUris,
  isCustomAvatar,
  resolveAvatar,
  resolveChatSenderAvatar,
  SynqStatus
} from '@/src/lib/helpers';
import { openInMaps } from "@/src/lib/openInMaps";
import ReportModal from '../report-modal';
import ChangeSynqAudienceModal from '../synq-screens/ChangeSynqAudienceModal';
import EditSynqModal from '../synq-screens/EditSynqModal';
import InactiveSynqView from '../synq-screens/InactiveSynqView';
import SynqActivatingView from '../synq-screens/SynqActivatingView';

type SynqUi = { status: SynqStatus; hydrated: boolean };

function setSynqStatus(setSynq: Dispatch<SetStateAction<SynqUi>>, status: SynqStatus) {
  setSynq((s) => ({ ...s, status }));
}

const IMESSAGE_REF_SCREEN_WIDTH = 375;
const IMESSAGE_BUBBLE_MAX_WIDTH_PT = 252;
const IMESSAGE_BUBBLE_FONT_SIZE = 17;
const IMESSAGE_BUBBLE_LINE_HEIGHT = 22;
/** MessageKit / Messages.app label insets (top/bottom). */
const IMESSAGE_BUBBLE_PADDING_V = 7;
/** Horizontal inset inside the bubble (symmetric; tail space not needed in flat bubbles). */
const IMESSAGE_BUBBLE_PADDING_H = 10;
const IMESSAGE_BUBBLE_CORNER_RADIUS = 18;
const IMESSAGE_CHAT_HORIZONTAL_INSET = 8;
const IMESSAGE_BUBBLE_OUTER_MARGIN = 6;
const IMESSAGE_INCOMING_AVATAR_BLOCK = 34 + 7;

function iMessageBubbleColumnMaxWidth(windowWidth: number, isOutgoing: boolean) {
  const contentWidth = windowWidth - 2 * IMESSAGE_CHAT_HORIZONTAL_INSET;
  const scaled252 = (windowWidth / IMESSAGE_REF_SCREEN_WIDTH) * IMESSAGE_BUBBLE_MAX_WIDTH_PT;
  const capFromLayout = isOutgoing
    ? contentWidth - IMESSAGE_BUBBLE_OUTER_MARGIN
    : contentWidth - IMESSAGE_BUBBLE_OUTER_MARGIN - IMESSAGE_INCOMING_AVATAR_BLOCK;
  return Math.max(32, Math.min(scaled252, capFromLayout));
}

function ChatMessageBubble({
  text,
  bubbleCap,
  isMe,
  onPress,
  heartCount,
  sendStatus,
}: {
  text: string;
  bubbleCap: number;
  isMe: boolean;
  onPress: () => void;
  heartCount: number;
  sendStatus?: "sending" | "failed";
}) {
  const fontScale = PixelRatio.getFontScale();
  const fontSize = IMESSAGE_BUBBLE_FONT_SIZE * fontScale;
  const lineHeight = IMESSAGE_BUBBLE_LINE_HEIGHT * fontScale;
  const padV = Math.round(IMESSAGE_BUBBLE_PADDING_V * fontScale);
  const padH = Math.round(IMESSAGE_BUBBLE_PADDING_H * fontScale);
  const minHeight = padV * 2 + lineHeight;
  const innerMax = bubbleCap - padH * 2;

  return (
    <Pressable onPress={onPress}>
      <View
        style={[
          styles.bubble,
          isMe ? styles.myBubble : styles.theirBubble,
          {
            paddingTop: padV,
            paddingBottom: padV,
            paddingHorizontal: padH,
            minHeight,
            maxWidth: bubbleCap,
            alignSelf: "flex-start",
          },
          { position: "relative", overflow: "visible" },
        ]}
      >
        <Text
          style={[
            styles.bubbleText,
            {
              color: isMe ? "black" : "white",
              fontSize,
              lineHeight,
              maxWidth: innerMax,
              textAlign: "left",
            },
            sendStatus === "failed" && { color: isMe ? "#8B0000" : "#FFB4B4" },
          ]}
          {...Platform.select({
            ios: { lineBreakStrategyIOS: "standard" as const },
            android: { textBreakStrategy: "simple" as const },
          })}
        >
          {text}
        </Text>
        {sendStatus === "failed" ? (
          <Text style={styles.failedMessageHint}>Tap to retry</Text>
        ) : null}
        {heartCount > 0 ? (
          <View
            style={[
              styles.heartReaction,
              isMe ? { left: -10, right: undefined } : { right: -10, left: undefined },
            ]}
          >
            {Array.from({ length: heartCount }, (_, i) => (
              <View
                key={i}
                style={[
                  styles.heartReactionBadge,
                  i > 0 && styles.heartReactionBadgeOverlap,
                ]}
              >
                <Ionicons name="heart" size={12} color="#FF2D55" />
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const MemoChatMessageBubble = React.memo(ChatMessageBubble);

export default function SynqScreen() {
  const { user } = useAuthRefresh();
  const synqBoot = useSynqBoot();
  const router = useRouter();
  const routeParams = useLocalSearchParams<{
    openChatId?: string | string[];
    openPendingChat?: string;
  }>();
  const isIndexFocused = useIsFocused();
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tabletContentStyle =
    windowWidth >= 768
      ? { maxWidth: 840, width: '100%' as const, alignSelf: 'center' as const }
      : undefined;

  const [memo, setMemo] = useState('');
  const uid = user?.uid ?? "";
  const cachedSynqActiveOnMount =
    synqBoot?.cachedSynqActive === true ||
    (uid ? getCachedSynqActiveSync(uid) : false);
  const [synq, setSynq] = useState<SynqUi>(() => ({
    status: cachedSynqActiveOnMount ? "active" : "idle",
    hydrated: cachedSynqActiveOnMount,
  }));
  const { status, hydrated } = synq;
  const [availableFriends, setAvailableFriends] = useState<any[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [messagesModalVisible, setMessagesModalVisible] = useState(false);
  const [messagesPane, setMessagesPane] = useState<MessagesPane>("inbox");
  const messagesPaneRef = useRef<MessagesPane>("inbox");
  const [profileFriendId, setProfileFriendId] = useState<string | null>(null);
  const isChatPaneOpen = messagesModalVisible && messagesPane === "chat";
  const [isExploreVisible, setIsExploreVisible] = useState(false);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chatOpenAnchorKey, setChatOpenAnchorKey] = useState(0);
  const bumpChatOpenAnchor = useCallback(() => {
    setChatOpenAnchorKey((key) => key + 1);
  }, []);
  const [pendingNewChat, setPendingNewChat] = useState<{
    chatId?: string;
    participants: string[];
    participantNames: Record<string, string>;
    participantImages: Record<string, string>;
    communityGroupId?: string;
    communityGroupName?: string;
    communityPlanId?: string;
    communityPlanTitle?: string;
  } | null>(null);
  const [allChats, setAllChats] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [isAILoading, setIsAILoading] = useState(false);
  const [showAICard, setShowAICard] = useState(false);
  const [aiResponse, setAiResponse] = useState('');
  const [aiOptions, setAiOptions] = useState<any[]>([]);
  const [selectedOption, setSelectedOption] = useState<any>(null);
  const [showOptionsList, setShowOptionsList] = useState(false);
  const [currentCategory, setCurrentCategory] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const chatOpenGraceRef = useRef<Map<string, number>>(new Map());
  const chatsHydratedRef = useRef(false);
  const [pendingScrollToMessageId, setPendingScrollToMessageId] = useState<string | null>(null);
  const lastTapRef = useRef<{ [key: string]: number }>({});
  const [hasUnread, setHasUnread] = useState(false);
  const [showEndSynqModal, setShowEndSynqModal] = useState(false);
  const [friendGroups, setFriendGroups] = useState<FriendGroup[]>([]);
  const [audienceSelection, setAudienceSelection] = useState<SynqAudienceSelection>({
    mode: "all",
    groupIds: [],
  });
  const [changeAudienceVisible, setChangeAudienceVisible] = useState(false);
  const [friendIds, setFriendIds] = useState<string[]>([]);
  const [showDeleteChatModal, setShowDeleteChatModal] = useState(false);
  const [pendingDeleteChatId, setPendingDeleteChatId] = useState<string | null>(null);
  const [mergeSelectMode, setMergeSelectMode] = useState(false);
  const [selectedMergeChatIds, setSelectedMergeChatIds] = useState<string[]>([]);
  const [showMergeConfirmModal, setShowMergeConfirmModal] = useState(false);
  const [isMergingChats, setIsMergingChats] = useState(false);
  const [inboxActionChat, setInboxActionChat] = useState<any | null>(null);
  const [rotatingAIText, setRotatingAIText] = useState(aiPrompts[0]);
  const [aiExploreError, setAiExploreError] = useState<string | null>(null);
  const activeParticipantIdsRef = useRef<string[]>([]);
  const [isStartingSynq, setIsStartingSynq] = useState(false);
  const [launchOverlay, setLaunchOverlay] = useState(false);
  const [contentAlertVisible, setContentAlertVisible] = useState(false);
  const [contentAlertTitle, setContentAlertTitle] = useState("Content not allowed");
  const [contentAlertMessage, setContentAlertMessage] = useState("");
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportTarget, setReportTarget] = useState<{
    reportedUserId: string;
    messageId: string;
    chatId: string;
  } | null>(null);
  const { isBlocked } = useBlockedUsers();
  const activePulseOpacity = useRef(new Animated.Value(1)).current;
  const activePulseScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    messagesPaneRef.current = messagesPane;
  }, [messagesPane]);

  const navigateMessagesPane = useCallback((next: MessagesPane) => {
    if (next === messagesPaneRef.current) return;
    setMessagesPane(next);
  }, []);

  const hiddenChatIds = useMemo(
    () =>
      Array.isArray(userProfile?.hiddenChatIds)
        ? (userProfile.hiddenChatIds as string[]).filter(Boolean)
        : [],
    [userProfile?.hiddenChatIds]
  );

  const visibleChats = useMemo(() => {
    const myId = auth.currentUser?.uid;
    if (!myId) return allChats;
    const hidden = new Set(hiddenChatIds);
    return allChats.filter(
      (c) =>
        !hidden.has(c.id) &&
        !(c.participants || []).some(
          (p: string) => p && p !== myId && isBlocked(p)
        )
    );
  }, [allChats, isBlocked, hiddenChatIds]);

  const inboxChats = useMemo(() => {
    return [...visibleChats].sort((a, b) => {
      const aMs = a.updatedAt?.toMillis?.() ?? a.createdAt?.toMillis?.() ?? 0;
      const bMs = b.updatedAt?.toMillis?.() ?? b.createdAt?.toMillis?.() ?? 0;
      return bMs - aMs;
    });
  }, [visibleChats]);

  useEffect(() => {
    if (!activeChatId || !auth.currentUser?.uid) return;
    const chat = allChats.find((c) => c.id === activeChatId);
    const myId = auth.currentUser.uid;
    if (
      chat &&
      (chat.participants || []).some(
        (p: string) => p && p !== myId && isBlocked(p)
      )
    ) {
      setActiveChatId(null);
      clearMessages();
      navigateMessagesPane("inbox");
      setPendingNewChat(null);
    }
  }, [activeChatId, allChats, isBlocked, navigateMessagesPane]);

  const rejectIfObjectionable = (text: string): boolean => {
    const result = filterOrReject(text);
    if (!result.ok) {
      setContentAlertTitle("Content not allowed");
      setContentAlertMessage(result.reason);
      setContentAlertVisible(true);
      return true;
    }
    return false;
  };

  const showActionError = useCallback((message: string, title = "Something went wrong") => {
    setContentAlertTitle(title);
    setContentAlertMessage(message);
    setContentAlertVisible(true);
  }, []);

  const {
    serverMessages,
    messagesReady,
    listenerError,
    hasEarlierMessages,
    loadingEarlier,
    messagesCacheByChatIdRef,
    prepareChatSync,
    hydrateChatMessages,
    loadEarlierMessages,
    markChatRead,
    retryListener,
    clearMessages,
  } = useChatMessages({
    activeChatId,
    isChatPaneOpen,
    pendingNewChat,
  });

  const moderationTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const serverMessagesRef = useRef<ReturnType<typeof useChatMessages>["serverMessages"]>([]);
  const onMessageDeliveredRef = useRef<
    (clientId: string, meta: { text: string; senderId: string; sentAt: number }) => void
  >(() => {});

  const {
    pendingMessages,
    sendMessage: sendMessageCore,
    retryFailedMessage,
    clearPendingMessages,
    ensureChatFromPending,
    recentlySentRef,
    sendOrderByServerIdRef,
  } = useSendMessage({
    activeChatId,
    pendingNewChat,
    allChats,
    serverMessages,
    setActiveChatId,
    setPendingNewChat,
    resolveAvatar,
    userAvatar: userProfile?.imageurl,
    rejectIfObjectionable,
    isBlocked,
    onSendError: (msg) => showActionError(msg),
    onMessageDelivered: (clientId, meta) => onMessageDeliveredRef.current(clientId, meta),
  });

  const messages = useMemo(() => {
    const merged = mergeMessages(serverMessages, pendingMessages);
    const orderHints = sendOrderByServerIdRef.current;
    if (orderHints.size === 0) return merged;
    return merged.map((message: ChatMessage & { sendOrder?: number }) => {
      if (typeof message.sendOrder === "number") return message;
      const sendOrder = orderHints.get(message.id);
      return sendOrder != null ? { ...message, sendOrder } : message;
    });
  }, [serverMessages, pendingMessages]);

  serverMessagesRef.current = serverMessages;

  onMessageDeliveredRef.current = (clientId, meta) => {
    const existing = moderationTimersRef.current.get(clientId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      moderationTimersRef.current.delete(clientId);
      if (!recentlySentRef.current.has(clientId)) return;

      const matched = serverMessagesRef.current.some((m) =>
        pendingMatchesServer(
          {
            id: clientId,
            clientId,
            text: meta.text,
            senderId: meta.senderId,
            sendStatus: "sending",
            createdAt: meta.sentAt,
          },
          m
        )
      );
      recentlySentRef.current.delete(clientId);
      if (!matched) {
        showActionError(
          "This message was removed because it isn't allowed on Synq.",
          "Message removed"
        );
      }
    }, 12_000);

    moderationTimersRef.current.set(clientId, timer);
  };

  useEffect(() => {
    if (!messagesReady || recentlySentRef.current.size === 0) return;

    for (const [clientId, meta] of [...recentlySentRef.current.entries()]) {
      const matched = serverMessages.some((m) =>
        pendingMatchesServer(
          {
            id: clientId,
            clientId,
            text: meta.text,
            senderId: meta.senderId,
            sendStatus: "sending",
            createdAt: meta.sentAt,
          },
          m
        )
      );
      if (matched) {
        recentlySentRef.current.delete(clientId);
        const pendingTimer = moderationTimersRef.current.get(clientId);
        if (pendingTimer) clearTimeout(pendingTimer);
        moderationTimersRef.current.delete(clientId);
      }
    }
  }, [serverMessages, messagesReady, recentlySentRef]);

  useEffect(() => {
    return () => {
      moderationTimersRef.current.forEach((timer) => clearTimeout(timer));
      moderationTimersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!messagesModalVisible) return;
    for (const chat of inboxChats) {
      if (messagesCacheByChatIdRef.current[chat.id]) continue;
      void hydrateChatMessages(chat.id);
    }
  }, [messagesModalVisible, inboxChats, hydrateChatMessages]);

  const prefetchChatOnPress = useCallback(
    (chatId: string) => {
      if (!messagesCacheByChatIdRef.current[chatId]) {
        void hydrateChatMessages(chatId);
      }
    },
    [hydrateChatMessages, messagesCacheByChatIdRef]
  );

  const beginOpeningChat = useCallback(
    (chatId: string) => {
      setPendingNewChat(null);
      prepareChatSync(chatId);
      setActiveChatId(chatId);
      bumpChatOpenAnchor();
      navigateMessagesPane("chat");
      void markChatRead(chatId);
    },
    [
      prepareChatSync,
      bumpChatOpenAnchor,
      navigateMessagesPane,
      markChatRead,
    ]
  );

  const openChatById = useCallback(
    async (
      chatId: string,
      opts?: { messageId?: string | null; prefetchChatDoc?: boolean }
    ) => {
      if (opts?.prefetchChatDoc !== false) {
        try {
          await getDoc(doc(db, "chats", chatId));
        } catch {}
      }
      setPendingNewChat(null);
      beginOpeningChat(chatId);
      setMessagesModalVisible(true);
      const mid = opts?.messageId;
      setPendingScrollToMessageId(
        typeof mid === "string" && mid.trim() ? mid.trim() : null
      );
    },
    [beginOpeningChat]
  );

  const DOUBLE_TAP_MS = 320;
  const onMessageBubblePress = (item: {
    id: string;
    text?: string;
    clientId?: string;
    sendStatus?: "sending" | "failed";
    reactions?: Record<string, string>;
  }) => {
    if (item.sendStatus === "failed" && item.text) {
      void retryFailedMessage(item.clientId || item.id, item.text);
      return;
    }
    if (item.id.startsWith("pending-")) return;

    const now = Date.now();
    const last = lastTapRef.current[item.id] ?? 0;
    if (now - last < DOUBLE_TAP_MS) {
      lastTapRef.current[item.id] = 0;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      void toggleHeartReaction(item.id, item.reactions);
    } else {
      lastTapRef.current[item.id] = now;
    }
  };

  const onIdeaBubblePress = (
    item: { id: string; reactions?: Record<string, string> },
    mapsPayload: { name: string; address: string }
  ) => {
    const now = Date.now();
    const last = lastTapRef.current[item.id] ?? 0;
    if (now - last < DOUBLE_TAP_MS) {
      lastTapRef.current[item.id] = 0;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      void toggleHeartReaction(item.id, item.reactions);
      return;
    }
    lastTapRef.current[item.id] = now;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    openInMaps(mapsPayload);
  };

  useEffect(() => {
    if (!AI_PLACE_SUGGESTIONS_ENABLED) return;
    let index = 0;

    const interval = setInterval(() => {
      index = (index + 1) % aiPrompts.length;
      setRotatingAIText(aiPrompts[index]);
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (status !== 'active') return;
    const pulseDown = Animated.parallel([
      Animated.timing(activePulseOpacity, {
        toValue: 0.62,
        duration: 1200,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(activePulseScale, {
        toValue: 0.94,
        duration: 1200,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    ]);
    const pulseUp = Animated.parallel([
      Animated.timing(activePulseOpacity, {
        toValue: 1,
        duration: 1200,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(activePulseScale, {
        toValue: 1,
        duration: 1200,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    ]);
    const loop = Animated.loop(Animated.sequence([pulseDown, pulseUp]));
    loop.start();
    return () => {
      loop.stop();
      activePulseOpacity.setValue(1);
      activePulseScale.setValue(1);
    };
  }, [status, activePulseOpacity, activePulseScale]);

  const openPendingChatFromNotification = useCallback(() => {
    const pending = peekPendingChatOpen();
    if (!pending) return;

    const finish = () => consumePendingChatOpen();

    if (pending.mode === "existing") {
      finish();
      void openChatById(pending.chatId, {
        messageId: pending.messageId ?? null,
        prefetchChatDoc: true,
      });
      return;
    }

    if (pending.chatId) {
      const stableChat = allChats.find((chat) => chat.id === pending.chatId);
      if (stableChat) {
        finish();
        void openChatById(pending.chatId, { prefetchChatDoc: true });
        return;
      }
    }

    if (!chatsHydratedRef.current && allChats.length === 0) {
      return;
    }

    const existing = allChats.find((chat) => {
      if (pending.chatId && chat.id === pending.chatId) return true;
      const chatParticipants = [...(chat.participants || [])].sort();
      return (
        JSON.stringify(chatParticipants) === JSON.stringify(pending.participants)
      );
    });

    if (existing) {
      finish();
      void openChatById(existing.id, { prefetchChatDoc: true });
      return;
    }

    finish();
    setPendingNewChat({
      chatId: pending.chatId,
      participants: pending.participants,
      participantNames: pending.participantNames,
      participantImages: pending.participantImages,
      communityGroupId: pending.communityGroupId,
      communityGroupName: pending.communityGroupName,
      communityPlanId: pending.communityPlanId,
      communityPlanTitle: pending.communityPlanTitle,
    });
    setActiveChatId(null);
    clearMessages();
    bumpChatOpenAnchor();
    setMessagesModalVisible(true);
    navigateMessagesPane("chat");
  }, [
    allChats,
    openChatById,
    bumpChatOpenAnchor,
    navigateMessagesPane,
    clearMessages,
  ]);

  useFocusEffect(
    useCallback(() => {
      openPendingChatFromNotification();
    }, [openPendingChatFromNotification])
  );

  useEffect(() => {
    const unsub = subscribePendingChatOpen(() => {
      if (isIndexFocused) {
        openPendingChatFromNotification();
      }
    });
    return unsub;
  }, [isIndexFocused, openPendingChatFromNotification]);

  const openChatIdParam = useMemo(() => {
    const raw = routeParams.openChatId;
    if (typeof raw === "string") return raw.trim();
    if (Array.isArray(raw)) return raw[0]?.trim() ?? "";
    return "";
  }, [routeParams.openChatId]);

  useEffect(() => {
    if (!openChatIdParam) return;
    router.setParams({ openChatId: "" });
    const task = InteractionManager.runAfterInteractions(() => {
      void openChatById(openChatIdParam, { prefetchChatDoc: true });
    });
    return () => task.cancel();
  }, [openChatIdParam, openChatById, router]);

  useEffect(() => {
    if (routeParams.openPendingChat !== "1") return;
    router.setParams({ openPendingChat: "" });
    const task = InteractionManager.runAfterInteractions(() => {
      openPendingChatFromNotification();
    });
    return () => task.cancel();
  }, [routeParams.openPendingChat, openPendingChatFromNotification, router]);

  useEffect(() => {
    if (!pendingScrollToMessageId) return;
    if (!messagesReady || !messages.length) return;
    const failSafe = setTimeout(() => setPendingScrollToMessageId(null), 10000);
    return () => clearTimeout(failSafe);
  }, [pendingScrollToMessageId, messagesReady, messages.length]);
  useEffect(() => {
    if (isExploreVisible) {
      Keyboard.dismiss();
    }
  }, [isExploreVisible]);

  const clearSynqBroadcastFields = useMemo(
    () => ({
      synqBroadcastMode: deleteField(),
      synqBroadcastGroupIds: deleteField(),
      synqVisibleTo: deleteField(),
    }),
    []
  );

  useEffect(() => {
    const uid = user?.uid;
    if (!uid) return;
    void loadSynqAudiencePreference(uid).then(setAudienceSelection);
  }, [user?.uid]);

  useEffect(() => {
    const uid = user?.uid;
    if (!uid) return;
    const unsub = subscribeFriendGroups(
      uid,
      (groups) => {
        friendGroupsCacheByUser[uid] = groups;
        setFriendGroups(groups);
      },
      () => {}
    );
    return unsub;
  }, [user?.uid]);

  useEffect(() => {
    const uid = user?.uid;
    if (!uid) return;
    return subscribeFriendsIdsMultiplexed(uid, (ids) => {
      setFriendIds(ids);
    });
  }, [user?.uid]);

  useEffect(() => {
    const uid = user?.uid;
    if (!uid) return;
    return subscribeUserDocMultiplexed(uid, (data) => {
      if (!data) return;
      setUserProfile(data);
      if (computeSynqActiveFromUserData(data)) {
        setAudienceSelection(selectionFromUserBroadcastFields(data));
      }
    });
  }, [user?.uid]);

  const resolvedFriendIds = useMemo(() => {
    const uid = user?.uid;
    if (!uid) return [];
    if (friendIds.length) return friendIds;
    return (friendsListCacheByUser[uid] ?? []).map((f) => f.id);
  }, [user?.uid, friendIds]);

  const visibleAvailableFriends = useMemo(() => {
    const unblocked = availableFriends.filter((f) => !isBlocked(f.id));
    const uid = user?.uid;
    if (!uid || status !== "active") return unblocked;
    const myAudience = getMyAudienceSet(userProfile, resolvedFriendIds);
    return filterActiveFriendsForInbound(unblocked, {
      myAudience,
      viewerId: uid,
    });
  }, [availableFriends, isBlocked, userProfile, resolvedFriendIds, status, user?.uid]);

  const nudgeCandidates = useMemo(() => {
    const uid = user?.uid;
    if (!uid || status !== "active" || visibleAvailableFriends.length > 0) return [];
    const friends = friendsListCacheByUser[uid] ?? [];
    if (!friends.length) return [];
    const activeIds = new Set(availableFriends.map((f) => f.id));
    return computeTopSynqRows(uid, friends)
      .map(({ friend }) => friend)
      .filter((f) => !activeIds.has(f.id) && !isBlocked(f.id))
      .slice(0, 3);
  }, [
    user?.uid,
    status,
    visibleAvailableFriends.length,
    availableFriends,
    isBlocked,
    resolvedFriendIds,
  ]);

  const synqAudienceLabel = useMemo(
    () => formatSynqAudienceLabel(userProfile, friendGroups),
    [userProfile, friendGroups]
  );

  useEffect(() => {
    const effectUid = user?.uid;
    if (!effectUid) return;
    chatsHydratedRef.current = false;
    let cancelled = false;

    const cachedProfile = getCachedOwnProfile(effectUid);
    if (cachedProfile) {
      setUserProfile(cachedProfile);
    }

    const init = async () => {
      let nextStatus: SynqStatus = getCachedSynqActiveSync(effectUid)
        ? "active"
        : "idle";
      try {
        const userRef = doc(db, 'users', effectUid);

        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const data = userSnap.data();
          if (!cancelled) {
            setUserProfile(data);
            setMemo(data.memo || '');
          }
          if (computeSynqActiveFromUserData(data)) {
            nextStatus = "active";
            writeCachedSynqActive(effectUid, true);
          } else {
            if (data.status === 'available' && data.synqStartedAt) {
              const startTime = data.synqStartedAt.toDate().getTime();
              const hoursElapsed = (new Date().getTime() - startTime) / (1000 * 60 * 60);
              if (hoursElapsed > EXPIRATION_HOURS) {
                if (!cancelled && auth.currentUser?.uid === effectUid) {
                  await updateDoc(userRef, {
                    status: "inactive",
                    memo: "",
                    ...clearSynqBroadcastFields,
                  });
                }
                if (!cancelled) setMemo("");
              }
            }
            nextStatus = "idle";
            writeCachedSynqActive(effectUid, false);
          }
        }
      } catch {
        if (!getCachedSynqActiveSync(effectUid)) {
          nextStatus = "idle";
        }
      }
      if (!cancelled) {
        setSynq({ status: nextStatus, hydrated: true });
      }
    };

    init();

    const q = query(
      collection(db, "chats"),
      where("participants", "array-contains", uid),
      orderBy("createdAt", "desc"),
      limit(CHATS_LISTENER_LIMIT)
    );

    const unsubChats = onSnapshot(
      q,
      (snap) => {
      chatsHydratedRef.current = true;
      const chats = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];

      chats.sort((a, b) => {
        const aMs = a.updatedAt?.toMillis?.() ?? a.createdAt?.toMillis?.() ?? 0;
        const bMs = b.updatedAt?.toMillis?.() ?? b.createdAt?.toMillis?.() ?? 0;
        return bMs - aMs;
      });

      setAllChats(chats);
      const anyUnread = chats.some((c: any) => {
        const updatedAtMs = c.updatedAt?.toMillis?.() ?? 0;
        const lastReadMs = c.lastReadBy?.[uid]?.toMillis?.() ?? 0;
        const lastSender = c.lastMessageSenderId;
        return !!lastSender && lastSender !== uid && updatedAtMs > lastReadMs;
      });

      setHasUnread(anyUnread);
      openPendingChatFromNotification();
    },
      ignoreSnapshotPermissionDenied
    );

    return () => {
      cancelled = true;
      unsubChats();
    };
  }, [user?.uid]);

  useEffect(() => {
    const myId = user?.uid;
    if (!myId || status !== "active") {
      setAvailableFriends([]);
      return;
    }

    const friendIds = resolvedFriendIds;
    if (!friendIds.length) {
      setAvailableFriends([]);
      return;
    }

    let cancelled = false;
    const refreshAvailable = async (force = false) => {
      const next = await pollSynqActiveFriends(myId, friendIds, { force });
      if (!cancelled) setAvailableFriends(next);
    };

    void refreshAvailable(true);
    const interval = setInterval(() => {
      void refreshAvailable(false);
    }, SYNQ_FRIEND_POLL_TTL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [status, user?.uid, resolvedFriendIds]);

  useEffect(() => {
    if (activeChatId) {
      chatOpenGraceRef.current.set(activeChatId, Date.now());
    }
  }, [activeChatId]);

  useEffect(() => {
    if (!messagesModalVisible || pendingNewChat) return;
    const activeChatMissing =
      !!activeChatId &&
      allChats.length > 0 &&
      !allChats.some((c) => c.id === activeChatId);
    if (!activeChatMissing) return;

    const openedAt = chatOpenGraceRef.current.get(activeChatId);
    const inGracePeriod =
      typeof openedAt === "number" && Date.now() - openedAt < 15_000;
    const hasCachedMessages = !!messagesCacheByChatIdRef.current[activeChatId];

    if (inGracePeriod || hasCachedMessages) return;

    setActiveChatId(null);
    clearMessages();
    navigateMessagesPane("inbox");
  }, [messagesModalVisible, activeChatId, allChats, pendingNewChat, navigateMessagesPane, clearMessages, messagesCacheByChatIdRef]);

  const activeParticipantIds = useMemo(() => {
    let ids: string[] = [];
    if (pendingNewChat?.participants?.length) {
      ids = pendingNewChat.participants.filter(Boolean);
    } else {
      const chat = allChats.find((c) => c.id === activeChatId);
      ids = (chat?.participants ?? []).filter(Boolean);
    }
    if (ids.length > 0) {
      activeParticipantIdsRef.current = ids;
      return ids;
    }
    return activeParticipantIdsRef.current;
  }, [pendingNewChat, activeChatId, allChats]);

  const activeParticipantIdsKey = activeParticipantIds.join("|");

  const {
    typingUserIds,
    notifyInputChange,
    stopTyping,
    ingestChatTypingSnapshot,
  } = useTypingIndicator({
    chatId: activeChatId,
    enabled: isChatPaneOpen && !pendingNewChat,
    participantIds: activeParticipantIds,
  });

  useEffect(() => {
    const chat = allChats.find((c) => c.id === activeChatId);
    ingestChatTypingSnapshot(chat?.typingBy as Record<string, unknown> | undefined);
  }, [allChats, activeChatId, ingestChatTypingSnapshot]);

  const [liveParticipantImages, setLiveParticipantImages] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    if (!isChatPaneOpen || activeParticipantIds.length === 0) {
      setLiveParticipantImages({});
      return;
    }

    const unsubs = activeParticipantIds.map((uid: string) =>
      onSnapshot(
        doc(db, "users", uid),
        (snap) => {
          if (!snap.exists()) {
            setLiveParticipantImages((prev) => {
              if (!(uid in prev)) return prev;
              const next = { ...prev };
              delete next[uid];
              return next;
            });
            return;
          }
          const resolved = resolveAvatar(snap.data()?.imageurl);
          setLiveParticipantImages((prev) => {
            if (prev[uid] === resolved) return prev;
            return { ...prev, [uid]: resolved };
          });
        },
        ignoreSnapshotPermissionDenied
      )
    );

    return () => {
      unsubs.forEach((unsub: () => any) => unsub());
      setLiveParticipantImages({});
    };
  }, [isChatPaneOpen, activeParticipantIdsKey]);

  const freshParticipantImages = useCallback(
    (
      base: Record<string, string>,
      participants: string[]
    ): Record<string, string> => {
      const images = { ...base };
      const myId = auth.currentUser?.uid;
      for (const uid of participants) {
        const resolved = resolveChatSenderAvatar(uid, {
          participantImages: images,
          liveImages: liveParticipantImages,
          messageImageUrl: uid === myId ? userProfile?.imageurl : undefined,
        });
        if (isCustomAvatar(resolved)) {
          images[uid] = resolved;
        }
      }
      return images;
    },
    [liveParticipantImages, userProfile?.imageurl]
  );

  const completeSynqLaunch = useCallback(() => {
    Vibration.vibrate(400);
    setSynqStatus(setSynq, "active");
    setLaunchOverlay(false);
  }, [setSynq]);

  const [chatAiLocationStatus, setChatAiLocationStatus] =
    useState<ChatAiLocationStatus>("loading");
  const [chatAiLocationPrompt, setChatAiLocationPrompt] = useState("");
  const [chatParticipantsHaveCachedCity, setChatParticipantsHaveCachedCity] =
    useState(false);
  const chatAiParticipantsKeyRef = useRef("");

  useEffect(() => {
    if (messagesPane !== "chat" || activeParticipantIds.length === 0) {
      setChatAiLocationStatus("loading");
      setChatAiLocationPrompt("");
      setChatParticipantsHaveCachedCity(false);
      return;
    }

    let cancelled = false;
    const participantsChanged =
      chatAiParticipantsKeyRef.current !== activeParticipantIdsKey;
    chatAiParticipantsKeyRef.current = activeParticipantIdsKey;
    if (participantsChanged) {
      setChatAiLocationStatus("loading");
      setChatParticipantsHaveCachedCity(false);
    }
    void (async () => {
      try {
        const snaps = await Promise.all(
          activeParticipantIds.map((uid: string) => getDoc(doc(db, "users", uid)))
        );
        if (cancelled) return;
        const participantData = snaps
          .filter((snap) => snap.exists())
          .map((snap) => snap.data() as Record<string, unknown>);
        const allHaveCachedCity =
          allParticipantsHaveCachedCitySuggestions(participantData);
        setChatParticipantsHaveCachedCity(allHaveCachedCity);

        if (!participantData.every((data) => userHasLocation(data))) {
          setChatAiLocationStatus("missing_location");
          setChatAiLocationPrompt("");
          return;
        }

        setChatAiLocationStatus("available");
        setChatAiLocationPrompt(
          buildLocationPrompt(uniqueLocationLabels(participantData))
        );
      } catch {
        if (!cancelled) {
          setChatAiLocationStatus("missing_location");
          setChatAiLocationPrompt("");
          setChatParticipantsHaveCachedCity(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [messagesPane, activeParticipantIdsKey, activeParticipantIds.length]);

  const showAISuggestions =
    AI_PLACE_SUGGESTIONS_ENABLED &&
    chatParticipantsHaveCachedCity &&
    chatAiLocationStatus !== "loading" &&
    chatAiLocationStatus !== "missing_location";
  const showAIUnavailableMessage =
    AI_PLACE_SUGGESTIONS_ENABLED &&
    chatParticipantsHaveCachedCity &&
    chatAiLocationStatus === "missing_location";

  const openAISuggestions = useCallback(() => {
    if (!showAISuggestions) return;
    setAiExploreError(null);
    setShowOptionsList(false);
    setSelectedOption(null);
    setIsExploreVisible(true);
  }, [showAISuggestions]);

  useEffect(() => {
    if (!showAISuggestions && isExploreVisible && !isAILoading && !aiExploreError) {
      setIsExploreVisible(false);
      setShowOptionsList(false);
      setAiExploreError(null);
    }
  }, [showAISuggestions, isExploreVisible, isAILoading, aiExploreError]);

  const triggerAISuggestion = async (category: string) => {
    if ((!activeChatId && !pendingNewChat) || isAILoading) {
      return;
    }

    setIsAILoading(true);
    setCurrentCategory(category);
    setAiExploreError(null);
    setShowOptionsList(false);
    setSelectedOption(null);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const currentChat = pendingNewChat
        ? { participants: pendingNewChat.participants }
        : allChats.find((c) => c.id === activeChatId);

      if (!currentChat) {
        setAiExploreError("Could not find this chat. Please try again.");
        return;
      }

      const participantSnaps = await Promise.all(
        currentChat.participants
          .filter(Boolean)
          .map((uid: string) => getDoc(doc(db, "users", uid)))
      );
      const participantData = participantSnaps
        .filter((snap) => snap.exists())
        .map((snap) => snap.data() as Record<string, unknown>);

      const myId = auth.currentUser?.uid;
      const mySnap = participantSnaps.find((snap) => snap.id === myId);
      const senderLocationLabel = formatUserLocationLabel(
        mySnap?.exists()
          ? (mySnap.data() as Record<string, unknown>)
          : userProfile
      );
      if (!senderLocationLabel) {
        setAiExploreError("Add your city in profile to use Synq suggestions.");
        return;
      }
      if (!hasCachedCitySuggestions(senderLocationLabel)) {
        setAiExploreError("Synq suggestions aren't available for your city yet.");
        return;
      }
      if (!allParticipantsHaveCachedCitySuggestions(participantData)) {
        setAiExploreError(
          "Synq suggestions are only available when everyone in the chat is in a supported city."
        );
        return;
      }

      const suggestions: SynqSuggestion[] = [];
      const triedNames = new Set<string>();

      while (suggestions.length < 3) {
        const batch = getCachedCitySuggestions(senderLocationLabel, category, [
          ...triedNames,
        ]);
        if (!batch || batch.length === 0) break;

        let addedFromBatch = false;
        for (const suggestion of batch) {
          triedNames.add(suggestion.name);
          suggestions.push(suggestion);
          addedFromBatch = true;
          if (suggestions.length >= 3) break;
        }

        if (!addedFromBatch) break;
      }

      if (suggestions.length > 0) {
        setAiOptions(suggestions);
        setShowOptionsList(true);
        setAiExploreError(null);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setAiExploreError(
          hasCachedCitySuggestions(senderLocationLabel)
            ? "No spots found for this vibe. Try another."
            : "Synq suggestions aren't available for your city yet."
        );
      }
    } catch (err: unknown) {
      setAiExploreError(
        err instanceof Error && err.message
          ? err.message
          : "Could not load suggestions. Please try again."
      );
    } finally {
      setIsAILoading(false);
    }
  };

  const sendAISuggestionToChat = async () => {
    if (!auth.currentUser) return;
    if (!pendingNewChat && !activeChatId) return;

    const textToSend = selectedOption
      ? `${selectedOption.name}\n${selectedOption.address || selectedOption.location}`
      : `✨ Synq AI Suggestion:\n\n${aiResponse}`;

    if (rejectIfObjectionable(textToSend)) return;

    try {
      let chatId = activeChatId;
      if (pendingNewChat) {
        chatId = await ensureChatFromPending();
      }
      if (!chatId) return;

      const myAvatar = resolveAvatar(userProfile?.imageurl);

      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        text: textToSend,
        type: 'aiSuggestion',
        senderId: auth.currentUser.uid,
        imageurl: myAvatar,
        createdAt: serverTimestamp()
      });

      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: selectedOption ? `Shared: ${selectedOption.name}` : 'AI Suggestion shared',
        lastMessageSenderId: auth.currentUser.uid,
        updatedAt: serverTimestamp(),
        [`participantImages.${auth.currentUser.uid}`]: myAvatar,
      });

      setIsExploreVisible(false);
      setShowOptionsList(false);
      setSelectedOption(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      showActionError("Could not share suggestion. Please try again.");
    }
  };

  const applySynqAudience = async (selection: SynqAudienceSelection) => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const broadcast = buildSynqBroadcastFirestorePayload(
      selection,
      friendGroups,
      resolvedFriendIds
    );
    await updateDoc(doc(db, "users", uid), broadcast);
    await saveSynqAudiencePreference(uid, selection);
    setAudienceSelection(selection);
    setUserProfile((prev: Record<string, unknown> | null) =>
      prev ? { ...prev, ...broadcast } : prev
    );
  };

  const startSynq = async () => {
    if (!auth.currentUser || isStartingSynq) return;
    if (memo.trim() && rejectIfObjectionable(memo)) return;
    Vibration.vibrate(200);
    setIsStartingSynq(true);
    try {
      const uid = auth.currentUser.uid;
      const broadcast = buildSynqBroadcastFirestorePayload(
        audienceSelection,
        friendGroups,
        resolvedFriendIds
      );
      await updateDoc(doc(db, "users", uid), {
        memo,
        status: "available",
        synqStartedAt: serverTimestamp(),
        ...broadcast,
      });
      await saveSynqAudiencePreference(uid, audienceSelection);
      writeCachedSynqActive(uid, true);
      setUserProfile((prev: Record<string, unknown> | null) =>
        prev
          ? {
              ...prev,
              memo,
              status: "available",
              ...broadcast,
            }
          : prev
      );
      setLaunchOverlay(true);
      setSynqStatus(setSynq, "activating");
      trackEvent("synq_started");
    } catch {
      showActionError("Could not start Synq. Check your connection and try again.");
    } finally {
      setIsStartingSynq(false);
    }
  };

  const endSynq = () => {
    setShowEndSynqModal(true);
  };

  const handleConnect = async () => {
    if (selectedFriends.length === 0 || !auth.currentUser) return;
    const participants = [auth.currentUser.uid, ...selectedFriends].sort();
    await executeConnection(participants);
  };

  const executeConnection = async (participants: string[]) => {
    try {
      const existing = allChats.find((c) => {
        const chatParticipants = [...(c.participants || [])].sort();
        return JSON.stringify(chatParticipants) === JSON.stringify(participants);
      });
      if (existing) {
        setPendingNewChat(null);
        prepareChatSync(existing.id);
        setActiveChatId(existing.id);
        void markChatRead(existing.id);
      } else {
        const nameMap: Record<string, string> = {};
        const imgMap: Record<string, string> = {};
        for (const uid of participants) {
          const uSnap = await getDoc(doc(db, 'users', uid));
          if (uSnap.exists()) {
            nameMap[uid] = uSnap.data().displayName;
            imgMap[uid] = resolveAvatar(uSnap.data().imageurl);
          }
        }
        setPendingNewChat({
          participants,
          participantNames: nameMap,
          participantImages: imgMap,
        });
        setActiveChatId(null);
        clearMessages();
      }
      bumpChatOpenAnchor();
      setMessagesModalVisible(true);
      navigateMessagesPane("chat");
      setSelectedFriends([]);
    } catch {
      showActionError("Could not open chat. Please try again.");
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !auth.currentUser) return;
    if (
      !pendingNewChat &&
      (!activeChatId || !allChats.find((c) => c.id === activeChatId))
    ) {
      return;
    }

    const text = inputText.trim();
    if (rejectIfObjectionable(text)) return;

    setInputText("");
    stopTyping();
    await sendMessageCore(text);
  };

  const handleDeleteChat = async (chatId: string) => {
    setPendingDeleteChatId(chatId);
    setShowDeleteChatModal(true);
  };

  const resetMergeSelect = () => {
    setMergeSelectMode(false);
    setSelectedMergeChatIds([]);
    setShowMergeConfirmModal(false);
  };

  const goBackFromChat = useCallback(() => {
    Keyboard.dismiss();
    stopTyping();
    navigateMessagesPane("inbox");
    setShowAICard(false);
    setShowOptionsList(false);
    setPendingNewChat(null);
    setIsExploreVisible(false);
  }, [navigateMessagesPane, stopTyping]);

  const openFriendProfileFromChat = useCallback((friendId: string) => {
    if (!friendId || friendId === auth.currentUser?.uid) return;
    Keyboard.dismiss();
    setProfileFriendId(friendId);
    navigateMessagesPane("profile");
  }, [navigateMessagesPane]);

  const closeProfileFromChat = useCallback(() => {
    navigateMessagesPane("chat");
    setProfileFriendId(null);
  }, [navigateMessagesPane]);

  const closeMessagesModal = useCallback(() => {
    resetMergeSelect();
    setInboxActionChat(null);
    setSelectedFriends([]);
    setMessagesModalVisible(false);
    setMessagesPane("inbox");
    setProfileFriendId(null);
    setActiveChatId(null);
    setPendingNewChat(null);
    clearMessages();
    clearPendingMessages();
    setIsExploreVisible(false);
    setShowOptionsList(false);
    setShowAICard(false);
  }, [clearMessages, clearPendingMessages]);

  const dismissNavigationOverlays = useCallback(() => {
    closeMessagesModal();
    setIsEditModalVisible(false);
    setReportModalVisible(false);
    setReportTarget(null);
    setShowEndSynqModal(false);
    setChangeAudienceVisible(false);
    setContentAlertVisible(false);
    setShowMergeConfirmModal(false);
    setShowDeleteChatModal(false);
    setLaunchOverlay(false);
  }, [closeMessagesModal]);

  useEffect(() => {
    return registerDismissNavigationOverlaysHandler(dismissNavigationOverlays);
  }, [dismissNavigationOverlays]);

  useEffect(() => {
    if (!messagesModalVisible) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (mergeSelectMode) {
        resetMergeSelect();
        return true;
      }
      if (messagesPane === "profile") {
        closeProfileFromChat();
        return true;
      }
      if (messagesPane === "chat") {
        goBackFromChat();
        return true;
      }
      closeMessagesModal();
      return true;
    });
    return () => sub.remove();
  }, [
    messagesModalVisible,
    messagesPane,
    mergeSelectMode,
    closeMessagesModal,
    closeProfileFromChat,
    goBackFromChat,
    resetMergeSelect,
  ]);

  const startCombineWithChat = (chatId: string) => {
    setInboxActionChat(null);
    setMergeSelectMode(true);
    setSelectedMergeChatIds([chatId]);
  };

  const hideMergedSourceChats = async (sourceChatIds: string[]) => {
    if (!auth.currentUser) return;
    const myId = auth.currentUser.uid;
    const ids = uniqueChatIds(sourceChatIds);
    if (ids.length === 0) return;

    setUserProfile((prev: any) => {
      const currentHidden = Array.isArray(prev?.hiddenChatIds)
        ? prev.hiddenChatIds.filter(Boolean)
        : [];
      return {
        ...prev,
        hiddenChatIds: uniqueChatIds([...currentHidden, ...ids]),
      };
    });

    try {
      await updateDoc(doc(db, "users", myId), {
        hiddenChatIds: arrayUnion(...ids),
      });
    } catch {
      // Merge succeeded; inbox hide is best-effort and will sync on next profile load.
    }
  };

  const toggleMergeChatSelection = (chatId: string) => {
    setSelectedMergeChatIds((prev) => {
      if (prev.includes(chatId)) {
        return prev.filter((id) => id !== chatId);
      }
      if (prev.length >= 2) return prev;

      const next = [...prev, chatId];
      if (next.length === 2) {
        const chatA = visibleChats.find((c) => c.id === next[0]);
        const chatB = visibleChats.find((c) => c.id === next[1]);
        if (
          chatA &&
          chatB &&
          participantsMatch(chatA.participants || [], chatB.participants || [])
        ) {
          showActionError("These conversations already include the same people.");
          return prev;
        }
      }
      return next;
    });
  };

  const mergePreviewChat = useMemo(() => {
    if (selectedMergeChatIds.length !== 2) return null;
    const chatA = visibleChats.find((c) => c.id === selectedMergeChatIds[0]);
    const chatB = visibleChats.find((c) => c.id === selectedMergeChatIds[1]);
    if (!chatA || !chatB) return null;

    const participants = mergeParticipantSets(chatA, chatB);
    const { participantNames, participantImages } = mergeParticipantMaps(
      chatA,
      chatB,
      participants
    );
    return { participants, participantNames, participantImages };
  }, [selectedMergeChatIds, visibleChats]);

  const executeMergeChats = async () => {
    if (isMergingChats) return;
    if (!auth.currentUser || selectedMergeChatIds.length !== 2) return;

    const myId = auth.currentUser.uid;
    const chatA = visibleChats.find((c) => c.id === selectedMergeChatIds[0]);
    const chatB = visibleChats.find((c) => c.id === selectedMergeChatIds[1]);
    if (!chatA || !chatB) {
      showActionError("One of those conversations is no longer available.");
      resetMergeSelect();
      return;
    }

    setIsMergingChats(true);
    try {
      const mergedParticipants = mergeParticipantSets(chatA, chatB);
      const existing = findChatWithParticipants(visibleChats, mergedParticipants);

      if (existing) {
        resetMergeSelect();
        setPendingNewChat(null);
        prepareChatSync(existing.id);
        setActiveChatId(existing.id);
        bumpChatOpenAnchor();
        navigateMessagesPane("chat");
        void markChatRead(existing.id);
        void hideMergedSourceChats([chatA.id, chatB.id]);
        return;
      }

      let { participantNames, participantImages } = mergeParticipantMaps(
        chatA,
        chatB,
        mergedParticipants
      );

      for (const uid of mergedParticipants) {
        if (participantNames[uid]?.trim() && participantImages[uid]) continue;
        const uSnap = await getDoc(doc(db, "users", uid));
        if (!uSnap.exists()) continue;
        const data = uSnap.data();
        if (!participantNames[uid]?.trim()) {
          participantNames[uid] = data.displayName || "";
        }
        if (!participantImages[uid]) {
          participantImages[uid] = resolveAvatar(data.imageurl);
        }
      }

      const myDisplayName =
        participantNames[myId] || userProfile?.displayName || "Someone";
      const systemText = `${(myDisplayName || "").trim().split(/\s+/)[0] || "Someone"} combined two conversations`;

      const chatRef = await addDoc(collection(db, "chats"), {
        participants: mergedParticipants,
        participantNames,
        participantImages,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessage: systemText,
        lastMessageSenderId: myId,
        mergedFrom: [chatA.id, chatB.id],
      });

      await addDoc(collection(db, "chats", chatRef.id, "messages"), {
        text: systemText,
        senderId: myId,
        type: "system",
        imageurl: resolveAvatar(userProfile?.imageurl),
        createdAt: serverTimestamp(),
      });

      resetMergeSelect();
      setPendingNewChat(null);
      prepareChatSync(chatRef.id);
      setActiveChatId(chatRef.id);
      bumpChatOpenAnchor();
      navigateMessagesPane("chat");
      void markChatRead(chatRef.id);
      void hideMergedSourceChats([chatA.id, chatB.id]);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      showActionError("Could not create group chat. Please try again.");
    } finally {
      setIsMergingChats(false);
      setShowMergeConfirmModal(false);
    }
  };

  const toggleHeartReaction = async (messageId: string, currentReactions: any) => {
    if (!auth.currentUser || !activeChatId || messageId.startsWith("pending-")) return;

    const userId = auth.currentUser.uid;
    const messageRef = doc(db, "chats", activeChatId, "messages", messageId);

    try {
      const hasReacted = currentReactions?.[userId] === "heart";

      await updateDoc(messageRef, {
        [`reactions.${userId}`]: hasReacted ? deleteField() : "heart",
      });
    } catch {
      showActionError("Could not update reaction. Please try again.");
    }
  };

  const getChatTitle = (chat: any) =>
    buildChatTitle(chat, auth.currentUser?.uid);

  const mergePreviewTitle = useMemo(() => {
    if (!mergePreviewChat) return "";
    return getChatTitle({
      ...mergePreviewChat,
      customName: undefined,
    });
  }, [mergePreviewChat, auth.currentUser?.uid]);

  const mergeAnchorTitle = useMemo(() => {
    if (selectedMergeChatIds.length !== 1) return "";
    const chat = inboxChats.find((c) => c.id === selectedMergeChatIds[0]);
    return chat ? getChatTitle(chat) : "";
  }, [selectedMergeChatIds, inboxChats, auth.currentUser?.uid]);

  const activeChat = pendingNewChat
    ? {
        id: "__pending__",
        participants: pendingNewChat.participants,
        participantNames: pendingNewChat.participantNames,
        participantImages: pendingNewChat.participantImages,
        communityGroupId: pendingNewChat.communityGroupId,
        communityGroupName: pendingNewChat.communityGroupName,
        communityPlanId: pendingNewChat.communityPlanId,
        communityPlanTitle: pendingNewChat.communityPlanTitle,
      }
    : visibleChats.find((c) => c.id === activeChatId);

  const activeChatResolved = useMemo(() => {
    if (!activeChat) return activeChat;
    return {
      ...activeChat,
      participantImages: freshParticipantImages(
        activeChat.participantImages || {},
        activeParticipantIds
      ),
    };
  }, [activeChat, activeParticipantIds, freshParticipantImages]);

  const activeChatTitle = useMemo(() => {
    if (!activeChat) return "Synq Chat";
    return getChatTitle(activeChat);
  }, [
    activeChat?.id,
    activeChat?.customName,
    activeChat?.participantNames
      ? Object.entries(activeChat.participantNames as Record<string, string>)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([uid, name]) => `${uid}:${name}`)
          .join("|")
      : "",
  ]);

  const renderAvatarStack = useCallback(
    (images: any, participants?: string[]) => {
      const stackUris = getStackAvatarUris(
        images,
        auth.currentUser?.uid,
        participants
      );

    if (stackUris.length === 0) {
      return (
        <View style={styles.inboxCircle}>
          <Ionicons name="people" size={20} color={ACCENT} />
        </View>
      );
    }

    if (stackUris.length === 1) {
      return (
        <View style={styles.inboxSingleWrap}>
        <ExpoImage
          source={{ uri: stackUris[0] }}
          style={styles.inboxSinglePhoto}
          cachePolicy="memory-disk"
          transition={0}
          recyclingKey={stackUris[0]}
        />
        </View>
      );
    }

    return (
      <View style={styles.inboxStackWrap}>
        <ExpoImage
          source={{ uri: stackUris[0] }}
          style={[styles.inboxStackPhoto, styles.inboxStackPhotoBack]}
          cachePolicy="memory-disk"
          transition={0}
          recyclingKey={stackUris[0]}
        />
        <ExpoImage
          source={{ uri: stackUris[1] }}
          style={[styles.inboxStackPhoto, styles.inboxStackPhotoFront]}
          cachePolicy="memory-disk"
          transition={0}
          recyclingKey={stackUris[1]}
        />
      </View>
    );
  }, []);

  const bootActive =
    synqBoot?.cachedSynqActive === true ||
    (uid ? getCachedSynqActiveSync(uid) : false);
  if (!hydrated && !bootActive) {
    return (
      <View style={[styles.darkFill, styles.bootLoading]}>
        <ActivityIndicator size="large" color={ACCENT} accessibilityLabel="Loading Synq" />
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={[styles.container, tabletContentStyle]}>
        <StatusBar barStyle="light-content" />
        {status === "active" && (
          <View style={styles.activeSynqLayer}>
            <ProfileTabHeaderOverlay variant="title" />
            <ActiveSynqSection
              styles={styles}
              hasUnread={hasUnread}
              activePulseOpacity={activePulseOpacity}
              activePulseScale={activePulseScale}
              availableFriends={visibleAvailableFriends}
              selectedFriends={selectedFriends}
              setSelectedFriends={setSelectedFriends}
              handleConnect={handleConnect}
              endSynq={endSynq}
              insetsBottom={insets.bottom}
              audienceLabel={synqAudienceLabel}
              openChangeAudience={() => setChangeAudienceVisible(true)}
              openMessagesInbox={() => {
                setMessagesModalVisible(true);
              }}
              openEditModal={() => setIsEditModalVisible(true)}
              userProfile={userProfile}
              viewerId={uid}
              nudgeCandidates={nudgeCandidates}
            />
          </View>
        )}
        {status === "idle" && hydrated && (
          <View style={styles.synqHomeLayer}>
            <Reanimated.View
              exiting={FadeOut.duration(520)}
              style={StyleSheet.absoluteFill}
            >
              <InactiveSynqView
                memo={memo}
                setMemo={setMemo}
                onStartSynq={startSynq}
                isStartingSynq={isStartingSynq}
                friendGroups={friendGroups}
                audienceSelection={audienceSelection}
                onAudienceSelectionChange={(next) => {
                  setAudienceSelection(next);
                  if (auth.currentUser?.uid) {
                    void saveSynqAudiencePreference(auth.currentUser.uid, next);
                  }
                }}
              />
            </Reanimated.View>
          </View>
        )}
        {launchOverlay && (
          <Reanimated.View
            entering={FadeIn.duration(360)}
            exiting={FadeOut.duration(680)}
            style={styles.launchOverlay}
            pointerEvents={status === "active" ? "none" : "auto"}
          >
            <SynqActivatingView onComplete={completeSynqLaunch} />
          </Reanimated.View>
        )}
        <Modal
          visible={messagesModalVisible}
          animationType="none"
          presentationStyle="fullScreen"
          allowSwipeDismissal={false}
          onRequestClose={() => {
            if (messagesPane === "profile") {
              closeProfileFromChat();
              return;
            }
            if (messagesPane === "chat") {
              goBackFromChat();
              return;
            }
            closeMessagesModal();
          }}
          onDismiss={closeMessagesModal}
        >
          <View style={styles.messagesModalRoot}>
          <SafeAreaView style={styles.modalBg} edges={["bottom"]}>
          <MessagesModalStack
            visible={messagesModalVisible}
            pane={messagesPane}
            width={windowWidth}
            inbox={
              <MessagesInboxPane
                styles={styles}
                allChats={inboxChats}
                currentUserId={auth.currentUser?.uid}
                getChatTitle={getChatTitle}
                renderAvatarStack={renderAvatarStack}
                onCloseMessages={closeMessagesModal}
                onOpenChat={async (item) => {
                  beginOpeningChat(item.id);
                }}
                onPrepareChatPress={(chatId) => prefetchChatOnPress(chatId)}
                onDeleteChat={handleDeleteChat}
                onChatLongPress={(chat) => setInboxActionChat(chat)}
                mergeSelectMode={mergeSelectMode}
                selectedMergeChatIds={selectedMergeChatIds}
                mergePreviewTitle={mergePreviewTitle}
                mergeAnchorTitle={mergeAnchorTitle}
                mergeReady={!!mergePreviewChat}
                mergeBusy={isMergingChats}
                onCancelMergeMode={resetMergeSelect}
                onToggleMergeChatSelection={toggleMergeChatSelection}
                onConfirmMerge={() => setShowMergeConfirmModal(true)}
                inboxActionChat={inboxActionChat}
                onCloseInboxAction={() => setInboxActionChat(null)}
                onCombineChat={startCombineWithChat}
                onDeleteFromAction={(chatId) => {
                  setInboxActionChat(null);
                  handleDeleteChat(chatId);
                }}
                renderMergeConfirmModal={
                  <ConfirmModal
                    visible={showMergeConfirmModal}
                    title="Create group chat"
                    message={
                      mergePreviewTitle
                        ? `Everyone from both conversations will be added to a chat with ${mergePreviewTitle}.`
                        : "Everyone from both conversations will be added to one group chat."
                    }
                    confirmText="Create"
                    confirmDisabled={isMergingChats || !mergePreviewChat}
                    onCancel={() => setShowMergeConfirmModal(false)}
                    onConfirm={() => void executeMergeChats()}
                  />
                }
                renderDeleteConfirmModal={
                  <ConfirmModal
                    visible={showDeleteChatModal}
                    title="Delete Chat"
                    message="Are you sure you want to delete this conversation?"
                    confirmText="Delete"
                    destructive
                    onCancel={() => {
                      setShowDeleteChatModal(false);
                      setPendingDeleteChatId(null);
                    }}
                    onConfirm={async () => {
                      const chatId = pendingDeleteChatId;
                      setShowDeleteChatModal(false);
                      setPendingDeleteChatId(null);
                      if (!chatId) return;
                      if (activeChatId === chatId) {
                        setActiveChatId(null);
                        setPendingNewChat(null);
                        clearMessages();
                        navigateMessagesPane("inbox");
                      }
                      try {
                        await deleteChat(chatId);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      } catch {
                        showActionError("Could not delete chat. Please try again.");
                      }
                    }}
                  />
                }
              />
            }
            chat={
              <>
                <MessagesChatPane
                  styles={styles}
                  insetsTop={insets.top}
                  activeChat={activeChatResolved}
                  chatTitle={activeChatTitle}
                  renderAvatarStack={renderAvatarStack}
                  rotatingAIText={rotatingAIText}
                  pendingScrollToMessageId={pendingScrollToMessageId}
                  flatListRef={flatListRef}
                  messages={messages}
                  messagesReady={messagesReady}
                  listenerError={listenerError}
                  onRetryMessages={retryListener}
                  hasEarlierMessages={hasEarlierMessages}
                  loadingEarlier={loadingEarlier}
                  onLoadEarlier={loadEarlierMessages}
                  typingUserIds={typingUserIds}
                  onComposerChange={(text) => {
                    setInputText(text);
                    notifyInputChange();
                  }}
                  showAICard={showAICard}
                  aiResponse={aiResponse}
                  inputText={inputText}
                  setInputText={setInputText}
                  setMessagesPane={setMessagesPane}
                  onBackFromChat={goBackFromChat}
                  setShowAICard={setShowAICard}
                  setShowOptionsList={setShowOptionsList}
                  setPendingNewChat={setPendingNewChat}
                  showAISuggestions={showAISuggestions}
                  showAIUnavailableMessage={showAIUnavailableMessage}
                  onOpenAISuggestions={openAISuggestions}
                  onOpenFriendProfile={openFriendProfileFromChat}
                  sendMessage={sendMessage}
                  sendAISuggestionToChat={sendAISuggestionToChat}
                  setPendingScrollToMessageId={setPendingScrollToMessageId}
                  onMessageBubblePress={onMessageBubblePress}
                  onMessageLongPress={(item) => {
                    if (item.senderId === auth.currentUser?.uid) return;
                    if (item.id.startsWith("pending-")) return;
                    setReportTarget({
                      reportedUserId: item.senderId,
                      messageId: item.id,
                      chatId: activeChatId || "",
                    });
                    setReportModalVisible(true);
                  }}
                  onIdeaBubblePress={onIdeaBubblePress}
                  ChatMessageBubble={MemoChatMessageBubble}
                  iMessageBubbleColumnMaxWidth={iMessageBubbleColumnMaxWidth}
                  windowWidth={windowWidth}
                  currentUserId={auth.currentUser?.uid}
                  liveParticipantImages={liveParticipantImages}
                  chatOpenAnchorKey={chatOpenAnchorKey}
                />
              </>
            }
            profile={
              profileFriendId ? (
                <FriendProfile
                  key={profileFriendId}
                  embeddedFriendId={profileFriendId}
                  onEmbeddedBack={closeProfileFromChat}
                />
              ) : null
            }
            onInteractivePop={() => {
              if (messagesPane === "profile") {
                closeProfileFromChat();
              } else if (messagesPane === "chat") {
                goBackFromChat();
              }
            }}
          />
          <AlertModal
            visible={contentAlertVisible}
            title={contentAlertTitle}
            message={contentAlertMessage}
            onClose={() => setContentAlertVisible(false)}
          />
          </SafeAreaView>
          {messagesPane === "chat" && isExploreVisible ? (
            <ExploreModal
              visible={isExploreVisible}
              onClose={() => {
                setIsExploreVisible(false);
                setShowOptionsList(false);
                setAiExploreError(null);
              }}
              onBack={() => {
                setShowOptionsList(false);
                setAiExploreError(null);
              }}
              onSelectVibe={(label: string) => {
                void triggerAISuggestion(label);
              }}
              isAILoading={isAILoading}
              showOptionsList={showOptionsList}
              aiOptions={aiOptions}
              selectedOption={selectedOption}
              setSelectedOption={setSelectedOption}
              sendAISuggestionToChat={() => {
                sendAISuggestionToChat();
                setIsExploreVisible(false);
                setShowOptionsList(false);
                setAiExploreError(null);
              }}
              currentCategory={currentCategory}
              errorMessage={aiExploreError}
            />
          ) : null}
          </View>
        </Modal>

        <EditSynqModal
          visible={isEditModalVisible}
          onClose={() => setIsEditModalVisible(false)}
          memo={memo}
          setMemo={setMemo}
          styles={styles}
          onSaveMemo={async () => {
            if (memo.trim() && rejectIfObjectionable(memo)) return;
            await updateDoc(doc(db, "users", auth.currentUser!.uid), { memo });
            setIsEditModalVisible(false);
          }}
        />
        <ReportModal
          visible={reportModalVisible && !!reportTarget}
          reportedUserId={reportTarget?.reportedUserId || ""}
          contentType="message"
          chatId={reportTarget?.chatId}
          messageId={reportTarget?.messageId}
          onClose={() => {
            setReportModalVisible(false);
            setReportTarget(null);
          }}
        />
        <AlertModal
          visible={contentAlertVisible && !messagesModalVisible}
          title={contentAlertTitle}
          message={contentAlertMessage}
          onClose={() => setContentAlertVisible(false)}
        />
        <ConfirmModal
          visible={showEndSynqModal}
          title="End Synq?"
          message="You will no longer be visible as available."
          confirmText="End Synq"
          destructive
          onCancel={() => setShowEndSynqModal(false)}
          onConfirm={async () => {
            setShowEndSynqModal(false);

            if (!auth.currentUser) return;

            await updateDoc(doc(db, "users", auth.currentUser.uid), {
              status: "inactive",
              memo: "",
              ...clearSynqBroadcastFields,
            });
            writeCachedSynqActive(auth.currentUser.uid, false);

            setMemo("");
            setSynqStatus(setSynq, "idle");
            setIsEditModalVisible(false);
            setAudienceSelection({ mode: "all", groupIds: [] });
          }}
        />
        <ChangeSynqAudienceModal
          visible={changeAudienceVisible}
          groups={friendGroups}
          initialSelection={audienceSelection}
          onClose={() => setChangeAudienceVisible(false)}
          onSave={applySynqAudience}
        />
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  darkFill: { flex: 1, backgroundColor: BG, justifyContent: 'center' },
  bootLoading: { alignItems: 'center' },
  activeSynqRoot: { flex: 1, backgroundColor: BG, paddingHorizontal: 26 },
  activeListFooterDock: {
    flex: 1,
    minHeight: 0,
    position: "relative",
  },
  audienceRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    marginBottom: 8,
    paddingVertical: 6,
    paddingLeft: 14,
  },
  sortBar: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    marginTop: 4,
    marginBottom: 10,
  },
  activeFriendsList: { flex: 1 },
  activeListContent: { paddingHorizontal: 0 },
  activeListBottomFade: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 2,
  },
  activeFooterDock: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 3,
    backgroundColor: BG,
    justifyContent: "flex-start",
  },
  activeEmptyWrap: {
    alignItems: "center",
    paddingHorizontal: SPACE_5,
    marginTop: SPACE_5,
    maxWidth: 380,
    alignSelf: "center",
  },
  activeEmptyTitle: {
    color: TEXT,
    fontFamily: fonts.heavy,
    fontSize: TYPE_MODAL_TITLE,
    lineHeight: 34,
    letterSpacing: 0.2,
    textAlign: "center",
  },
  activeEmptySub: {
    color: MUTED2,
    fontFamily: fonts.medium,
    fontSize: TYPE_SUBHEAD,
    lineHeight: 26,
    textAlign: "center",
    marginTop: SPACE_4,
  },
  activeBody: { flex: 1, minHeight: 0 },
  synqHeaderSide: {
    width: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  synqHeaderTitleCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  headerTitleWithIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    maxWidth: "100%",
    gap: 10,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(52, 211, 153, 0.12)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(52, 211, 153, 0.28)",
  },
  liveBadgeText: {
    color: STATUS_AVAILABLE,
    fontSize: TYPE_FINE,
    fontFamily: fonts.medium,
    letterSpacing: 0.4,
  },
  activeStatusDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: STATUS_AVAILABLE,
    shadowColor: STATUS_AVAILABLE,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 4,
    elevation: 2,
  },
  activeStatusDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    marginRight: 10,
    backgroundColor: STATUS_AVAILABLE,
    shadowColor: STATUS_AVAILABLE,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 3,
  },
  headerDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  activeMemoRow: {
    marginTop: 14,
    width: "100%",
  },
  audienceRowPressed: {
    opacity: 0.72,
  },
  audienceText: {
    flex: 1,
    color: MUTED2,
    fontSize: TYPE_CAPTION,
    fontFamily: fonts.medium,
  },
  activeMemoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: SURFACE_INPUT,
    borderRadius: BUTTON_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GROUP_BORDER,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  activeSynqLeadIcon: {
    width: 20,
    marginTop: 2,
    marginRight: 12,
    textAlign: "center",
  },
  activeMemoText: {
    flex: 1,
    color: TEXT,
    fontSize: TYPE_BUTTON,
    lineHeight: 22,
    fontFamily: fonts.book,
    textAlign: "left",
  },
  headerTitle: {
    ...tabScreenMainHeaderTitle,
    textAlign: "center",
    includeFontPadding: false,
  },
  headerIconContainer: { width: 40, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: ACCENT,
    borderWidth: 2,
    borderColor: HEADER_BLACK,
  },
  closeBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 10,
  },
  friendCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: BUTTON_RADIUS,
    borderWidth: 1.5,
    marginBottom: 10,
  },
  friendCardSelected: {
    borderColor: ACCENT,
  },
  friendCardUnselected: {
    borderColor: MUTED3,
  },
  activeFriendRowSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: BORDER,
  },
  friendImg: { width: 50, height: 50, borderRadius: 25, marginRight: 15 },
  whiteBold: { color: TEXT, fontSize: TYPE_SUBHEAD, fontFamily: fonts.medium },
  grayText: { ...cardMetaText, marginTop: 2 },
  communityChatMeta: { ...cardMetaText, fontSize: TYPE_FINE, marginTop: 1, color: MUTED2 },
  locationText: { ...cardMetaText, fontSize: TYPE_FINE, marginTop: 2 },
  btn: {
    alignSelf: 'center',
    width: '62%',
    height: PRIMARY_CTA_HEIGHT,
    backgroundColor: ACCENT,
    borderRadius: BUTTON_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontSize: TYPE_BODY, color: ON_ACCENT_TEXT, fontFamily: fonts.heavy },
  synqHomeLayer: {
    flex: 1,
  },
  activeSynqLayer: {
    flex: 1,
  },
  launchOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    backgroundColor: BG,
  },
  inactiveCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  mainEyebrow: {
    ...eyebrowLabel,
    position: "absolute",
    top: 96,
    marginBottom: 0,
  },
  mainSubtitle: {
    color: MUTED,
    fontSize: TYPE_TITLE,
    fontFamily: fonts.medium,
    textAlign: "center",
    lineHeight: 34,
    marginTop: 96,
    maxWidth: 352,
  },
  inlineMetaRow: {
    marginTop: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  inlineMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  inlineMetaDot: {
    width: 4,
    height: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  inlineMetaText: {
    color: MUTED2,
    fontSize: TYPE_BODY,
    fontFamily: fonts.medium,
  },
  memoCard: {
    width: "100%",
    marginTop: 32,
    backgroundColor: SURFACE_PANEL,
    borderWidth: 1,
    borderColor: "#1B1D20",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
  },
  memoLabel: {
    color: MUTED2,
    fontSize: TYPE_LEAD,
    fontFamily: fonts.medium,
    marginBottom: 6,
  },
  memoInput: {
    color: TEXT,
    fontSize: TYPE_SUBHEAD,
    width: '100%',
    fontFamily: fonts.medium,
    paddingVertical: 6,
  },
  pulseBox: {
    width: 340,
    height: 320,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  centeredModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 25,
  },
  modalBg: { flex: 1, backgroundColor: BG },
  messagesModalRoot: {
    flex: 1,
    backgroundColor: BG,
  },
  messagesPaneFill: { flex: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: SURFACE_WELL },
  inboxHeaderBlock: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  inboxHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
  },
  inboxTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  inboxTitleText: {
    flexShrink: 1,
  },
  inboxMergeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  inboxMergeBackBtn: {
    width: 40,
  },
  inboxMergeHeaderTitle: {
    flex: 1,
    textAlign: 'center',
    color: TEXT,
    fontSize: TYPE_MODAL_TITLE,
    fontFamily: fonts.heavy,
    letterSpacing: 0.15,
  },
  inboxMergeHeaderSide: {
    width: 40,
  },
  inboxMergeSubtitle: {
    color: MUTED2,
    fontFamily: fonts.book,
    fontSize: TYPE_CAPTION,
    letterSpacing: 0.1,
    textAlign: 'center',
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  inboxMergeFooterCard: {
    marginHorizontal: 16,
    marginBottom: 24,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 18,
    borderRadius: MODAL_RADIUS,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
  },
  inboxMergeFooterLabel: {
    color: MUTED2,
    fontFamily: fonts.medium,
    fontSize: TYPE_MICRO,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  inboxMergeFooterTitle: {
    color: TEXT,
    fontFamily: fonts.heavy,
    fontSize: TYPE_SECTION,
    letterSpacing: 0.1,
    lineHeight: 26,
    marginBottom: 16,
  },
  inboxMergeFooterHint: {
    color: MUTED,
    fontFamily: fonts.book,
    fontSize: TYPE_LEAD,
    lineHeight: 20,
    marginBottom: 16,
  },
  inboxMergePrimaryBtn: {
    backgroundColor: ACCENT,
    borderRadius: BUTTON_RADIUS,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inboxMergePrimaryBtnDisabled: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
  },
  inboxMergePrimaryBtnText: {
    color: ON_ACCENT_TEXT,
    fontFamily: fonts.heavy,
    fontSize: TYPE_BUTTON,
    letterSpacing: 0.2,
  },
  inboxMergePrimaryBtnTextDisabled: {
    color: MUTED3,
  },
  inboxListContentMerge: {
    paddingBottom: 12,
  },
  inboxItemSelected: {
    backgroundColor: 'rgba(0,255,133,0.06)',
  },
  inboxSelectBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: MUTED3,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  inboxSelectBadgeActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  messagesHeaderDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.16)",
    marginHorizontal: 20,
  },
  modalTitle: { color: TEXT, fontSize: TYPE_MODAL_TITLE, fontFamily: fonts.medium },
  messagesInboxTitle: tabScreenMainHeaderTitle,
  deleteAction: { backgroundColor: DESTRUCTIVE, justifyContent: 'center', alignItems: 'center', width: 80, height: '100%' },
  inboxItem: {
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 20,
  },
  inboxItemFirst: {
    paddingTop: 16,
  },
  inboxListContent: {
    paddingBottom: 20,
    flexGrow: 1,
  },
  inboxItemRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 56,
  },
  inboxSeparatorBetween: {
    paddingLeft: 20 + 60 + 14,
    paddingRight: 40,
    justifyContent: "center",
  },
  inboxSeparatorLine: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.12)",
    width: "100%",
  },
  inboxItemUnread: {
    backgroundColor: 'rgba(43,255,136,0.10)',
    borderLeftWidth: 2,
    borderLeftColor: ACCENT,
  },
  unreadChatTitle: {
    color: ACCENT,
  },
  inboxCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: SURFACE_WELL, justifyContent: 'center', alignItems: 'center' },
  stackedPhoto: { width: 40, height: 40, borderRadius: 20, position: 'absolute', borderWidth: 2, borderColor: 'black' },
  msgContainer: { marginBottom: 12 },
  chatAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderColor: BORDER,
    borderWidth: 1.5,
    marginRight: 7,
  },
  messageBubbleColumn: {
    flexGrow: 0,
    flexShrink: 0,
  },
  bubble: {
    borderRadius: IMESSAGE_BUBBLE_CORNER_RADIUS,
  },
  bubbleText: {
    fontSize: IMESSAGE_BUBBLE_FONT_SIZE,
    lineHeight: IMESSAGE_BUBBLE_LINE_HEIGHT,
    textAlign: "left",
    letterSpacing: 0,
    ...Platform.select({
      ios: { fontFamily: "System" },
      android: { fontFamily: "sans-serif", includeFontPadding: false },
    }),
  },
  failedMessageHint: {
    marginTop: 4,
    fontSize: TYPE_MICRO,
    opacity: 0.85,
    ...Platform.select({
      ios: { fontFamily: "System" },
      android: { fontFamily: "sans-serif" },
    }),
  },
  myBubble: {
    backgroundColor: ACCENT,
    ...Platform.select({
      ios: {
        shadowColor: ACCENT,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.28,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  theirBubble: {
    backgroundColor: SURFACE_ELEVATED,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GROUP_BORDER,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingBottom: 6,
    overflow: 'visible',
  },
  chatHeaderMain: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  chatHeaderIdentityRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  chatHeaderAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: MUTED3,
    backgroundColor: SURFACE_ELEVATED,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatHeaderAvatarSlot: {
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  chatHeaderTextCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    paddingTop: 2,
  },
  chatHeaderTextColCompact: {
    paddingTop: 0,
  },
  chatTitle: {
    color: TEXT,
    fontSize: TYPE_SECTION,
    fontFamily: fonts.heavy,
    letterSpacing: 0.15,
  },
  chatHeaderDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: BORDER,
    marginHorizontal: 18,
  },
  chatBody: {
    flex: 1,
    backgroundColor: BG,
  },
  chatLoadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  chatList: {
    flex: 1,
  },
  chatListFill: {
    flex: 1,
  },
  chatListContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 2,
  },
  chatListContentEmpty: {
    flexGrow: 1,
    justifyContent: "center",
  },
  composerDock: {
    backgroundColor: BG,
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  composerShell: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: GROUP_SURFACE,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: MUTED3,
    paddingLeft: 16,
    paddingRight: 5,
    paddingVertical: 5,
    minHeight: 50,
  },
  composerInput: {
    flex: 1,
    color: TEXT,
    fontSize: TYPE_BODY,
    fontFamily: fonts.medium,
    lineHeight: 21,
    paddingTop: 10,
    paddingBottom: 10,
    paddingRight: 8,
    maxHeight: 120,
  },
  sendBtnInset: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: ACCENT,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 1,
    flexShrink: 0,
  },
  sendBtnInsetDisabled: {
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  sendIconWrap: {
    width: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendIcon: {
    transform: [{ translateX: 2 }, { translateY: 1 }],
  },
  sendIconDisabled: {
    transform: [{ translateX: 2 }, { translateY: 1 }],
    opacity: 0.45,
  },
  chatTimestamp: {
    color: MUTED3,
    fontSize: TYPE_MICRO,
    marginTop: 5,
    fontFamily: fonts.book,
    letterSpacing: 0.2,
  },
  explorePanel: { height: '85%', backgroundColor: SURFACE_INPUT, borderTopLeftRadius: MODAL_RADIUS + 8, borderTopRightRadius: MODAL_RADIUS + 8, overflow: 'hidden' },
  sectionHeader: { ...listSectionTitle, color: TEXT, marginBottom: 20, paddingHorizontal: 20 },
  scrollRow: { marginBottom: 30, paddingLeft: 20 },
  ideaCircle: { alignItems: 'center', marginRight: 25 },
  circlePlaceholder: { width: 70, height: 70, borderRadius: 35, backgroundColor: SURFACE_ELEVATED, justifyContent: 'center', alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: '#333' },
  circleText: { ...cardMetaText, color: TEXT },
  venueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE_WELL,
    padding: 12,
    borderRadius: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#222',
  },
  selectedCard: {
    borderColor: ACCENT,
    backgroundColor: SURFACE_LIFTED,
  },
  venueImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: BORDER_MUTED,
  },
  venueName: {
    ...cardTitleText,
  },
  venueRating: {
    color: ACCENT,
    fontSize: TYPE_FINE,
    marginVertical: 2,
  },
  venueDesc: {
    color: MUTED2,
    fontSize: TYPE_CAPTION,
    lineHeight: 18,
  },
  sendIdeaBtn: { backgroundColor: DISABLED_CTA, margin: 20, padding: 18, borderRadius: 12, alignItems: 'center' },
  sendIdeaBtnEnabled: { backgroundColor: ACCENT, margin: 20, padding: 18, borderRadius: 12, alignItems: 'center' },
  sendIdeaText: { color: ON_ACCENT_TEXT, fontFamily: fonts.black, fontSize: TYPE_BODY },
  inChatAICardContainer: { paddingHorizontal: 20, marginVertical: 10 },
  inChatAICard: {
    backgroundColor: SHEET_SURFACE,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(43,255,136,0.18)',
  },
  aiCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  aiCardTitleSmall: { color: ACCENT, fontSize: TYPE_LEAD, fontFamily: fonts.heavy, letterSpacing: 0.5 },
  aiCardBodySmall: { ...cardMetaText, color: TEXT, fontSize: TYPE_BODY, lineHeight: 22, marginBottom: 15 },
  aiShareBtnSmall: { backgroundColor: ACCENT, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  aiShareBtnText: { color: ON_ACCENT_TEXT, fontSize: TYPE_LEAD, fontFamily: fonts.heavy },
  editPanel: {
    width: '100%',
    backgroundColor: SURFACE_SHEET_ALT,
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 28,
    alignItems: 'stretch',
  },
  panelTitle: {
    color: TEXT,
    fontSize: TYPE_MODAL_TITLE,
    fontFamily: 'Avenir-Medium',
  },
  panelInput: {
    width: '100%',
    backgroundColor: SURFACE_INPUT,
    color: TEXT,
    padding: 16,
    borderRadius: 16,
    marginTop: 8,
    marginBottom: 12,
    fontSize: TYPE_BUTTON,
    minHeight: 80,
  },
  saveBtn: {
    alignSelf: 'center',
    width: PRIMARY_CTA_WIDTH,
    height: PRIMARY_CTA_HEIGHT,
    backgroundColor: ACCENT,
    borderRadius: BUTTON_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  saveBtnText: { color: ON_ACCENT_TEXT, fontSize: TYPE_BODY, fontFamily: fonts.heavy },
  centeredIdeaContainer: {
    alignItems: 'center',
    marginVertical: 15,
    width: '100%',
  },
  ideaCardSlot: {
    width: '88%',
    alignSelf: 'center',
  },
  heartReaction: {
    position: "absolute",
    bottom: -10,
    right: -10,
    flexDirection: "row",
    alignItems: "center",
  },
  heartReactionBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: SURFACE_ELEVATED,
    opacity: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: MUTED3,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.35,
        shadowRadius: 2,
      },
      android: { elevation: 2 },
    }),
  },
  heartReactionBadgeOverlap: {
    marginLeft: -5,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  friendMemoInline: {
    marginTop: 6,
    fontSize: TYPE_BUTTON,
    lineHeight: 21,
    color: MUTED2,
    fontFamily: fonts.medium,
  },
  timestampCentered: {
    color: MUTED2,
    fontSize: TYPE_FINE,
    marginTop: 4,
  },
  systemMessageText: {
    color: MUTED2,
    fontFamily: fonts.medium,
    fontSize: TYPE_CAPTION,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  inboxSingleWrap: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  inboxSinglePhoto: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: MUTED3,
    backgroundColor: SURFACE_ELEVATED,
  },
  inboxStackWrap: {
    width: 56,
    height: 54,
    position: "relative",
  },
  inboxStackPhoto: {
    width: 42,
    height: 42,
    borderRadius: 21,
    position: "absolute",
    borderWidth: 2,
    borderColor: BG,
    backgroundColor: SURFACE_ELEVATED,
  },
  inboxStackPhotoBack: {
    left: 0,
    top: 2,
    zIndex: 1,
  },
  inboxStackPhotoFront: {
    left: 11,
    top: 10,
    zIndex: 2,
  },
  avatarColumn: {
    width: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  inboxTextCol: {
    flex: 1,
    marginLeft: 14,
  },
  imageCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: MUTED,
    backgroundColor: SURFACE_WELL,
  },
  circleImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  aiChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: SURFACE_WELL,
    borderWidth: 1,
    borderColor: SURFACE_ELEVATED,
  },
  aiChipPremium: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: SURFACE_ELEVATED,
    gap: 4,
    maxWidth: "92%",
  },
  aiChipPremiumDisabled: {
    opacity: 0.4,
  },
  aiChipText: {
    color: TEXT_MUTED_HEX,
    fontSize: TYPE_FINE,
    marginHorizontal: 6,
    fontFamily: "Avenir-Medium",
  },
  aiChipTextPremium: {
    flexShrink: 1,
    color: MUTED,
    fontSize: TYPE_MICRO,
    fontFamily: fonts.medium,
    letterSpacing: 0.1,
  },
  aiUnavailableHint: {
    color: MUTED2,
    fontSize: TYPE_FINE,
    fontFamily: fonts.book,
    lineHeight: 16,
    paddingRight: 8,
  },
  chatHeaderUnavailableHint: {
    marginLeft: 56,
    marginTop: 2,
  },
  suggestionSectionTitle: {
    color: MUTED,
    fontSize: TYPE_BUTTON,
    fontFamily: fonts.medium,
  },

  suggestionWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  suggestionChip: {
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    alignSelf: "flex-start",
  },

  suggestionText: {
    color: TEXT,
    fontSize: TYPE_CAPTION,
  },

  inboxEmptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingVertical: 64,
    marginTop: 30,
  },
  inboxEmptyIconWrap: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: MUTED3,
    marginBottom: 14,
  },
  inboxEmptyTitle: {
    color: TEXT,
    fontSize: TYPE_MODAL_TITLE,
    fontFamily: fonts.heavy,
    textAlign: "center",
    letterSpacing: 0.2,
  },
  inboxEmptySub: {
    marginTop: 10,
    color: MUTED2,
    fontSize: TYPE_BUTTON,
    lineHeight: 22,
    fontFamily: fonts.medium,
    textAlign: "center",
    maxWidth: 320,
  },
  chatEmptyWrap: {
    flex: 1,
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  chatEmptyIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(43,255,136,0.08)",
    borderWidth: 1,
    borderColor: "rgba(43,255,136,0.22)",
    marginBottom: 14,
  },
  chatEmptyTitle: {
    color: TEXT,
    fontSize: TYPE_SUBHEAD,
    fontFamily: fonts.heavy,
    letterSpacing: 0.2,
    textAlign: "center",
  },
  chatEmptyText: {
    marginTop: 6,
    color: MUTED2,
    fontSize: TYPE_LEAD,
    fontFamily: fonts.medium,
    textAlign: "center",
    lineHeight: 20,
  },
});