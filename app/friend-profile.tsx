import {
  ACCENT,
  BG,
  BORDER,
  BORDER_SOFT,
  BUTTON_RADIUS,
  DESTRUCTIVE,
  DESTRUCTIVE_BORDER_STRONG,
  FRIENDS_BORDER,
  GROUP_BORDER,
  MODAL_RADIUS,
  MUTED2,
  MUTED3,
  OVERLAY_HEAVY,
  OVERLAY_SCRIM,
  RADIUS_MD,
  SURFACE,
  SURFACE_INPUT,
  SURFACE_LIFTED,
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
  synqOutlineAddBtnTextDisabled,
} from "@/constants/Variables";
import BackButton from "@/src/components/BackButton";
import AddFriendToGroupSheet from "@/src/components/friends/AddFriendToGroupSheet";
import ProfileTabHeaderOverlay, {
  useTabHeaderLayout,
} from "@/src/components/ProfileTabHeaderOverlay";
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
  removeFriendMutual,
  removeFriendMutualErrorMessage,
} from "@/src/lib/friends";
import { formatLastSynq, resolveAvatar } from "@/src/lib/helpers";
import { blockUser, unblockUser } from "@/src/lib/moderation";
import { requestDismissNavigationOverlays } from "@/src/lib/navigationOverlayEvents";
import {
  nudgeSentStorageKey as buildNudgeSentStorageKey,
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
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  updateDoc,
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
  ActivityIndicator,
  Animated,
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
import { resolvePlanHostUidForJoin } from "../src/lib/planAttribution";
import {
  eventKey,
  eventKeyLoose,
  filterOutPastOpenPlans,
  matchesPlanEvent,
  matchesPlanEventForHostSync,
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
import MonthlyMemoReadOnly from "./readonly-monthly-memo";
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

  useLayoutEffect(() => {
    if (!isOwnProfile || isEmbedded) return;
    router.replace("/(tabs)/me");
  }, [isOwnProfile, isEmbedded, router]);

  useLayoutEffect(() => {
    if (isEmbedded) return;
    requestDismissNavigationOverlays();
  }, [isEmbedded, friendKey]);

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

  const [friend, setFriend] = useState<any>(cachedFriend);
  const [mutualFriends, setMutualFriends] = useState<any[]>(cachedMutualFriends ?? []);
  const [lastSynq, setLastSynq] = useState<Date | null>(cachedLastSynq);
  const [loading, setLoading] = useState(!cachedFriend);
  const [isFriend, setIsFriend] = useState(cachedRelationship.isFriend);
  const [requestSent, setRequestSent] = useState(cachedRelationship.requestSent);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [removingFriend, setRemovingFriend] = useState(false);
  const [friendGroups, setFriendGroups] = useState<FriendGroup[]>([]);
  const [addToGroupSheetVisible, setAddToGroupSheetVisible] = useState(false);
  const [addToGroupBusy, setAddToGroupBusy] = useState(false);
  const [joinedPlanKeys, setJoinedPlanKeys] = useState<Record<string, boolean>>({});
  const [showUnjoinModal, setShowUnjoinModal] = useState(false);
  const [pendingUnjoinEvent, setPendingUnjoinEvent] = useState<any>(null);
  const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState<string | undefined>();
  const [alertMessage, setAlertMessage] = useState("");
  const [showReportModal, setShowReportModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showOptionsSheet, setShowOptionsSheet] = useState(false);
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
    const unsub = onSnapshot(doc(db, "users", viewerId), (snap) => {
      const events = snap.exists()
        ? ((snap.data() as any)?.events as any[] | undefined) ?? []
        : [];
      setViewerEvents(Array.isArray(events) ? events : []);
    });
    return unsub;
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

  const handleSynqNudge = async () => {
    if (!friendKey || nudgeLoading || nudgeSent || !canNudgeFriend) return;
    setNudgeLoading(true);
    try {
      await sendSynqNudge(friendKey);
      if (nudgeSentStorageKey) {
        await persistNudgeSent(nudgeSentStorageKey);
      }
      setNudgeSent(true);
      showAlert("Nudge sent", "They'll get a notification asking if they're free.");
    } catch (err) {
      const msg = synqNudgeErrorMessage(err);
      if (msg.includes("again in a few hours") && nudgeSentStorageKey) {
        await persistNudgeSent(nudgeSentStorageKey);
        setNudgeSent(true);
      } else {
        showAlert("Couldn't nudge", msg);
      }
    } finally {
      setNudgeLoading(false);
    }
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
        const warmed = friendProfileCacheByUser[viewerId]?.[friendKey];
        if (warmed) {
          setFriend(warmed);
          setLoading(false);
        }
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
          setCachedOutgoingFriendRequest(myId, friendKey, false);
          return;
        }
        const pendingSnap = await getDoc(
          doc(db, "users", friendKey, "friendRequests", myId)
        );
        const nextPending = pendingSnap.exists();
        setRequestSent(nextPending);
        setCachedOutgoingFriendRequest(myId, friendKey, nextPending);
      } catch {
        /* keep cached relationship state */
      }
    };
    void checkRelationship();
  }, [friendKey]);

  if (isOwnProfile && !isEmbedded) {
    return (
      <ProfileShell embedded={false}>
        <View style={styles.center}>
          <ActivityIndicator color={ACCENT} />
        </View>
      </ProfileShell>
    );
  }

  if (loading) {
    return (
      <ProfileShell embedded={isEmbedded}>
        <View style={styles.screen}>
          {renderStickyNav(false)}
          <View style={[styles.center, { paddingTop: headerLayout.contentPaddingTop }]}>
            <ActivityIndicator color={ACCENT} />
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

  const joinPlan = async (event: {
    id: string;
    date: string;
    title: string;
    time?: string;
    location?: string;
    planHostUid?: string;
    joinedFromId?: string;
    joinedFromIds?: string[];
    joinedFromName?: string;
    joinedFromNames?: string[];
  }) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const meRef = doc(db, "users", user.uid);
      const meSnap = await getDoc(meRef);
      const meData = meSnap.exists() ? (meSnap.data() as any) : {};
      const existingEvents = Array.isArray(meData?.events) ? meData.events : [];
      const joinerName =
        String(meData?.displayName || auth.currentUser?.displayName || "Friend").trim();
      const profileName = String(friend?.displayName || "Friend").trim();
      const initialSourceIds = Array.from(
        new Set(
          [
            ...((Array.isArray(event?.joinedFromIds) ? event.joinedFromIds : []).filter(Boolean) as string[]),
            String(event?.joinedFromId || "").trim(),
            friendKey,
            user.uid,
          ]
            .map((id) => String(id).trim())
            .filter(Boolean)
        )
      );
      const sourceNames = Array.from(
        new Set(
          [
            ...((Array.isArray(event?.joinedFromNames) ? event.joinedFromNames : []).filter(Boolean) as string[]),
            String(event?.joinedFromName || "").trim(),
            profileName,
            joinerName,
          ]
            .map((n) => n.trim())
            .filter(Boolean)
        )
      );
      const sourceIdsSet = new Set(initialSourceIds);
      const sourceNameSet = new Set(sourceNames.map((n) => n.toLowerCase()));
      try {
        const myFriendsSnap = await getDocs(collection(db, "users", user.uid, "friends"));
        myFriendsSnap.docs.forEach((d) => {
          const data = d.data() as any;
          const display = String(data?.displayName || "").trim().toLowerCase();
          if (display && sourceNameSet.has(display)) {
            sourceIdsSet.add(d.id);
          }
        });
      } catch {}
      const sourceIds = Array.from(sourceIdsSet);

      const displayNameById: Record<string, string> = {};
      await Promise.all(
        sourceIds.map(async (uid) => {
          try {
            const s = await getDoc(doc(db, "users", uid));
            if (s.exists()) {
              displayNameById[uid] = String((s.data() as any)?.displayName || "").trim();
            }
          } catch {}
        })
      );

      const planHostUid = resolvePlanHostUidForJoin(event, friendKey);
      const eventForMatch = { ...event, planHostUid: event.planHostUid || planHostUid };

      const syncAttendeesAcrossUsers = async (allAttendeeIds: string[]) => {
        await Promise.all(
          allAttendeeIds.map(async (attendeeId) => {
            try {
              const attendeeRef = doc(db, "users", attendeeId);
              const attendeeSnap = await getDoc(attendeeRef);
              if (!attendeeSnap.exists()) return;
              const attendeeData = attendeeSnap.data() as any;
              const attendeeEvents = Array.isArray(attendeeData?.events) ? attendeeData.events : [];
              let changed = false;
              const nextAttendeeEvents = attendeeEvents.map((e: any) => {
                const isHostDoc =
                  !!planHostUid && String(attendeeId) === planHostUid;
                const hostMatchedById =
                  isHostDoc &&
                  event?.id != null &&
                  e?.id != null &&
                  String(e.id) === String(event.id);
                const matched =
                  hostMatchedById ||
                  matchesPlanEvent(e, eventForMatch, attendeeEvents) ||
                  (isHostDoc &&
                    matchesPlanEventForHostSync(e, eventForMatch, attendeeEvents, planHostUid));
                if (!matched) return e;
                const existingIds = Array.isArray(e?.joinedFromIds)
                  ? e.joinedFromIds
                  : [e?.joinedFromId].filter(Boolean);
                const mergedIds = Array.from(
                  new Set(
                    [...existingIds, ...allAttendeeIds]
                      .map((id: string) => String(id).trim())
                      .filter(Boolean)
                  )
                );
                const otherNames = mergedIds
                  .filter((id) => id !== attendeeId)
                  .map((id) => displayNameById[id])
                  .filter(Boolean);
                const prevNames = Array.isArray(e?.joinedFromNames)
                  ? e.joinedFromNames
                  : [e?.joinedFromName].filter(Boolean);
                const idsChanged = mergedIds.join("|") !== existingIds.join("|");
                const namesChanged = otherNames.join("|") !== prevNames.join("|");
                const resolvedHost = String(planHostUid || "").trim();
                const attendeeIsResolvedHost =
                  !!resolvedHost && String(attendeeId) === resolvedHost;
                const nextHost = attendeeIsResolvedHost
                  ? e.planHostUid || planHostUid || undefined
                  : resolvedHost || e.planHostUid || planHostUid || undefined;
                const hostChanged = String(nextHost || "") !== String(e?.planHostUid || "");
                const hostUidForDoc = String(nextHost || planHostUid || "").trim();
                const orderedIds =
                  isHostDoc && hostUidForDoc
                    ? [hostUidForDoc, ...mergedIds.filter((id) => id !== hostUidForDoc)]
                    : mergedIds;
                const nextJoinedFromId =
                  isHostDoc && hostUidForDoc ? hostUidForDoc : orderedIds[0] || "";
                const hadWrongJoinAnchor =
                  isHostDoc &&
                  !!String(e?.joinedFromFriendUid || "").trim() &&
                  String(e.joinedFromFriendUid).trim() !== hostUidForDoc;
                if (
                  !idsChanged &&
                  !namesChanged &&
                  !hostChanged &&
                  !hadWrongJoinAnchor &&
                  orderedIds.join("|") === mergedIds.join("|") &&
                  String(e?.joinedFromId || "") === nextJoinedFromId
                ) {
                  return e;
                }
                changed = true;
                const updated = {
                  ...e,
                  planHostUid: nextHost,
                  joinedFromIds: orderedIds,
                  joinedFromId: nextJoinedFromId,
                  joinedFromNames: otherNames,
                  joinedFromName: otherNames.join(", "),
                };
                if (isHostDoc) {
                  delete updated.joinedFromFriendUid;
                } else if (
                  resolvedHost &&
                  String(updated.joinedFromFriendUid || "").trim() === String(attendeeId)
                ) {
                  updated.joinedFromFriendUid = resolvedHost;
                }
                return updated;
              });
              if (changed) {
                await updateDoc(attendeeRef, { events: nextAttendeeEvents });
              }
            } catch {}
          })
        );
      };

      const exists = existingEvents.some((e: any) => matchesPlanEvent(e, eventForMatch, existingEvents));
      if (exists) {
        const updatedExistingEvents = existingEvents.map((e: any) => {
          if (!matchesPlanEvent(e, eventForMatch, existingEvents)) return e;
          const existingNames = Array.isArray(e?.joinedFromNames)
            ? e.joinedFromNames
            : [e?.joinedFromName].filter(Boolean);
          const mergedNames = Array.from(
            new Set([...existingNames, ...sourceNames].map((n: string) => String(n).trim()).filter(Boolean))
          );
          return {
            ...e,
            planHostUid: e.planHostUid || event.planHostUid || planHostUid,
            mergedIntoExisting: true,
            joinedFromFriendUid: friendKey,
            joinedFromIds: sourceIds,
            joinedFromId: sourceIds[0] || "",
            joinedFromNames: mergedNames,
            joinedFromName: mergedNames.join(", "),
            attendeeDisplayNames: {
              ...(e.attendeeDisplayNames || {}),
              ...displayNameById,
            },
          };
        });
        await updateDoc(meRef, { events: updatedExistingEvents });
        await syncAttendeesAcrossUsers(sourceIds);
        setJoinedKeysForEvent(event, true);
        showAlert("Updated", "They're on this plan with you.");
        return;
      }

      const newEvent = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: String(event.title || "").trim(),
        date: String(event.date || "").trim(),
        time: String(event.time || "").trim(),
        location: String(event.location || "").trim(),
        planHostUid,
        joinedFromId: friendKey,
        joinedFromIds: sourceIds,
        joinedFromName: sourceNames.join(", "),
        joinedFromNames: sourceNames,
        mergedIntoExisting: false,
        joinedFromFriendUid: friendKey,
        attendeeDisplayNames: displayNameById,
      };

      const nextEvents = [...existingEvents, newEvent].sort(
        (a: any, b: any) => eventSortValue(a) - eventSortValue(b)
      );

      await updateDoc(meRef, {
        events: nextEvents,
      });
      await syncAttendeesAcrossUsers(sourceIds);

      setJoinedKeysForEvent(event, true);
      showAlert("Added", "Plan added to your plans.");
    } catch (e: any) {
      showAlert("Error", e?.message || "Could not join this plan right now.");
    }
  };

  const planLooksJoined = (e: any) =>
    !!(joinedPlanKeys[eventKey(e)] || joinedPlanKeys[eventKeyLoose(e)]);

  const isViewerHostOfFriendsPlan = (event: any) => {
    if (!viewerId || !friendKey) return false;
    const vid = String(viewerId).trim();
    const fk = String(friendKey).trim();
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

  const handlePlanPress = (event: any) => {
    if (isViewerHostOfFriendsPlan(event)) return;
    if (planLooksJoined(event)) {
      setPendingUnjoinEvent(event);
      setShowUnjoinModal(true);
    } else {
      joinPlan(event);
    }
  };

  const unjoinPlan = async (event: any) => {
    const user = auth.currentUser;
    if (!user || !friendKey) return;
    try {
      const meRef = doc(db, "users", user.uid);
      const meSnap = await getDoc(meRef);
      const meData = meSnap.exists() ? (meSnap.data() as any) : {};
      const existingEvents = Array.isArray(meData?.events) ? meData.events : [];
      const myEvent = existingEvents.find((e: any) => matchesPlanEvent(e, event, existingEvents));
      if (!myEvent || !isInSharedPlanWithFriend(myEvent, user.uid, friendKey)) {
        showAlert("Not in this plan", "You aren't going to this plan together.");
        return;
      }

      const rawSet = new Set<string>();
      for (const id of [
        ...(Array.isArray(myEvent.joinedFromIds) ? myEvent.joinedFromIds : []),
        myEvent.joinedFromId,
      ].filter(Boolean)) {
        rawSet.add(String(id).trim());
      }
      rawSet.add(user.uid);
      rawSet.add(friendKey);
      const allAttendeeIds = Array.from(rawSet);

      const displayNameById: Record<string, string> = {};
      await Promise.all(
        allAttendeeIds.map(async (uid) => {
          try {
            const s = await getDoc(doc(db, "users", uid));
            if (s.exists()) {
              displayNameById[uid] = String((s.data() as any)?.displayName || "").trim();
            }
          } catch {}
        })
      );

      await Promise.all(
        allAttendeeIds.map(async (attendeeId) => {
          if (attendeeId === user.uid) return;
          try {
            const attendeeRef = doc(db, "users", attendeeId);
            const attendeeSnap = await getDoc(attendeeRef);
            if (!attendeeSnap.exists()) return;
            const attendeeData = attendeeSnap.data() as any;
            const attendeeEvents = Array.isArray(attendeeData?.events) ? attendeeData.events : [];
            let changed = false;
            const nextAttendeeEvents = attendeeEvents.map((e: any) => {
              if (!matchesPlanEvent(e, event, attendeeEvents)) return e;
              const existingIds = Array.isArray(e?.joinedFromIds)
                ? e.joinedFromIds
                : [e?.joinedFromId].filter(Boolean);
              const mergedIds = existingIds
                .map((id: string) => String(id).trim())
                .filter(Boolean)
                .filter((id: string) => id !== user.uid);
              const otherNames = mergedIds
                .filter((id: string) => id !== attendeeId)
                .map((id: string | number) => displayNameById[id])
                .filter(Boolean);
              const prevNames = Array.isArray(e?.joinedFromNames)
                ? e.joinedFromNames
                : [e?.joinedFromName].filter(Boolean);
              const idsChanged = mergedIds.join("|") !== existingIds.join("|");
              const namesChanged = otherNames.join("|") !== prevNames.join("|");
              if (!idsChanged && !namesChanged) return e;
              changed = true;
              return {
                ...e,
                joinedFromIds: mergedIds,
                joinedFromId: mergedIds[0] || "",
                joinedFromNames: otherNames,
                joinedFromName: otherNames.join(", "),
              };
            });
            if (changed) {
              await updateDoc(attendeeRef, { events: nextAttendeeEvents });
            }
          } catch {}
        })
      );

      const idSet = new Set(
        [...(Array.isArray(myEvent.joinedFromIds) ? myEvent.joinedFromIds : []), myEvent.joinedFromId]
          .filter(Boolean)
          .map((id: string) => String(id).trim())
      );
      const shouldDemerge =
        myEvent.mergedIntoExisting === true ||
        (myEvent.mergedIntoExisting !== false && idSet.size > 2);

      let nextEvents: any[];
      if (shouldDemerge) {
        const soloRest = { ...myEvent };
        delete soloRest.joinedFromId;
        delete soloRest.joinedFromIds;
        delete soloRest.joinedFromName;
        delete soloRest.joinedFromNames;
        delete soloRest.mergedIntoExisting;
        delete soloRest.joinedFromFriendUid;
        soloRest.planHostUid = user.uid;
        nextEvents = existingEvents.map((e: any) => (e.id === myEvent.id ? soloRest : e));
      } else {
        nextEvents = existingEvents.filter((e: any) => e.id !== myEvent.id);
      }

      await updateDoc(meRef, { events: nextEvents });

      setJoinedKeysForEvent(event, false);
      showAlert("Removed", "You're no longer going to this plan together.");
    } catch (e: any) {
      showAlert("Error", e?.message || "Could not remove this plan.");
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
                <Ionicons name="people-outline" size={14} color={MUTED2} />
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
              style={[synqOutlineAddBtn, requestSent && synqOutlineAddBtnDisabled]}
              onPress={addFriend}
              disabled={requestSent || actionLoading}
            >
              <Text
                style={[
                  synqOutlineAddBtnText,
                  requestSent && synqOutlineAddBtnTextDisabled,
                ]}
              >
                {requestSent ? "Pending" : actionLoading ? "Sending..." : "Add friend"}
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
              {mutualFriends.map((item) => {
                const scale = new Animated.Value(1);

                return (
                  <View key={item.id} style={styles.connItem}>
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPressIn={() =>
                        Animated.spring(scale, {
                          toValue: 0.92,
                          useNativeDriver: true,
                        }).start()
                      }
                      onPressOut={() =>
                        Animated.spring(scale, {
                          toValue: 1,
                          useNativeDriver: true,
                        }).start()
                      }
                      onPress={() =>
                        router.push({
                          pathname: "/friend-profile",
                          params: {
                            friendId: item.id,
                            ...(from ? { from } : {}),
                          },
                        })
                      }
                    >
                      <Animated.View
                        style={[
                          styles.imageCircle,
                          { transform: [{ scale }] },
                        ]}
                      >
                        <ExpoImage
                          source={{ uri: resolveAvatar(item.imageurl) }}
                          style={styles.connImg}
                          cachePolicy="memory-disk"
                          transition={0}
                        />
                      </Animated.View>
                    </TouchableOpacity>

                    <Text style={styles.connName} numberOfLines={1}>
                      {item.displayName?.split(" ")[0] || "User"}
                    </Text>
                  </View>
                );
              })}
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

              <MonthlyMemoReadOnly
                events={friend.events || []}
                ACCENT={ACCENT}
                fonts={fonts}
                viewerUid={viewerId}
                profileSubjectUid={friendKey}
                viewerEvents={viewerEvents}
                onPressPlan={handlePlanPress}
                isPlanJoined={planLooksJoined}
                isViewerHostOfPlan={isViewerHostOfFriendsPlan}
                hostDisplayNameByUid={hostDisplayNameByUid}
              />
            </View>
          </>
        ) : null}

        {isFriend && !userIsBlocked ? (
          <View style={styles.friendActionsWrap}>
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.removeFriendBtn}
              onPress={() => setShowRemoveModal(true)}
              disabled={removingFriend}
              accessibilityRole="button"
              accessibilityLabel="Remove friend"
            >
              <Text style={styles.removeFriendText}>Remove friend</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
      {renderStickyNav()}
      <Modal visible={showOptionsSheet} transparent animationType="fade">
        <View style={styles.optionsOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setShowOptionsSheet(false)}
          />
          <View style={styles.optionsSheetGroup}>
            <View style={styles.optionsSheet}>
              {userIsBlocked ? (
                <TouchableOpacity
                  style={styles.optionsRow}
                  onPress={async () => {
                    setShowOptionsSheet(false);
                    if (!friendKey) return;
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
                          setShowOptionsSheet(false);
                          setAddToGroupSheetVisible(true);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Add friend to group"
                      >
                        <Ionicons name="people-outline" size={22} color={TEXT} />
                        <Text style={styles.optionsRowText}>Add friend to group</Text>
                      </TouchableOpacity>
                      <View style={styles.optionsDivider} />
                    </>
                  ) : null}
                  <TouchableOpacity
                    style={styles.optionsRow}
                    onPress={() => {
                      setShowOptionsSheet(false);
                      setShowReportModal(true);
                    }}
                  >
                    <Ionicons name="flag-outline" size={22} color={TEXT} />
                    <Text style={styles.optionsRowText}>Report user</Text>
                  </TouchableOpacity>
                  <View style={styles.optionsDivider} />
                  <TouchableOpacity
                    style={styles.optionsRow}
                    onPress={() => {
                      setShowOptionsSheet(false);
                      setShowBlockModal(true);
                    }}
                  >
                    <Ionicons name="ban-outline" size={22} color={DESTRUCTIVE} />
                    <Text style={[styles.optionsRowText, styles.optionsDestructive]}>
                      Block user
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
            <TouchableOpacity
              style={styles.optionsCancel}
              onPress={() => setShowOptionsSheet(false)}
            >
              <Text style={styles.optionsCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
        title="Remove Friend"
        message={`Are you sure you want to remove ${friend.displayName} as a friend?`}
        confirmText="Remove"
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
          <ActivityIndicator color={ACCENT} size="large" />
          <Text style={styles.removingText}>Removing friend…</Text>
        </View>
      ) : null}
      <ConfirmModal
        visible={showUnjoinModal}
        title="Remove this plan?"
        message="This removes it from your plans and updates this for your friend."
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
    alignSelf: "center",
    minHeight: 44,
    paddingHorizontal: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DESTRUCTIVE_BORDER_STRONG,
    borderRadius: BUTTON_RADIUS,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
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
    backgroundColor: SURFACE_LIFTED,
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

  optionsOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: OVERLAY_HEAVY,
  },
  optionsSheetGroup: {
    paddingBottom: 34,
  },
  optionsSheet: {
    backgroundColor: BG,
    borderTopLeftRadius: MODAL_RADIUS,
    borderTopRightRadius: MODAL_RADIUS,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: GROUP_BORDER,
    overflow: "hidden",
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
    backgroundColor: SURFACE,
    marginLeft: 54,
  },
  optionsCancel: {
    marginTop: 10,
    marginHorizontal: 12,
    backgroundColor: PROFILE_SURFACE,
    borderRadius: RADIUS_MD,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PROFILE_BORDER,
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
    fontFamily: fonts.heavy,
    fontSize: TYPE_BUTTON,
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