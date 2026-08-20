import { sheetStyles } from "@/constants/sheetStyles";
import {
  ACCENT,
  BG,
  BORDER,
  BORDER_SOFT,
  DESTRUCTIVE,
  DESTRUCTIVE_BORDER_STRONG,
  DESTRUCTIVE_FILL_SUBTLE,
  FRIENDS_BORDER,
  GROUP_BORDER,
  MUTED2,
  MUTED3,
  OVERLAY_SCRIM,
  RADIUS_MD,
  SURFACE_ELEVATED,
  SURFACE_INPUT,
  SURFACE_RAISED,
  TEXT,
  TYPE_BODY,
  TYPE_BUTTON,
  TYPE_CAPTION,
  TYPE_LEAD,
  fonts,
  profileLocationText,
  profileNameText,
  profileScreenSectionTitle,
  synqOutlineAddBtn,
  synqOutlineAddBtnDisabled,
  synqOutlineAddBtnText,
  synqOutlineAddBtnTextDisabled
} from "@/constants/Variables";
import BackButton from "@/src/components/BackButton";
import CheckmarkToast from "@/src/components/CheckmarkToast";
import AddFriendToGroupSheet from "@/src/components/friends/AddFriendToGroupSheet";
import FriendPlanCard from "@/src/components/friends/FriendPlanCard";
import { ProfileSkeleton } from "@/src/components/loading/BrandSkeletons";
import ProfileTabHeaderOverlay, {
  useTabHeaderLayout,
} from "@/src/components/ProfileTabHeaderOverlay";
import SpringBottomSheet from "@/src/components/sheets/SpringBottomSheet";
import { MESSAGES_STACK_DURATION_MS } from "@/src/components/synq/MessagesModalStack";
import SynqNudgeCard from "@/src/components/synq/SynqNudgeCard";
import { useBlockedUsers } from "@/src/lib/blockedUsers";
import {
  subscribeJoinedCommunityGroups,
  type CommunityGroup,
} from "@/src/lib/communityGroups";
import { auth, db } from "@/src/lib/firebase";
import {
  addMembersToFriendGroup,
  removeMemberFromFriendGroup,
  subscribeFriendGroups,
  type FriendGroup,
} from "@/src/lib/friendGroups";
import {
  appendOptimisticJoinedViewerEvent,
  joinFriendOpenPlan,
  removeJoinedViewerEvent,
  unjoinFriendOpenPlan,
  type FriendOpenPlanEvent,
} from "@/src/lib/friendOpenPlanJoin";
import {
  removeFriendMutual,
  removeFriendMutualErrorMessage,
} from "@/src/lib/friends";
import { formatLastSynq, resolveAvatar } from "@/src/lib/helpers";
import { blockUser, unblockUser } from "@/src/lib/moderation";
import { collectJoinedIds, planLooseMatch } from "@/src/lib/planAttribution";
import {
  nudgeSentStorageKey as buildNudgeSentStorageKey,
  clearNudgeSent,
  nudgeCooldownRemainingMs,
  persistNudgeSent,
  readNudgeSentState,
  sendSynqNudge,
  synqNudgeErrorMessage,
  warmSynqNudgeClient,
} from "@/src/lib/synqNudge";
import { computeSynqActiveFromUserData } from "@/src/lib/synqSession";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import {
  useLocalSearchParams,
  useRootNavigationState,
  useRouter,
} from "expo-router";
import {
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  onSnapshot,
  serverTimestamp,
  writeBatch
} from "firebase/firestore";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import {
  eventKey,
  eventKeyLoose,
  filterOutPastOpenPlans,
  sortOpenPlansByDateTime,
} from "../src/lib/planEvents";
import {
  communityGroupsCacheByUser,
  friendProfileCacheByUser,
  friendRelationCacheByUser,
  getCachedFriendRelationship,
  getCachedMutualFriends,
  resolveMutualFriendsForTarget,
  setCachedOutgoingFriendRequest,
  warmFriendsAndConnectionsCache,
  warmOutgoingFriendRequestsCache
} from "../src/lib/socialCache";
import AlertModal from "./alert-modal";
import ConfirmModal from "./confirm-modal";
import ReportModal from "./report-modal";

function formatSharedCommunityGroupsLabel(groups: { name: string }[]): string | null {
  const names = groups
    .map((group) => String(group.name || "").trim())
    .filter(Boolean);
  if (names.length === 0) return null;
  if (names.length === 1) return `Both in ${names[0]}`;
  if (names.length === 2) return `Both in ${names[0]} and ${names[1]}`;
  return `Both in ${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

type FriendProfileProps = {
  embeddedFriendId?: string;
  onEmbeddedBack?: () => void;
};

function ProfileShell({
  embedded,
  children,
}: {
  embedded: boolean;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  if (embedded) {
    return (
      <View
        style={[styles.safeArea, { paddingTop: Math.max(insets.top, 10) }]}
      >
        {children}
      </View>
    );
  }
  return <View style={styles.safeArea}>{children}</View>;
}

export default function FriendProfile({
  embeddedFriendId,
  onEmbeddedBack,
}: FriendProfileProps = {}) {
  const {
    friendId,
    from,
    communityGroupId,
    communityGroupName,
    communityPlanId,
    communityPlanTitle,
  } = useLocalSearchParams<{
    friendId?: string | string[];
    from?: string;
    communityGroupId?: string;
    communityGroupName?: string;
    communityPlanId?: string;
    communityPlanTitle?: string;
  }>();
  const router = useRouter();
  const navReady = !!useRootNavigationState()?.key;

  const goBackOrHome = useCallback(() => {
    if (onEmbeddedBack) {
      onEmbeddedBack();
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(tabs)/friends");
  }, [router, onEmbeddedBack]);

  const handleBack = () => {
    goBackOrHome();
  };

  const viewerId = auth.currentUser?.uid ?? "";
  const routeFriendId = Array.isArray(friendId) ? friendId[0] : friendId || "";
  const friendKey = String(embeddedFriendId || routeFriendId);
  const isEmbedded = Boolean(embeddedFriendId);
  const isOwnProfile = Boolean(viewerId && friendKey && viewerId === friendKey);
  const scrollRef = useRef<ScrollView>(null);
  const headerLayout = useTabHeaderLayout({ embedded: isEmbedded });
  const profileScrollTopInset =
    headerLayout.contentPaddingTop - (isEmbedded ? 12 : 30);
  const ownProfileHandledRef = useRef(false);

  const renderStickyNav = (showOptions = true) => (
    <ProfileTabHeaderOverlay embedded={isEmbedded}>
      <BackButton onPress={handleBack} />
      {showOptions ? (
        <TouchableOpacity
          style={styles.optionsBtn}
          onPress={() => setShowOptionsSheet(true)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="More options"
        >
          <Ionicons name="ellipsis-horizontal" size={22} color={TEXT} />
        </TouchableOpacity>
      ) : (
        <View style={styles.optionsBtnPlaceholder} />
      )}
    </ProfileTabHeaderOverlay>
  );

  const resetEmbeddedScroll = useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []);

  useLayoutEffect(() => {
    if (!isEmbedded || !friendKey) return;
    resetEmbeddedScroll();
    const frame = requestAnimationFrame(resetEmbeddedScroll);
    const timer = setTimeout(
      resetEmbeddedScroll,
      MESSAGES_STACK_DURATION_MS + 48
    );
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [isEmbedded, friendKey, resetEmbeddedScroll]);
  const cachedFriend =
    viewerId && friendKey
      ? friendProfileCacheByUser[viewerId]?.[friendKey] ?? null
      : null;
  const cachedLastSynq =
    viewerId && friendKey
      ? friendRelationCacheByUser[viewerId]?.[friendKey]?.lastSynqAt?.toDate?.() ?? null
      : null;
  const cachedRelationship = getCachedFriendRelationship(viewerId, friendKey);
  const cachedMutualFriends =
    viewerId && friendKey ? getCachedMutualFriends(viewerId, friendKey) : undefined;

  const [friend, setFriend] = useState<any>(() => {
    if (!cachedFriend) return null;
    const { events: _cachedEvents, ...profile } = cachedFriend as any;
    return { ...profile, events: [] };
  });
  const [mutualFriends, setMutualFriends] = useState<any[]>(cachedMutualFriends ?? []);
  const [lastSynq, setLastSynq] = useState<Date | null>(cachedLastSynq);
  const [loading, setLoading] = useState(!cachedFriend);
  const [isFriend, setIsFriend] = useState(cachedRelationship.isFriend);
  const [requestSent, setRequestSent] = useState(cachedRelationship.requestSent);
  const [incomingRequest, setIncomingRequest] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [removingFriend, setRemovingFriend] = useState(false);
  const [friendGroups, setFriendGroups] = useState<FriendGroup[]>([]);
  const [addToGroupSheetVisible, setAddToGroupSheetVisible] = useState(false);
  const [addToGroupBusy, setAddToGroupBusy] = useState(false);
  const [joinedPlanKeys, setJoinedPlanKeys] = useState<Record<string, boolean>>({});
  const [busyPlanId, setBusyPlanId] = useState<string | null>(null);
  const [showUnjoinModal, setShowUnjoinModal] = useState(false);
  const [pendingUnjoinEvent, setPendingUnjoinEvent] = useState<any>(null);
  const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState<string | undefined>();
  const [alertMessage, setAlertMessage] = useState("");
  const [planSuccessToast, setPlanSuccessToast] = useState<string | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showOptionsSheet, setShowOptionsSheet] = useState(false);
  const optionsPendingRef = useRef<(() => void) | null>(null);
  const [viewerSynqActive, setViewerSynqActive] = useState(false);
  const [nudgeLoading, setNudgeLoading] = useState(false);
  const [nudgeSent, setNudgeSent] = useState(false);
  const { isBlocked } = useBlockedUsers();
  const userIsBlocked = friendKey ? isBlocked(friendKey) : false;
  const [hostDisplayNameByUid, setHostDisplayNameByUid] = useState<Record<string, string>>({});
  const [viewerEvents, setViewerEvents] = useState<any[]>([]);
  const [viewerCommunityGroups, setViewerCommunityGroups] = useState<CommunityGroup[]>(
    () => (viewerId ? communityGroupsCacheByUser[viewerId] ?? [] : [])
  );

  useEffect(() => {
    if (!isOwnProfile || isEmbedded || !navReady) return;
    if (ownProfileHandledRef.current) return;
    ownProfileHandledRef.current = true;
    setAlertTitle("That's your link");
    setAlertMessage("Open someone else's profile QR code or link to add them.");
    setAlertVisible(true);
  }, [isOwnProfile, isEmbedded, navReady]);

  const dismissOwnProfileLink = useCallback(() => {
    setAlertVisible(false);
    if (!navReady) return;
    router.replace("/(tabs)/me");
  }, [navReady, router]);

  const sharedCommunityGroups = useMemo(() => {
    if (!friendKey) return [];
    return viewerCommunityGroups.filter((group) => group.memberIds.includes(friendKey));
  }, [viewerCommunityGroups, friendKey]);

  const communityContextLabel = useMemo(() => {
    const routeGroupId = String(communityGroupId || "").trim();
    const routeGroupName = String(communityGroupName || "").trim();

    if (sharedCommunityGroups.length > 0) {
      const ordered = routeGroupId
        ? [
            ...sharedCommunityGroups.filter((group) => group.id === routeGroupId),
            ...sharedCommunityGroups.filter((group) => group.id !== routeGroupId),
          ]
        : sharedCommunityGroups;
      return formatSharedCommunityGroupsLabel(ordered);
    }

    if (routeGroupName) {
      return `Both in ${routeGroupName}`;
    }

    return null;
  }, [sharedCommunityGroups, communityGroupId, communityGroupName]);

  const showPlanSuccessToast = (message: string) => {
    setPlanSuccessToast(message);
  };

  const showAlert = (title: string, message: string) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertVisible(true);
  };

  const handleRemoveFriend = useCallback(async () => {
    const user = auth.currentUser;
    if (!user || !friendKey) {
      showAlert("Could not remove friend", "This profile is unavailable.");
      return;
    }

    setRemovingFriend(true);
    try {
      await removeFriendMutual(friendKey);
      setIsFriend(false);
      goBackOrHome();
    } catch (e) {
      console.error("Failed to remove friend", e);
      showAlert("Could not remove friend", removeFriendMutualErrorMessage(e));
    } finally {
      setRemovingFriend(false);
    }
  }, [friendKey, goBackOrHome]);

  const showFriendOpenPlansSection = useMemo(
    () => isFriend && filterOutPastOpenPlans(friend?.events).length > 0,
    [isFriend, friend?.events]
  );

  const profileOpenPlans = useMemo((): FriendOpenPlanEvent[] => {
    const events = Array.isArray(friend?.events) ? friend.events : [];
    return sortOpenPlansByDateTime(
      filterOutPastOpenPlans(events)
    ) as FriendOpenPlanEvent[];
  }, [friend?.events]);

  const friendPlanImageByUid = useMemo(() => {
    const url = String(friend?.imageurl || "").trim();
    if (!friendKey || !url) return {};
    return { [friendKey]: url };
  }, [friendKey, friend?.imageurl]);

  const isInSharedPlanWithFriend = (e: any, myUid: string, friendUid: string) => {
    if (!e || !friendUid) return false;
    if (e.joinedFromFriendUid === friendUid) return true;
    const ids = new Set(
      [...(Array.isArray(e?.joinedFromIds) ? e.joinedFromIds : []), e?.joinedFromId]
        .filter(Boolean)
        .map((id: string) => String(id).trim())
    );
    return ids.has(myUid) && ids.has(friendUid);
  };

  const setJoinedKeysForEvent = (event: any, value: boolean) => {
    setJoinedPlanKeys((prev) => {
      const next = { ...prev };
      const k1 = eventKey(event);
      const k2 = eventKeyLoose(event);
      if (value) {
        next[k1] = true;
        next[k2] = true;
      } else {
        delete next[k1];
        delete next[k2];
      }
      return next;
    });
  };

  const eventSortValue = (event: any) => {
    const date = String(event?.date || "");
    const [y, m, d] = date.split("-").map(Number);
    const base = new Date(
      Number.isFinite(y) ? y : 1970,
      Number.isFinite(m) ? m - 1 : 0,
      Number.isFinite(d) ? d : 1
    );
    const timeText = String(event?.time || "").trim();
    const timeMatch = timeText.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!timeMatch) return base.getTime();
    let hours = Number(timeMatch[1]);
    const minutes = Number(timeMatch[2]);
    const period = timeMatch[3].toUpperCase();
    if (period === "PM" && hours !== 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;
    base.setHours(hours, minutes, 0, 0);
    return base.getTime();
  };

  useEffect(() => {
    const user = auth.currentUser;
    if (!user || !friendKey) return;
    const hydrateJoinedPlans = async () => {
      try {
        const meSnap = await getDoc(doc(db, "users", user.uid));
        const meData = meSnap.exists() ? (meSnap.data() as any) : {};
        const mine = Array.isArray(meData?.events) ? meData.events : [];
        const next: Record<string, boolean> = {};
        mine.forEach((e: any) => {
          if (!isInSharedPlanWithFriend(e, user.uid, friendKey)) return;
          next[eventKey(e)] = true;
          next[eventKeyLoose(e)] = true;
        });
        setJoinedPlanKeys(next);
      } catch {}
    };
    hydrateJoinedPlans();
  }, [friendKey]);

  useEffect(() => {
    if (!viewerId) {
      setViewerEvents([]);
      return;
    }
    let cancelled = false;
    void getDocFromServer(doc(db, "users", viewerId))
      .then((snap) => {
        if (cancelled || !snap.exists()) return;
        const events = ((snap.data() as any)?.events as any[] | undefined) ?? [];
        setViewerEvents(Array.isArray(events) ? events : []);
      })
      .catch(() => {});
    const unsub = onSnapshot(doc(db, "users", viewerId), (snap) => {
      const events = snap.exists()
        ? ((snap.data() as any)?.events as any[] | undefined) ?? []
        : [];
      setViewerEvents(Array.isArray(events) ? events : []);
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [viewerId]);

  useEffect(() => {
    if (!viewerId) return;
    const cached = communityGroupsCacheByUser[viewerId];
    if (cached) setViewerCommunityGroups(cached);
    const unsub = subscribeJoinedCommunityGroups(
      viewerId,
      (groups) => {
        communityGroupsCacheByUser[viewerId] = groups;
        setViewerCommunityGroups(groups);
      },
      () => {}
    );
    return unsub;
  }, [viewerId]);

  useEffect(() => {
    if (!viewerId || !isFriend) {
      setFriendGroups([]);
      return;
    }
    const unsub = subscribeFriendGroups(viewerId, setFriendGroups);
    return unsub;
  }, [viewerId, isFriend]);

  useEffect(() => {
    if (!viewerId) return;
    const unsub = onSnapshot(
      doc(db, "users", viewerId),
      (snap) => {
        if (snap.exists()) {
          setViewerSynqActive(computeSynqActiveFromUserData(snap.data()));
        } else {
          setViewerSynqActive(false);
        }
      },
      () => setViewerSynqActive(false)
    );
    return () => unsub();
  }, [viewerId]);

  const friendSynqActive = useMemo(
    () => computeSynqActiveFromUserData(friend),
    [friend]
  );

  const canNudgeFriend =
    isFriend && viewerSynqActive && !friendSynqActive && !userIsBlocked;

  const showNudgeCard =
    isFriend && !userIsBlocked && (canNudgeFriend || nudgeSent);

  const nudgeSentStorageKey =
    viewerId && friendKey ? buildNudgeSentStorageKey(viewerId, friendKey) : null;

  useEffect(() => {
    if (!nudgeSentStorageKey) {
      setNudgeSent(false);
      return;
    }
    let cancelled = false;
    let expiryTimer: ReturnType<typeof setTimeout> | undefined;

    void readNudgeSentState(nudgeSentStorageKey).then(({ sent, sentAtMs }) => {
      if (cancelled) return;
      setNudgeSent(sent);
      if (sent && sentAtMs != null) {
        const remainingMs = nudgeCooldownRemainingMs(sentAtMs);
        if (remainingMs > 0) {
          expiryTimer = setTimeout(() => {
            if (!cancelled) setNudgeSent(false);
          }, remainingMs);
        }
      }
    });

    return () => {
      cancelled = true;
      if (expiryTimer) clearTimeout(expiryTimer);
    };
  }, [nudgeSentStorageKey]);

  useEffect(() => {
    if (!showNudgeCard || nudgeSent) return;
    warmSynqNudgeClient();
  }, [showNudgeCard, nudgeSent]);

  const handleSynqNudge = () => {
    if (!friendKey || nudgeLoading || nudgeSent || !canNudgeFriend) return;
    setNudgeLoading(true);
    setNudgeSent(true);
    showAlert("Nudge sent", "They'll get a notification asking if they're free.");
    if (nudgeSentStorageKey) {
      void persistNudgeSent(nudgeSentStorageKey);
    }

    void sendSynqNudge(friendKey)
      .catch((err) => {
        const msg = synqNudgeErrorMessage(err);
        if (msg.includes("again in a few hours")) {
          if (nudgeSentStorageKey) {
            void persistNudgeSent(nudgeSentStorageKey);
          }
          setNudgeSent(true);
          return;
        }
        setNudgeSent(false);
        if (nudgeSentStorageKey) {
          void clearNudgeSent(nudgeSentStorageKey);
        }
        showAlert("Couldn't nudge", msg);
      })
      .finally(() => {
        setNudgeLoading(false);
      });
  };

  useEffect(() => {
    if (!friendKey) return;

    if (viewerId) {
      void warmOutgoingFriendRequestsCache(viewerId).then(() => {
        const rel = getCachedFriendRelationship(viewerId, friendKey);
        setIsFriend(rel.isFriend);
        setRequestSent(rel.requestSent);
      });
      warmFriendsAndConnectionsCache(viewerId).then(() => {
        const rel = getCachedFriendRelationship(viewerId, friendKey);
        setIsFriend(rel.isFriend);
        setRequestSent(rel.requestSent);
        const warmedMutuals = getCachedMutualFriends(viewerId, friendKey);
        if (warmedMutuals !== undefined) {
          setMutualFriends(warmedMutuals);
        }
      });
    }

    const unsub = onSnapshot(
      doc(db, "users", friendKey),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setFriend(data);
          if (viewerId) {
            if (!friendProfileCacheByUser[viewerId]) {
              friendProfileCacheByUser[viewerId] = {};
            }
            friendProfileCacheByUser[viewerId][friendKey] = {
              id: friendKey,
              ...(data as any),
            } as any;
          }
        }
        setLoading(false);
      },
      () => setLoading(false)
    );

    // Force server truth for this profile's plans (ignore offline cache).
    void getDocFromServer(doc(db, "users", friendKey))
      .then((snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        setFriend(data);
        if (viewerId) {
          if (!friendProfileCacheByUser[viewerId]) {
            friendProfileCacheByUser[viewerId] = {};
          }
          friendProfileCacheByUser[viewerId][friendKey] = {
            id: friendKey,
            ...(data as any),
          } as any;
        }
        setLoading(false);
      })
      .catch(() => {});

    return () => unsub();
  }, [viewerId, friendKey]);

  useEffect(() => {
    if (!friendKey || !friend) return;
    const events = Array.isArray(friend.events) ? friend.events : [];
    const uids = new Set<string>();
    events.forEach((e: any) => {
      const h = String(e?.planHostUid || "").trim();
      if (h) uids.add(h);
      const jf = String(e?.joinedFromFriendUid || "").trim();
      if (jf) uids.add(jf);
      (Array.isArray(e?.joinedFromIds) ? e.joinedFromIds : []).forEach((id: string) => {
        const uid = String(id || "").trim();
        if (uid) uids.add(uid);
      });
      const stored = e?.attendeeDisplayNames;
      if (stored && typeof stored === "object") {
        Object.entries(stored).forEach(([uid, name]) => {
          const id = String(uid || "").trim();
          const label = String(name || "").trim();
          if (id && label) uids.add(id);
        });
      }
    });
    uids.add(friendKey);
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      if (friend.displayName) {
        next[friendKey] = String(friend.displayName);
      }
      events.forEach((e: any) => {
        const stored = e?.attendeeDisplayNames;
        if (!stored || typeof stored !== "object") return;
        Object.entries(stored).forEach(([uid, name]) => {
          const id = String(uid || "").trim();
          const label = String(name || "").trim();
          if (id && label) next[id] = label;
        });
      });
      await Promise.all(
        [...uids].map(async (uid) => {
          if (next[uid]) return;
          try {
            const snap = await getDoc(doc(db, "users", uid));
            if (snap.exists()) {
              const dn = String((snap.data() as any)?.displayName || "").trim();
              if (dn) next[uid] = dn;
            }
          } catch {}
        })
      );
      if (!cancelled) setHostDisplayNameByUid(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [friendKey, friend?.events, friend?.displayName]);

  useEffect(() => {
    if (!viewerId || !friendKey) return;

    const cached = getCachedMutualFriends(viewerId, friendKey);
    if (cached !== undefined) {
      setMutualFriends(cached);
      return;
    }

    let cancelled = false;

    void resolveMutualFriendsForTarget(viewerId, friendKey)
      .then((list) => {
        if (!cancelled) setMutualFriends(list);
      })
      .catch((e) => {
        console.error("[FriendProfile] resolveMutualFriends failed:", e);
        if (!cancelled) setMutualFriends([]);
      });

    return () => {
      cancelled = true;
    };
  }, [viewerId, friendKey]);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user || !friendId) return;

    const fetchLastSynq = async () => {
      const ref = doc(
        db,
        "users",
        user.uid,
        "friends",
        friendKey
      );

      const snap = await getDoc(ref);

      if (snap.exists()) {
        const data = snap.data();
        if (data.lastSynqAt?.toDate) {
          setLastSynq(data.lastSynqAt.toDate());
        }
      }
    };

    fetchLastSynq();
  }, [friendKey]);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user || !friendKey) return;
    const checkRelationship = async () => {
      const myId = user.uid;
      try {
        const friendSnap = await getDoc(doc(db, "users", myId, "friends", friendKey));
        const nextIsFriend = friendSnap.exists();
        setIsFriend(nextIsFriend);
        if (nextIsFriend) {
          setRequestSent(false);
          setIncomingRequest(false);
          setCachedOutgoingFriendRequest(myId, friendKey, false);
          return;
        }
        const [pendingSnap, incomingSnap] = await Promise.all([
          getDoc(doc(db, "users", friendKey, "friendRequests", myId)),
          getDoc(doc(db, "users", myId, "friendRequests", friendKey)),
        ]);
        const nextPending = pendingSnap.exists();
        const nextIncoming = incomingSnap.exists();
        setRequestSent(nextPending && !nextIncoming);
        setIncomingRequest(nextIncoming);
        setCachedOutgoingFriendRequest(myId, friendKey, nextPending && !nextIncoming);
      } catch {
        /* keep cached relationship state */
      }
    };
    void checkRelationship();
  }, [friendKey]);

  // Keep incoming-request state live (e.g. they sent a request after you opened share).
  useEffect(() => {
    if (!viewerId || !friendKey || isFriend) {
      setIncomingRequest(false);
      return;
    }
    const unsub = onSnapshot(
      doc(db, "users", viewerId, "friendRequests", friendKey),
      (snap) => {
        const exists = snap.exists();
        setIncomingRequest(exists);
        if (exists) setRequestSent(false);
      },
      () => {}
    );
    return () => unsub();
  }, [viewerId, friendKey, isFriend]);

  if (isOwnProfile && !isEmbedded) {
    return (
      <ProfileShell embedded={false}>
        <View style={styles.center}>
          <ProfileSkeleton />
        </View>
        <AlertModal
          visible={alertVisible}
          title={alertTitle}
          message={alertMessage}
          onClose={dismissOwnProfileLink}
        />
      </ProfileShell>
    );
  }

  if (loading) {
    return (
      <ProfileShell embedded={isEmbedded}>
        <View style={styles.screen}>
          {renderStickyNav(false)}
          <View style={[styles.center, { paddingTop: headerLayout.contentPaddingTop }]}>
            <ProfileSkeleton />
          </View>
        </View>
      </ProfileShell>
    );
  }

  if (!friend) {
    return (
      <ProfileShell embedded={isEmbedded}>
        <View style={styles.screen}>
          {renderStickyNav(false)}
          <View style={[styles.center, { paddingTop: headerLayout.contentPaddingTop }]}>
            <Text style={styles.emptyProfileText}>Could not load this profile.</Text>
          </View>
        </View>
      </ProfileShell>
    );
  }

  const city = friend.city?.trim();
  const state = friend.state?.trim();
  const locationText =
    friend.location || [city, state].filter(Boolean).join(", ");

  const avatarUri = resolveAvatar(friend.imageurl);

  const addFriend = async () => {
    const user = auth.currentUser;
    if (!user || !friendKey) return;
    setActionLoading(true);
    try {
      const meSnap = await getDoc(doc(db, "users", user.uid));
      const meData = meSnap.exists() ? (meSnap.data() as any) : {};
      const senderName = meData?.displayName || user.displayName || "Someone";
      const senderImageUrl = meData?.imageurl || null;
      const batch = writeBatch(db);
      batch.set(doc(db, "users", friendKey, "friendRequests", user.uid), {
        from: user.uid,
        to: friendKey,
        senderName,
        senderImageUrl,
        status: "pending",
        sentAt: serverTimestamp(),
        ...(from === "community" && communityGroupId
          ? {
              metVia: {
                communityGroupId: String(communityGroupId),
                ...(communityGroupName
                  ? { communityGroupName: String(communityGroupName) }
                  : {}),
                ...(communityPlanId ? { communityPlanId: String(communityPlanId) } : {}),
                ...(communityPlanTitle
                  ? { communityPlanTitle: String(communityPlanTitle) }
                  : {}),
              },
            }
          : {}),
      });
      batch.set(doc(db, "users", user.uid, "outgoingFriendRequests", friendKey), {
        to: friendKey,
        displayName: friend.displayName || null,
        imageurl: friend.imageurl || null,
        sentAt: serverTimestamp(),
      });
      await batch.commit();
      setRequestSent(true);
      setCachedOutgoingFriendRequest(user.uid, friendKey, true);
    } catch (e) {
      console.error("Failed to send friend request", e);
      setAlertTitle("Request failed");
      setAlertMessage("Could not send friend request. Please try again.");
      setAlertVisible(true);
    } finally {
      setActionLoading(false);
    }
  };

  const acceptIncomingFriendRequest = async () => {
    const user = auth.currentUser;
    if (!user || !friendKey) return;
    setActionLoading(true);
    try {
      const myId = user.uid;
      const meSnap = await getDoc(doc(db, "users", myId));
      const meData = meSnap.exists() ? (meSnap.data() as any) : {};
      const myName = meData?.displayName || user.displayName || "User";
      const myImageUrl = resolveAvatar(meData?.imageurl);
      const theirName = String(friend?.displayName || "User").trim() || "User";
      const theirImageUrl = resolveAvatar(friend?.imageurl);

      const batch = writeBatch(db);
      batch.set(doc(db, "users", myId, "friends", friendKey), {
        synqCount: 0,
        since: serverTimestamp(),
        displayName: theirName,
        imageurl: theirImageUrl,
        notifyOnCreate: true,
      });
      batch.set(doc(db, "users", friendKey, "friends", myId), {
        synqCount: 0,
        since: serverTimestamp(),
        displayName: myName,
        imageurl: myImageUrl,
      });
      batch.delete(doc(db, "users", myId, "friendRequests", friendKey));
      batch.delete(doc(db, "users", myId, "outgoingFriendRequests", friendKey));
      batch.delete(doc(db, "users", friendKey, "outgoingFriendRequests", myId));
      await batch.commit();

      await deleteDoc(doc(db, "users", friendKey, "friendRequests", myId)).catch(() => {});

      setIsFriend(true);
      setIncomingRequest(false);
      setRequestSent(false);
      setCachedOutgoingFriendRequest(myId, friendKey, false);
      showAlert(
        "Success",
        `You are now connected with ${theirName.split(/\s+/)[0] || theirName}!`
      );
    } catch (e) {
      console.error("Failed to accept friend request", e);
      showAlert("Error", "Could not accept friend request. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  const joinPlan = async (event: FriendOpenPlanEvent) => {
    const user = auth.currentUser;
    if (!user || !friendKey) return;
    setBusyPlanId(event.id);
    const profileName = String(friend?.displayName || "Friend").trim();
    try {
      await joinFriendOpenPlan(event, friendKey, profileName);
      setJoinedKeysForEvent(event, true);
      setViewerEvents((prev) =>
        appendOptimisticJoinedViewerEvent(
          prev,
          event,
          friendKey,
          profileName,
          user.uid
        )
      );
      setTimeout(() => showPlanSuccessToast("Joined!"), 280);
    } catch (e: any) {
      showAlert("Error", e?.message || "Could not join this plan right now.");
    } finally {
      setBusyPlanId(null);
    }
  };

  const planLooksJoined = (e: any) => {
    if (joinedPlanKeys[eventKey(e)] || joinedPlanKeys[eventKeyLoose(e)]) return true;
    // Fallback: viewer calendar already has this plan with the friend on the roster.
    if (!viewerId || !friendKey || !Array.isArray(viewerEvents)) return false;
    return viewerEvents.some(
      (row) =>
        planLooseMatch(row, e) &&
        collectJoinedIds(row).includes(String(friendKey).trim())
    );
  };

  const isViewerHostOfFriendsPlan = (event: any) => {
    if (!viewerId || !friendKey) return false;
    const vid = String(viewerId).trim();
    const fk = String(friendKey).trim();
    if (
      Array.isArray(viewerEvents) &&
      viewerEvents.some(
        (row) =>
          planLooseMatch(row, event) && String(row?.planHostUid || "").trim() === vid
      )
    ) {
      return true;
    }
    if (String(event?.planHostUid || "").trim() === vid) return true;
    if (String(event?.joinedFromFriendUid || "").trim() === vid) return true;
    const jf = String(event?.joinedFromId || "").trim();
    if (jf === vid) {
      const ids = new Set(
        [...(Array.isArray(event?.joinedFromIds) ? event.joinedFromIds : [])].map((id: string) =>
          String(id).trim()
        )
      );
      if (ids.has(fk) && ids.has(vid)) return true;
    }
    return false;
  };

  const handleProfilePlanAction = (event: any) => {
    if (isViewerHostOfFriendsPlan(event)) return;
    if (planLooksJoined(event)) {
      if (showUnjoinModal) return;
      setPendingUnjoinEvent(event);
      setShowUnjoinModal(true);
    } else {
      void joinPlan(event);
    }
  };

  const unjoinPlan = async (event: FriendOpenPlanEvent) => {
    const user = auth.currentUser;
    if (!user || !friendKey) return;
    setBusyPlanId(String(event?.id || ""));
    try {
      await unjoinFriendOpenPlan(event, friendKey);
      setJoinedKeysForEvent(event, false);
      setViewerEvents((prev) =>
        removeJoinedViewerEvent(prev, event, friendKey, user.uid)
      );
      setTimeout(() => showPlanSuccessToast("Removed"), 280);
    } catch (e: any) {
      showAlert("Error", e?.message || "Could not remove this plan.");
    } finally {
      setBusyPlanId(null);
    }
  };

  return (
    <ProfileShell embedded={isEmbedded}>
      <View style={styles.screen}>
      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: profileScrollTopInset },
        ]}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        onLayout={isEmbedded ? resetEmbeddedScroll : undefined}
      >
        <View style={styles.friendCard}>
          <View style={[styles.header, showNudgeCard && styles.headerWithNudge]}>
            <TouchableOpacity
              onPress={() => setAvatarPreviewOpen(true)}
              onLongPress={() => setAvatarPreviewOpen(true)}
              activeOpacity={0.9}
              accessibilityRole="imagebutton"
              accessibilityLabel="Open profile photo preview"
            >
              <View style={styles.avatarGlowWrap}>
                <ExpoImage
                  source={{ uri: avatarUri }}
                  style={styles.avatar}
                  cachePolicy="memory-disk"
                  transition={0}
                  recyclingKey={avatarUri}
                />
              </View>
            </TouchableOpacity>

            <Text style={styles.name}>
              {friend.displayName || "User"}
            </Text>

            {locationText ? (
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={14} color={MUTED2} />
                <Text style={styles.locationText}>{locationText}</Text>
              </View>
            ) : null}

            {!isFriend && communityContextLabel ? (
              <View style={styles.communityContextRow}>
                <Text style={styles.communityContextText} numberOfLines={2}>
                  {communityContextLabel}
                </Text>
              </View>
            ) : null}

            {lastSynq ? (
              <Text style={styles.lastSynqText}>
                Last Synq: {formatLastSynq(lastSynq)}
              </Text>
            ) : null}
          </View>

          {showNudgeCard ? (
            <View style={styles.nudgeCardWrap}>
              <SynqNudgeCard
                onNudge={handleSynqNudge}
                loading={nudgeLoading}
                sent={nudgeSent}
              />
            </View>
          ) : null}
        </View>

        {userIsBlocked ? (
          <View style={styles.profileActionWrap}>
            <Text style={styles.blockedHint}>You’ve blocked this user.</Text>
          </View>
        ) : !isFriend ? (
          <View style={styles.profileActionWrap}>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[
                synqOutlineAddBtn,
                requestSent && !incomingRequest && synqOutlineAddBtnDisabled,
              ]}
              onPress={incomingRequest ? acceptIncomingFriendRequest : addFriend}
              disabled={(!incomingRequest && requestSent) || actionLoading}
              accessibilityRole="button"
              accessibilityLabel={
                incomingRequest
                  ? "Accept friend request"
                  : requestSent
                    ? "Friend request pending"
                    : "Add friend"
              }
            >
              <Text
                style={[
                  synqOutlineAddBtnText,
                  requestSent && !incomingRequest && synqOutlineAddBtnTextDisabled,
                  actionLoading && { opacity: 0.5 },
                ]}
              >
                {incomingRequest
                  ? "Accept friend request"
                  : requestSent
                    ? "Pending"
                    : "Add friend"}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {mutualFriends.length > 0 && (
          <View style={[styles.profileSection, styles.profileSectionLead]}>
            <Text style={styles.profileSectionLabel}>Mutual friends</Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.synqsContainer}
            >
              {mutualFriends.map((item) => (
                  <View key={item.id} style={styles.connItem}>
                    <Pressable
                      onPress={() =>
                        router.push({
                          pathname: "/friend-profile",
                          params: {
                            friendId: item.id,
                            ...(from ? { from } : {}),
                          },
                        })
                      }
                      style={({ pressed }) => [
                        styles.imageCircle,
                        pressed && styles.connImgPressed,
                      ]}
                    >
                      <ExpoImage
                        source={{ uri: resolveAvatar(item.imageurl) }}
                        style={styles.connImg}
                        cachePolicy="memory-disk"
                        transition={0}
                      />
                    </Pressable>

                    <Text style={styles.connName} numberOfLines={1}>
                      {item.displayName?.split(" ")[0] || "User"}
                    </Text>
                  </View>
              ))}
            </ScrollView>
          </View>
        )}

        {mutualFriends.length > 0 ? (
          <View style={styles.profileSectionDivider} />
        ) : null}

        <View
          style={[
            styles.profileSection,
            mutualFriends.length === 0 && styles.profileSectionLead,
          ]}
        >
          <Text style={styles.profileSectionLabel}>Interests</Text>
          <View style={styles.interestsWrapper}>
            {friend.interests?.length ? (
              friend.interests.map((interest: string, i: number) => (
                <View key={i} style={styles.pill}>
                  <Text style={styles.pillText}>{interest}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>
                No interests listed
              </Text>
            )}
          </View>
        </View>

        {showFriendOpenPlansSection ? (
          <>
            <View style={styles.profileSectionDivider} />
            <View style={styles.profileSection}>
              <Text style={styles.profileSectionLabel}>
                {`${friend.displayName?.trim().split(/\s+/)[0] || "Friend"}'s plans`}
              </Text>

              <View style={styles.profilePlansList}>
                {profileOpenPlans.map((event) => {
                  const item = {
                    event,
                    sourceFriendId: friendKey,
                    sourceFriendName: String(friend?.displayName || "Friend").trim(),
                  };
                  return (
                    <FriendPlanCard
                      key={event.id}
                      item={item}
                      viewerId={viewerId}
                      hostDisplayNameByUid={hostDisplayNameByUid}
                      viewerEvents={viewerEvents}
                      friendImageByUid={friendPlanImageByUid}
                      joined={planLooksJoined(event)}
                      isHost={isViewerHostOfFriendsPlan(event)}
                      busy={busyPlanId === event.id}
                      cardPressOpensGoing
                      onPressCard={() => {}}
                      onPressAction={() => handleProfilePlanAction(event)}
                      onOpenPersonProfile={(userId, preview) => {
                        if (!userId || userId === viewerId) return;
                        if (viewerId) {
                          if (!friendProfileCacheByUser[viewerId]) {
                            friendProfileCacheByUser[viewerId] = {};
                          }
                          const existing = friendProfileCacheByUser[viewerId][userId];
                          friendProfileCacheByUser[viewerId][userId] = {
                            ...(existing || {}),
                            id: userId,
                            displayName:
                              String(preview?.displayName || "").trim() ||
                              existing?.displayName ||
                              "Friend",
                            imageurl:
                              String(preview?.imageUrl || "").trim() ||
                              existing?.imageurl ||
                              undefined,
                          } as any;
                        }
                        router.push({
                          pathname: "/friend-profile",
                          params: { friendId: userId },
                        });
                      }}
                    />
                  );
                })}
              </View>
            </View>
          </>
        ) : null}

        {isFriend && !userIsBlocked ? (
          <View style={styles.friendActionsWrap}>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[
                synqOutlineAddBtn,
                styles.removeFriendBtn,
                removingFriend && synqOutlineAddBtnDisabled,
              ]}
              onPress={() => setShowRemoveModal(true)}
              disabled={removingFriend}
              accessibilityRole="button"
              accessibilityLabel="Remove friend"
            >
              <Text
                style={[
                  synqOutlineAddBtnText,
                  styles.removeFriendText,
                  removingFriend && synqOutlineAddBtnTextDisabled,
                ]}
              >
                Remove friend
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
      {renderStickyNav()}
      <SpringBottomSheet
        visible={showOptionsSheet}
        onClose={() => setShowOptionsSheet(false)}
        onClosed={() => {
          const action = optionsPendingRef.current;
          optionsPendingRef.current = null;
          action?.();
        }}
        contentStyle={styles.optionsSheetGroup}
        cardStyle={sheetStyles.sheetCard}
        footer={
          <TouchableOpacity
            style={styles.optionsCancel}
            onPress={() => setShowOptionsSheet(false)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={styles.optionsCancelText}>Cancel</Text>
          </TouchableOpacity>
        }
      >
        {userIsBlocked ? (
          <TouchableOpacity
            style={styles.optionsRow}
            onPress={() => {
              optionsPendingRef.current = () => {
                if (!friendKey) return;
                void (async () => {
                  try {
                    await unblockUser(friendKey);
                    setAlertTitle("Unblocked");
                    setAlertMessage("You can connect with this person again.");
                    setAlertVisible(true);
                  } catch {
                    setAlertTitle("Error");
                    setAlertMessage("Could not unblock user.");
                    setAlertVisible(true);
                  }
                })();
              };
              setShowOptionsSheet(false);
            }}
          >
            <Ionicons name="person-add-outline" size={22} color={TEXT} />
            <Text style={styles.optionsRowText}>Unblock user</Text>
          </TouchableOpacity>
        ) : (
          <>
            {isFriend ? (
              <>
                <TouchableOpacity
                  style={styles.optionsRow}
                  onPress={() => {
                    optionsPendingRef.current = () => setAddToGroupSheetVisible(true);
                    setShowOptionsSheet(false);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Add friend to circle"
                >
                  <Ionicons name="people-outline" size={22} color={TEXT} />
                  <Text style={styles.optionsRowText}>Add friend to circle</Text>
                </TouchableOpacity>
                <View style={styles.optionsDivider} />
              </>
            ) : null}
            <TouchableOpacity
              style={styles.optionsRow}
              onPress={() => {
                optionsPendingRef.current = () => setShowReportModal(true);
                setShowOptionsSheet(false);
              }}
            >
              <Ionicons name="flag-outline" size={22} color={TEXT} />
              <Text style={styles.optionsRowText}>Report user</Text>
            </TouchableOpacity>
            <View style={styles.optionsDivider} />
            <TouchableOpacity
              style={styles.optionsRow}
              onPress={() => {
                optionsPendingRef.current = () => setShowBlockModal(true);
                setShowOptionsSheet(false);
              }}
            >
              <Ionicons name="ban-outline" size={22} color={DESTRUCTIVE} />
              <Text style={[styles.optionsRowText, styles.optionsDestructive]}>
                Block user
              </Text>
            </TouchableOpacity>
          </>
        )}
      </SpringBottomSheet>
      <ReportModal
        visible={showReportModal}
        reportedUserId={friendKey}
        contentType="user"
        onClose={() => setShowReportModal(false)}
        onSubmitted={() => {
          setAlertTitle("Report submitted");
          setAlertMessage("Thanks. We review reports within 24 hours.");
          setAlertVisible(true);
        }}
      />
      <ConfirmModal
        visible={showBlockModal}
        title="Block user?"
        message={`${friend?.displayName || "This user"} will be removed from your feed immediately. We'll be notified to review any concerns.`}
        confirmText="Block"
        destructive
        onCancel={() => setShowBlockModal(false)}
        onConfirm={async () => {
          setShowBlockModal(false);
          if (!friendKey) return;
          try {
            await blockUser(friendKey);
            goBackOrHome();
          } catch {
            setAlertTitle("Error");
            setAlertMessage("Could not block user.");
            setAlertVisible(true);
          }
        }}
      />
      <AddFriendToGroupSheet
        visible={addToGroupSheetVisible}
        busy={addToGroupBusy}
        groups={friendGroups}
        friendName={friend?.displayName || "Friend"}
        memberId={friendKey}
        onClose={() => setAddToGroupSheetVisible(false)}
        onSave={async ({ addedGroupIds, removedGroupIds }) => {
          if (!viewerId || !friendKey) return;
          setAddToGroupBusy(true);
          try {
            const groupById = new Map(friendGroups.map((group) => [group.id, group]));
            await Promise.all([
              ...addedGroupIds.map((groupId) => {
                const group = groupById.get(groupId);
                if (!group) return Promise.resolve();
                return addMembersToFriendGroup(viewerId, groupId, group.memberIds, [friendKey]);
              }),
              ...removedGroupIds.map((groupId) => {
                const group = groupById.get(groupId);
                if (!group) return Promise.resolve();
                return removeMemberFromFriendGroup(viewerId, groupId, group.memberIds, friendKey);
              }),
            ]);
            setAddToGroupSheetVisible(false);
            const friendLabel = friend?.displayName || "Friend";
            if (addedGroupIds.length > 0 && removedGroupIds.length > 0) {
              setAlertTitle("Groups updated");
              setAlertMessage(`${friendLabel}'s groups were updated.`);
            } else if (addedGroupIds.length === 1) {
              const groupName = groupById.get(addedGroupIds[0])?.name || "the group";
              setAlertTitle("Added to group");
              setAlertMessage(`Added to ${groupName}.`);
            } else if (addedGroupIds.length > 1) {
              setAlertTitle("Added to groups");
              setAlertMessage(`Added to ${addedGroupIds.length} groups.`);
            } else if (removedGroupIds.length === 1) {
              const groupName = groupById.get(removedGroupIds[0])?.name || "the group";
              setAlertTitle("Removed from group");
              setAlertMessage(`Removed from ${groupName}.`);
            } else if (removedGroupIds.length > 1) {
              setAlertTitle("Removed from groups");
              setAlertMessage(`Removed from ${removedGroupIds.length} groups.`);
            }
            setAlertVisible(true);
          } catch (err) {
            setAlertTitle("Error");
            setAlertMessage(err instanceof Error ? err.message : "Could not update groups.");
            setAlertVisible(true);
          } finally {
            setAddToGroupBusy(false);
          }
        }}
      />
      <ConfirmModal
        visible={showRemoveModal}
        title="Remove friend"
        message={`Are you sure you want to remove ${friend.displayName} as a friend?`}
        confirmText="Remove friend"
        destructive
        onCancel={() => setShowRemoveModal(false)}
        onConfirm={() => {
          setShowRemoveModal(false);
          requestAnimationFrame(() => {
            void handleRemoveFriend();
          });
        }}
      />
      {removingFriend ? (
        <View style={styles.removingOverlay} pointerEvents="auto">
          <Text style={styles.removingText}>Removing friend…</Text>
        </View>
      ) : null}
      <ConfirmModal
        visible={showUnjoinModal}
        title="Remove this plan?"
        message=""
        confirmText="Remove"
        destructive
        onCancel={() => {
          setShowUnjoinModal(false);
          setPendingUnjoinEvent(null);
        }}
        onConfirm={async () => {
          const ev = pendingUnjoinEvent;
          setShowUnjoinModal(false);
          setPendingUnjoinEvent(null);
          if (ev) await unjoinPlan(ev);
        }}
      />
      <CheckmarkToast
        visible={!!planSuccessToast}
        message={planSuccessToast ?? ""}
        onDismiss={() => setPlanSuccessToast(null)}
      />
      <AlertModal
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        onClose={() => setAlertVisible(false)}
      />
      <Modal
        visible={avatarPreviewOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setAvatarPreviewOpen(false)}
      >
        <Pressable
          style={styles.avatarPreviewOverlay}
          onPress={() => setAvatarPreviewOpen(false)}
          accessibilityRole="button"
          accessibilityLabel="Close profile photo preview"
        >
          <View style={styles.avatarPreviewDim} pointerEvents="none" />
          <ExpoImage
            source={{ uri: avatarUri }}
            style={styles.avatarPreviewImage}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={0}
            recyclingKey={avatarUri}
          />
        </Pressable>
      </Modal>
      </View>
    </ProfileShell>
  );
}

const PROFILE_SURFACE = SURFACE_INPUT;
const PROFILE_SURFACE_RAISED = SURFACE_RAISED;
const PROFILE_BORDER = FRIENDS_BORDER;
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BG },
  screen: { flex: 1, backgroundColor: BG, position: "relative" },
  scrollView: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 36,
  },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyProfileText: {
    color: MUTED2,
    fontFamily: fonts.book,
    fontSize: TYPE_BUTTON,
    marginTop: 24,
    textAlign: "center",
    paddingHorizontal: 24,
  },


  optionsBtnPlaceholder: {
    width: 38,
    height: 38,
  },
  optionsBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: PROFILE_SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PROFILE_BORDER,
    justifyContent: "center",
    alignItems: "center",
  },

  friendCard: {
    marginTop: 0,
    marginBottom: 0,
    backgroundColor: PROFILE_SURFACE,
    borderRadius: RADIUS_MD,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PROFILE_BORDER,
    overflow: "hidden",
  },
  header: {
    alignItems: "center",
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  headerWithNudge: {
    paddingBottom: 14,
  },
  nudgeCardWrap: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  friendActionsWrap: {
    marginTop: 24,
    paddingHorizontal: 20,
    gap: 12,
    alignItems: "center",
  },
  removingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BG,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
    zIndex: 100,
  },
  removingText: {
    color: MUTED2,
    fontFamily: fonts.medium,
    fontSize: TYPE_BUTTON,
  },
  removeFriendBtn: {
    borderColor: DESTRUCTIVE_BORDER_STRONG,
    backgroundColor: DESTRUCTIVE_FILL_SUBTLE,
  },
  avatarGlowWrap: {
    borderRadius: 80,
    marginBottom: 16,
    shadowColor: ACCENT,
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },

  avatar: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1.5,
    borderColor: ACCENT,
  },
  avatarPreviewOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    paddingHorizontal: 24,
  },
  avatarPreviewDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: OVERLAY_SCRIM,
  },
  avatarPreviewImage: {
    width: 300,
    height: 300,
    borderRadius: 150,
    borderWidth: 1.5,
    borderColor: MUTED3,
  },

  avatarFallback: {
    backgroundColor: SURFACE_ELEVATED,
    justifyContent: "center",
    alignItems: "center",
  },

  name: {
    ...profileNameText,
    includeFontPadding: false,
  },

  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },

  locationText: {
    ...profileLocationText,
    marginLeft: 4,
  },

  communityContextRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },

  communityContextText: {
    ...profileLocationText,
    marginLeft: 4,
    flexShrink: 1,
  },

  lastSynqText: {
    color: MUTED3,
    marginTop: 6,
    fontFamily: fonts.book,
    fontSize: TYPE_CAPTION,
    lineHeight: 18,
    textAlign: "center",
  },

  profileSection: {},
  profilePlansList: {
    width: "100%",
  },

  profileSectionLead: {
    marginTop: 16,
  },

  profileSectionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: BORDER,
    marginTop: 16,
    marginBottom: 16,
  },

  profileActionWrap: {
    width: "100%",
    marginTop: 10,
    alignItems: "center",
    gap: 10,
  },

  profileSectionLabel: profileScreenSectionTitle,

  blockedHint: {
    color: MUTED2,
    fontFamily: fonts.medium,
    fontSize: TYPE_LEAD,
    textAlign: "center",
  },

  optionsSheetGroup: {
    paddingHorizontal: 12,
    paddingBottom: 34,
  },
  optionsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 14,
  },
  optionsRowText: {
    color: TEXT,
    fontSize: TYPE_BODY,
    fontFamily: fonts.medium,
  },
  optionsDestructive: {
    color: DESTRUCTIVE,
  },
  optionsDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: BORDER,
    marginLeft: 54,
  },
  optionsCancel: {
    marginTop: 10,
    backgroundColor: BG,
    borderRadius: RADIUS_MD,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 16,
    alignItems: "center",
  },
  optionsCancelText: {
    color: TEXT,
    fontSize: TYPE_BODY,
    fontFamily: fonts.heavy,
  },

  synqsContainer: {
    flexDirection: "row",
    justifyContent: "flex-start",
    gap: 14,
  },

  connItem: {
    alignItems: "center",
    width: 72,
  },

  imageCircle: {
    width: 55,
    height: 55,
    borderRadius: 50,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER_SOFT,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    backgroundColor: PROFILE_SURFACE,
  },

  connImgPressed: {
    transform: [{ scale: 0.92 }],
  },

  connImg: {
    width: 55,
    height: 55,
    borderRadius: 50,
  },

  connName: {
    color: TEXT,
    fontSize: TYPE_LEAD,
    marginTop: 8,
    textAlign: "center",
    fontFamily: fonts.book,
  },

  interestsWrapper: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  pill: {
    backgroundColor: PROFILE_SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GROUP_BORDER,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  pillText: {
    color: TEXT,
    fontSize: TYPE_LEAD,
    fontFamily: fonts.book,
  },
  emptyText: {
    color: MUTED2,
    fontSize: TYPE_CAPTION,
    fontFamily: fonts.book,
    fontStyle: "italic",
  },
  removeFriendText: {
    color: DESTRUCTIVE,
  },
  memoCard: {
    backgroundColor: PROFILE_SURFACE_RAISED,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PROFILE_BORDER,
    borderRadius: RADIUS_MD,
    padding: 16,
  },

  memoText: {
    color: TEXT,
    fontSize: TYPE_LEAD,
    lineHeight: 20,
    fontFamily: fonts.medium,
  },
});