import CloseIcon from "@/src/components/CloseIcon";
import { ListRowsSkeleton } from "@/src/components/loading/BrandSkeletons";
import StackScreenHeader from "@/src/components/StackScreenHeader";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image as ExpoImage } from "expo-image";
import { router } from "expo-router";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ACCENT,
  BG,
  BORDER_MUTED,
  BORDER_STRONG,
  BORDER_SUBTLE_HEX,
  emptyStateTitleText,
  fonts,
  MUTED,
  MUTED2,
  MUTED3,
  RADIUS_2XL,
  RADIUS_LG,
  SPACE_3,
  SPACE_4,
  SPACE_5,
  SPACE_6,
  SURFACE,
  TEXT,
  TYPE_BODY,
  TYPE_BUTTON,
  TYPE_CAPTION,
} from "../constants/Variables";
import {
  GROUP_BORDER,
  GROUP_SURFACE,
} from "@/src/components/friends/groupsListStyles";
import {
  acceptCommunityGroupInvite,
  declineCommunityGroupInvite,
  type CommunityGroupInvite,
} from "../src/lib/communityGroupInvites";
import { auth, db } from "../src/lib/firebase";
import { acceptPlanInvite, acceptPlanInviteErrorMessage, declinePlanInvite, declinePlanInviteErrorMessage } from "../src/lib/planInvite";

import { resolveAvatar } from "@/src/lib/helpers";
import {
  FRIEND_REQUESTS_LISTENER_LIMIT,
  GROUP_INVITES_LISTENER_LIMIT,
  LEGACY_NOTIFICATION_LOCKS_LIMIT,
  NOTIFICATIONS_LISTENER_LIMIT,
} from "@/src/lib/listenerLimits";
import AlertModal from "./alert-modal";
import ConfirmModal from "./confirm-modal";

const BACKGROUND = BG;

type ActivityFeedKind =
  | "friend_accepted"
  | "open_plan_interest"
  | "community_plan_join"
  | "community_post_approval"
  | "community_post_approved"
  | "community_post_rejected"
  | "friend_synq_active"
  | "synq_nudge";

type ActivityFeedSource = "notifications" | "legacy";

type FriendRequestFeedItem = {
  feedKey: string;
  kind: "friend_request";
  id: string;
  fromUserId: string;
  actorName: string;
  actorImageUrl: string | null;
  sortMs: number;
  raw: Record<string, unknown>;
};

type PlanInviteFeedItem = {
  feedKey: string;
  kind: "plan_invite";
  id: string;
  source: ActivityFeedSource;
  fromUserId: string | null;
  actorName: string;
  actorImageUrl: string | null;
  title: string;
  body: string;
  planTitle?: string | null;
  sortMs: number;
  read: boolean;
  eventId?: string | null;
  planHostUid?: string | null;
  raw: Record<string, unknown>;
};

type StandardActivityFeedItem = {
  feedKey: string;
  kind: ActivityFeedKind;
  id: string;
  source: ActivityFeedSource;
  fromUserId: string | null;
  actorName: string;
  actorImageUrl: string | null;
  title: string;
  body: string;
  planTitle?: string | null;
  sortMs: number;
  read: boolean;
  eventId?: string | null;
  planHostUid?: string | null;
  groupId?: string | null;
  planId?: string | null;
  groupName?: string | null;
  raw: Record<string, unknown>;
};

type CommunityGroupInviteFeedItem = {
  feedKey: string;
  kind: "community_group_invite";
  id: string;
  groupId: string;
  groupName: string;
  fromUserId: string;
  actorName: string;
  actorImageUrl: string | null;
  sortMs: number;
  raw: CommunityGroupInvite;
};

type FeedItem =
  | FriendRequestFeedItem
  | PlanInviteFeedItem
  | CommunityGroupInviteFeedItem
  | StandardActivityFeedItem;

type LegacyNotificationLockRow = {
  id: string;
  type?: string;
  from?: string;
  joinerId?: string;
  planTitle?: string | null;
  createdAt?: unknown;
};

function timestampMillis(v: unknown): number {
  if (!v) return 0;
  const t = v as { toMillis?: () => number; seconds?: number };
  if (typeof t.toMillis === "function") return t.toMillis();
  if (typeof t.seconds === "number") return t.seconds * 1000;
  return 0;
}

type ActorProfile = { actorName: string; actorImageUrl: string | null };
type ActorCache = Map<string, ActorProfile>;
type ActorFallback = { name?: string; image?: string | null };
const actorFetchInflight = new Map<string, Promise<ActorProfile>>();

async function fetchActorProfile(
  userId: string,
  fallback: ActorFallback
): Promise<ActorProfile> {
  const existing = actorFetchInflight.get(userId);
  if (existing) return existing;

  const promise = (async () => {
    let actorName = fallback.name || "Someone";
    let actorImageUrl = fallback.image || null;
    try {
      const senderSnap = await getDoc(doc(db, "users", userId));
      if (senderSnap.exists()) {
        const senderData = senderSnap.data() as Record<string, unknown>;
        actorName = (senderData?.displayName as string) || actorName;
        actorImageUrl = (senderData?.imageurl as string) || actorImageUrl;
      }
    } catch {}
    return { actorName, actorImageUrl };
  })();

  actorFetchInflight.set(userId, promise);
  try {
    return await promise;
  } finally {
    if (actorFetchInflight.get(userId) === promise) {
      actorFetchInflight.delete(userId);
    }
  }
}

async function prefetchActors(
  cache: ActorCache,
  userIds: Array<string | null | undefined>,
  fallbacks = new Map<string, ActorFallback>()
): Promise<void> {
  const missing = new Set<string>();
  for (const id of userIds) {
    const uid = id ? String(id).trim() : "";
    if (!uid || cache.has(uid)) continue;
    missing.add(uid);
  }
  if (missing.size === 0) return;

  await Promise.all(
    [...missing].map(async (userId) => {
      const profile = await fetchActorProfile(userId, fallbacks.get(userId) ?? {});
      cache.set(userId, profile);
    })
  );
}

function lookupActor(
  cache: ActorCache,
  userId: string | null | undefined,
  fallbackName?: string,
  fallbackImage?: string | null
): ActorProfile {
  const uid = userId ? String(userId).trim() : "";
  if (!uid) {
    return { actorName: fallbackName || "Someone", actorImageUrl: fallbackImage || null };
  }
  return (
    cache.get(uid) ?? {
      actorName: fallbackName || "Someone",
      actorImageUrl: fallbackImage || null,
    }
  );
}

function friendRequestActorFallback(
  request: Record<string, unknown> & { id: string }
): { userId: string; fallback: ActorFallback } {
  const userId = String(request.from || request.fromId || request.id || "");
  return {
    userId,
    fallback: {
      name:
        (request.senderName as string) ||
        (request.fromName as string) ||
        undefined,
      image:
        (request.senderImageUrl as string) ||
        (request.fromImageUrl as string) ||
        (request.fromImageurl as string) ||
        (request.imageurl as string) ||
        null,
    },
  };
}

function mapFriendRequest(
  request: Record<string, unknown> & { id: string },
  cache: ActorCache
) {
  const { userId, fallback } = friendRequestActorFallback(request);
  const { actorName, actorImageUrl } = lookupActor(
    cache,
    userId,
    fallback.name,
    fallback.image
  );

  return {
    ...request,
    fromUserId: userId,
    actorName,
    actorImageUrl,
    sortMs: timestampMillis(request.sentAt) || Date.now(),
  };
}

function mapCommunityGroupInvite(invite: CommunityGroupInvite, cache: ActorCache) {
  const { actorName, actorImageUrl } = lookupActor(
    cache,
    invite.fromUserId,
    invite.fromUserName,
    invite.fromUserImageUrl || null
  );

  return {
    ...invite,
    actorName,
    actorImageUrl,
    sortMs: timestampMillis(invite.createdAt) || Date.now(),
  };
}

function mapActivity(item: Record<string, unknown> & { id: string }, cache: ActorCache) {
  const fromUserId = item.fromUserId ? String(item.fromUserId) : null;
  const { actorName, actorImageUrl } = lookupActor(cache, fromUserId);
  const type = String(item.type || "") as PlanInviteFeedItem["kind"] | ActivityFeedKind;
  const planTitle = String(item.planTitle || "").trim();
  const groupName = String(item.groupName || "").trim();
  const title = String(item.title || "").trim();
  const name = displayPersonName(actorName);
  const parts = activityMessageParts(
    type,
    type === "community_post_approval" ||
    type === "community_post_approved" ||
    type === "community_post_rejected"
      ? groupName || planTitle
      : planTitle
  );
  const body = stripTrailingPeriod(
    `${name}${parts.rest}${parts.emphasis || ""}`
  );

  return {
    ...item,
    type,
    fromUserId,
    actorName: name,
    actorImageUrl,
    planTitle: planTitle || null,
    title:
      normalizeNotificationTitle(title) ||
      (type === "friend_accepted"
        ? "Request accepted"
          : type === "open_plan_interest"
          ? "Plan update"
          : type === "plan_invite"
            ? "Plan invite"
          : type === "community_plan_join"
            ? "Community plan"
          : type === "community_post_approval"
            ? "Please review a post"
          : type === "community_post_approved"
            ? "Post approved"
          : type === "community_post_rejected"
            ? "Post not approved"
          : type === "synq_nudge"
            ? "Are you free?"
            : "Friend active on Synq"),
    body,
    sortMs: timestampMillis(item.createdAt) || Date.now(),
    read: item.read === true,
    eventId: item.eventId ? String(item.eventId) : null,
    planHostUid: item.planHostUid ? String(item.planHostUid) : null,
    groupId: item.groupId ? String(item.groupId) : null,
    planId: item.planId ? String(item.planId) : null,
    groupName: item.groupName ? String(item.groupName) : null,
  };
}

function collectActorPrefetch(
  friendRequests: Array<Record<string, unknown> & { id: string }>,
  groupInvites: CommunityGroupInvite[],
  activityList: Array<Record<string, unknown> & { id: string }>
) {
  const userIds: string[] = [];
  const fallbacks = new Map<string, ActorFallback>();

  for (const request of friendRequests) {
    const { userId, fallback } = friendRequestActorFallback(request);
    userIds.push(userId);
    if (userId) fallbacks.set(userId, fallback);
  }

  for (const invite of groupInvites) {
    userIds.push(invite.fromUserId);
    fallbacks.set(invite.fromUserId, {
      name: invite.fromUserName,
      image: invite.fromUserImageUrl || null,
    });
  }

  for (const item of activityList) {
    if (item.fromUserId) userIds.push(String(item.fromUserId));
  }

  return { userIds, fallbacks };
}

function parseCommunityGroupInviteDoc(
  id: string,
  data: Record<string, unknown>
): CommunityGroupInvite {
  return {
    id,
    groupId: String(data.groupId || id).trim(),
    groupName: String(data.groupName || "").trim() || "Group",
    fromUserId: String(data.fromUserId || "").trim(),
    fromUserName: String(data.fromUserName || "").trim() || "Friend",
    fromUserImageUrl: data.fromUserImageUrl ? String(data.fromUserImageUrl) : undefined,
    createdAt: data.createdAt,
  };
}

function displayPersonName(name: string): string {
  return String(name || "").trim() || "Someone";
}

/** Drop trailing sentence periods from notification copy. */
function stripTrailingPeriod(text: string): string {
  return String(text || "").replace(/\.+$/u, "").trimEnd();
}

/** Normalize known Title Case notification titles to sentence case. */
function normalizeNotificationTitle(title: string): string {
  const trimmed = String(title || "").trim();
  if (!trimmed) return "";
  const known: Record<string, string> = {
    "Request Accepted! ✨": "Request accepted! ✨",
    "Request Accepted!": "Request accepted!",
    "New Friend Request 🤝": "New Synq request",
    "New Friend Request": "New Synq request",
    "New friend request 🤝": "New Synq request",
    "New friend request": "New Synq request",
    "New Synq Request": "New Synq request",
    "New Message": "New message",
  };
  return known[trimmed] || trimmed;
}

function activityMessageParts(
  kind: PlanInviteFeedItem["kind"] | ActivityFeedKind,
  planTitle?: string | null
): { rest: string; emphasis?: string } {
  const title = String(planTitle || "").trim();
  switch (kind) {
    case "friend_accepted":
      return { rest: " added you on Synq" };
    case "open_plan_interest":
      return title
        ? { rest: ` is going to your plan ${title}` }
        : { rest: " is going to your plan" };
    case "plan_invite":
      return title
        ? { rest: " wants you to join ", emphasis: title }
        : { rest: " wants you to join their plan" };
    case "community_plan_join":
      return title
        ? { rest: " is in for ", emphasis: title }
        : { rest: " joined a community plan" };
    case "community_post_approval":
      return title
        ? { rest: " — please review a post in ", emphasis: title }
        : { rest: " — please review a post" };
    case "community_post_approved":
      return title
        ? { rest: ` — your post is live in `, emphasis: title }
        : { rest: " — your post was approved" };
    case "community_post_rejected":
      return title
        ? { rest: " — your post was not approved for ", emphasis: title }
        : { rest: " — your post was not approved" };
    case "friend_synq_active":
      return { rest: " is free" };
    case "synq_nudge":
      return { rest: " wants to know if you're free right now" };
    default:
      return { rest: "" };
  }
}

function NotificationMessage({
  name,
  rest,
  emphasis,
}: {
  name: string;
  rest: string;
  emphasis?: string;
}) {
  return (
    <Text style={styles.rowText}>
      <Text style={styles.nameBold}>{displayPersonName(name)}</Text>
      {rest ? <Text style={styles.messageRest}>{rest}</Text> : null}
      {emphasis ? <Text style={styles.emphasisText}>{emphasis}</Text> : null}
    </Text>
  );
}

/** Cloud Functions mirror many notifications in both collections (same doc id). */
function activityDeleteRefs(userId: string, notificationId: string) {
  return [
    doc(db, "users", userId, "notifications", notificationId),
    doc(db, "users", userId, "notificationLocks", notificationId),
  ];
}

function NotificationsEmptyState() {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconRing}>
        <Ionicons name="notifications-off-outline" size={34} color={MUTED2} />
      </View>
      <Text style={styles.emptyHeadline}>No notifications</Text>
      <Text style={styles.emptyHelper}>
        Friend requests, community invites, and activity from your friends will appear here.
      </Text>
    </View>
  );
}

export default function NotificationsScreen() {
  const { height: windowHeight } = useWindowDimensions();
  const [friendRequests, setFriendRequests] = useState<any[]>([]);
  const [communityGroupInvites, setCommunityGroupInvites] = useState<CommunityGroupInvite[]>([]);
  const [activityItems, setActivityItems] = useState<any[]>([]);
  const [legacyActivityItems, setLegacyActivityItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [dismissingKeys, setDismissingKeys] = useState<Set<string>>(() => new Set());
  const [clearingAll, setClearingAll] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const actorCacheRef = useRef<ActorCache>(new Map());

  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    title?: string;
    message: string;
  } | null>(null);

  const showAlert = (title: string, message: string) => {
    setAlertConfig({ title, message });
    setAlertVisible(true);
  };

  const finishInitialLoad = useCallback(() => {
    setLoading(false);
  }, []);

  const hydrateFriendRequests = useCallback(
    async (reqList: Array<Record<string, unknown> & { id: string }>) => {
      const cache = actorCacheRef.current;
      setFriendRequests(reqList.map((request) => mapFriendRequest(request, cache)));
      finishInitialLoad();

      const { userIds, fallbacks } = collectActorPrefetch(reqList, [], []);
      await prefetchActors(cache, userIds, fallbacks);
      setFriendRequests(reqList.map((request) => mapFriendRequest(request, cache)));
    },
    [finishInitialLoad]
  );

  const hydrateCommunityGroupInvites = useCallback(
    async (list: CommunityGroupInvite[]) => {
      const cache = actorCacheRef.current;
      setCommunityGroupInvites(list.map((invite) => mapCommunityGroupInvite(invite, cache)));
      finishInitialLoad();

      const { userIds, fallbacks } = collectActorPrefetch([], list, []);
      await prefetchActors(cache, userIds, fallbacks);
      setCommunityGroupInvites(list.map((invite) => mapCommunityGroupInvite(invite, cache)));
    },
    [finishInitialLoad]
  );

  const hydrateActivityItems = useCallback(
    async (list: Array<Record<string, unknown> & { id: string }>) => {
      const cache = actorCacheRef.current;
      setActivityItems(list.map((item) => mapActivity(item, cache)));
      finishInitialLoad();

      const { userIds, fallbacks } = collectActorPrefetch([], [], list);
      await prefetchActors(cache, userIds, fallbacks);
      setActivityItems(list.map((item) => mapActivity(item, cache)));
    },
    [finishInitialLoad]
  );

  const hydrateLegacyActivityItems = useCallback(
    async (rows: LegacyNotificationLockRow[]) => {
      const cache = actorCacheRef.current;
      const mapped = rows.map((row) =>
        mapActivity(
          {
            id: row.id,
            type: row.type,
            fromUserId: row.from || row.joinerId || null,
            planTitle: row.planTitle || null,
            createdAt: row.createdAt,
            read: true,
          },
          cache
        )
      );
      setLegacyActivityItems(mapped);
      finishInitialLoad();

      const activityRows = rows.map((row) => ({
        id: row.id,
        fromUserId: row.from || row.joinerId || null,
      }));
      const { userIds, fallbacks } = collectActorPrefetch([], [], activityRows);
      await prefetchActors(cache, userIds, fallbacks);
      setLegacyActivityItems(
        rows.map((row) =>
          mapActivity(
            {
              id: row.id,
              type: row.type,
              fromUserId: row.from || row.joinerId || null,
              planTitle: row.planTitle || null,
              createdAt: row.createdAt,
              read: true,
            },
            cache
          )
        )
      );
    },
    [finishInitialLoad]
  );

  const fetchAll = async () => {
    if (!auth.currentUser) return;
    const myId = auth.currentUser.uid;
    const cache = actorCacheRef.current;

    const [reqSnap, groupInviteSnap, activitySnap, legacySnap] = await Promise.all([
      getDocs(
        query(
          collection(db, "users", myId, "friendRequests"),
          limit(FRIEND_REQUESTS_LISTENER_LIMIT)
        )
      ),
      getDocs(
        query(
          collection(db, "users", myId, "communityGroupInvites"),
          limit(GROUP_INVITES_LISTENER_LIMIT)
        )
      ),
      getDocs(
        query(
          collection(db, "users", myId, "notifications"),
          orderBy("createdAt", "desc"),
          limit(NOTIFICATIONS_LISTENER_LIMIT)
        )
      ),
      getDocs(
        query(
          collection(db, "users", myId, "notificationLocks"),
          limit(LEGACY_NOTIFICATION_LOCKS_LIMIT)
        )
      ),
    ]);

    const reqList = reqSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const activityList = activitySnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const legacyList = legacySnap.docs
      .map((d) => ({ id: d.id, ...d.data() } as LegacyNotificationLockRow))
      .filter((row) =>
        ["friend_accepted", "open_plan_interest", "plan_invite", "community_plan_join", "community_post_approval", "community_post_approved", "community_post_rejected"].includes(
          String(row.type || "")
        )
      );
    const groupInviteList = groupInviteSnap.docs.map((d) =>
      parseCommunityGroupInviteDoc(d.id, d.data() as Record<string, unknown>)
    );

    const { userIds, fallbacks } = collectActorPrefetch(
      reqList,
      groupInviteList,
      activityList
    );
    legacyList.forEach((row) => {
      const fromUserId = row.from || row.joinerId || null;
      if (fromUserId) userIds.push(String(fromUserId));
    });
    await prefetchActors(cache, userIds, fallbacks);

    setFriendRequests(reqList.map((request) => mapFriendRequest(request, cache)));
    setCommunityGroupInvites(
      groupInviteList.map((invite) => mapCommunityGroupInvite(invite, cache))
    );
    setActivityItems(activityList.map((item) => mapActivity(item, cache)));
    setLegacyActivityItems(
      legacyList.map((row) =>
        mapActivity(
          {
            id: row.id,
            type: row.type,
            fromUserId: row.from || row.joinerId || null,
            planTitle: row.planTitle || null,
            createdAt: row.createdAt,
            read: true,
          },
          cache
        )
      )
    );
    setLoadError(false);
    finishInitialLoad();
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  };

  useEffect(() => {
    if (!auth.currentUser) {
      setLoading(false);
      return;
    }
    const myId = auth.currentUser.uid;

    const reqRef = query(
      collection(db, "users", myId, "friendRequests"),
      limit(FRIEND_REQUESTS_LISTENER_LIMIT)
    );
    const groupInviteRef = query(
      collection(db, "users", myId, "communityGroupInvites"),
      limit(GROUP_INVITES_LISTENER_LIMIT)
    );
    const activityRef = query(
      collection(db, "users", myId, "notifications"),
      orderBy("createdAt", "desc"),
      limit(NOTIFICATIONS_LISTENER_LIMIT)
    );
    const legacyRef = query(
      collection(db, "users", myId, "notificationLocks"),
      limit(LEGACY_NOTIFICATION_LOCKS_LIMIT)
    );

    const unsubReq = onSnapshot(
      reqRef,
      (snapshot) => {
        const reqList = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        void hydrateFriendRequests(reqList);
        setLoadError(false);
      },
      (error) => {
        console.error("friendRequests snapshot:", error);
        setLoadError(true);
        finishInitialLoad();
      }
    );

    const unsubGroupInvites = onSnapshot(
      groupInviteRef,
      (snapshot) => {
        const list = snapshot.docs.map((d) =>
          parseCommunityGroupInviteDoc(d.id, d.data() as Record<string, unknown>)
        );
        void hydrateCommunityGroupInvites(list);
        setLoadError(false);
      },
      (error) => {
        console.error("communityGroupInvites snapshot:", error);
        setLoadError(true);
        finishInitialLoad();
      }
    );

    const unsubActivity = onSnapshot(
      activityRef,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        void hydrateActivityItems(list);
        setLoadError(false);
      },
      (error) => {
        console.error("notifications snapshot:", error);
        setLoadError(true);
        finishInitialLoad();
      }
    );

    const unsubLegacy = onSnapshot(
      legacyRef,
      (snapshot) => {
        const list = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() } as LegacyNotificationLockRow))
          .filter((row) =>
            ["friend_accepted", "open_plan_interest", "plan_invite", "community_plan_join", "community_post_approval", "community_post_approved", "community_post_rejected"].includes(
              String(row.type || "")
            )
          );
        void hydrateLegacyActivityItems(list);
      },
      () => {
        finishInitialLoad();
      }
    );

    return () => {
      unsubReq();
      unsubGroupInvites();
      unsubActivity();
      unsubLegacy();
    };
  }, [
    finishInitialLoad,
    hydrateActivityItems,
    hydrateCommunityGroupInvites,
    hydrateFriendRequests,
    hydrateLegacyActivityItems,
  ]);

  const feedItems: FeedItem[] = useMemo(() => {
    const requests: FeedItem[] = friendRequests.map((r) => ({
      feedKey: `req_${r.id}`,
      kind: "friend_request" as const,
      id: r.id,
      fromUserId: r.fromUserId,
      actorName: r.actorName,
      actorImageUrl: r.actorImageUrl,
      sortMs: r.sortMs,
      raw: r,
    }));

    const groupInvites: FeedItem[] = communityGroupInvites.map((invite) => {
      const resolved = invite as CommunityGroupInvite & {
        actorName?: string;
        actorImageUrl?: string | null;
        sortMs?: number;
      };
      return {
        feedKey: `cgi_${invite.id}`,
        kind: "community_group_invite" as const,
        id: invite.id,
        groupId: invite.groupId,
        groupName: invite.groupName,
        fromUserId: invite.fromUserId,
        actorName: resolved.actorName || invite.fromUserName,
        actorImageUrl: resolved.actorImageUrl ?? invite.fromUserImageUrl ?? null,
        sortMs: resolved.sortMs || timestampMillis(invite.createdAt) || Date.now(),
        raw: invite,
      };
    });

    const activityIds = new Set(activityItems.map((a) => a.id));
    const mergedActivity = [
      ...activityItems,
      ...legacyActivityItems.filter((a) => !activityIds.has(a.id)),
    ];

    const activity: FeedItem[] = mergedActivity
      .filter((a) =>
        [
          "friend_accepted",
          "open_plan_interest",
          "plan_invite",
          "community_plan_join",
          "community_post_approval",
          "community_post_approved",
          "community_post_rejected",
          "friend_synq_active",
          "synq_nudge",
        ].includes(a.type)
      )
      .map((a) => {
        const source: ActivityFeedSource = activityIds.has(a.id)
          ? "notifications"
          : "legacy";
        const base = {
          feedKey: `act_${a.id}`,
          id: a.id,
          source,
          fromUserId: a.fromUserId,
          actorName: a.actorName,
          actorImageUrl: a.actorImageUrl,
          title: a.title,
          body: a.body,
          planTitle: a.planTitle,
          sortMs: a.sortMs,
          read: a.read,
          eventId: a.eventId,
          planHostUid: a.planHostUid,
          groupId: a.groupId,
          planId: a.planId,
          groupName: a.groupName,
          raw: a,
        };

        if (a.type === "plan_invite") {
          return { ...base, kind: "plan_invite" as const };
        }

        return { ...base, kind: a.type as ActivityFeedKind };
      });

    return [...requests, ...groupInvites, ...activity].sort((a, b) => b.sortMs - a.sortMs);
  }, [friendRequests, communityGroupInvites, activityItems, legacyActivityItems]);

  const clearAll = async () => {
    if (!auth.currentUser || clearingAll || feedItems.length === 0) return;

    const myId = auth.currentUser.uid;
    setClearingAll(true);
    setShowClearConfirm(false);

    const refByPath = new Map<string, ReturnType<typeof doc>>();
    for (const item of feedItems) {
      if (item.kind === "friend_request") {
        const ref = doc(db, "users", myId, "friendRequests", item.id);
        refByPath.set(ref.path, ref);
      } else if (item.kind === "community_group_invite") {
        const ref = doc(db, "users", myId, "communityGroupInvites", item.id);
        refByPath.set(ref.path, ref);
      } else {
        for (const ref of activityDeleteRefs(myId, item.id)) {
          refByPath.set(ref.path, ref);
        }
      }
    }
    const refs = Array.from(refByPath.values());

    const BATCH_LIMIT = 450;
    try {
      for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
        const batch = writeBatch(db);
        refs.slice(i, i + BATCH_LIMIT).forEach((ref) => batch.delete(ref));
        await batch.commit();
      }
    } catch {
      showAlert("Error", "Could not clear notifications. Please try again.");
    } finally {
      setClearingAll(false);
    }
  };

  const dismissActivity = async (item: PlanInviteFeedItem | StandardActivityFeedItem) => {
    if (!auth.currentUser || dismissingKeys.has(item.feedKey)) return;

    const myId = auth.currentUser.uid;
    setDismissingKeys((prev) => new Set(prev).add(item.feedKey));

    try {
      const batch = writeBatch(db);
      activityDeleteRefs(myId, item.id).forEach((ref) => batch.delete(ref));
      await batch.commit();
    } catch {
      showAlert("Error", "Could not dismiss notification. Please try again.");
    } finally {
      setDismissingKeys((prev) => {
        const next = new Set(prev);
        next.delete(item.feedKey);
        return next;
      });
    }
  };

  const handleRequest = async (request: Record<string, unknown> & { id: string }, accept: boolean) => {
    if (!auth.currentUser) return;

    try {
      const myId = auth.currentUser.uid;
      const senderId = String(request.from || request.fromId || "");

      if (!senderId) throw new Error("Missing sender ID.");

      if (accept) {
        const meSnap = await getDoc(doc(db, "users", myId));
        const meData = meSnap.exists() ? meSnap.data() : {};

        const myName =
          (meData as Record<string, unknown>)?.displayName ||
          auth.currentUser.displayName ||
          "User";

        const myImageUrl = resolveAvatar((meData as Record<string, unknown>)?.imageurl);

        let senderName =
          (request.senderName as string) ||
          (request.fromName as string) ||
          "User";

        let senderImageUrl =
          (request.senderImageUrl as string) ||
          (request.fromImageUrl as string) ||
          (request.fromImageurl as string) ||
          (request.imageurl as string) ||
          null;

        if (!senderImageUrl || !senderName) {
          const senderSnap = await getDoc(doc(db, "users", senderId));
          if (senderSnap.exists()) {
            const senderData = senderSnap.data() as Record<string, unknown>;
            senderName =
              senderName ||
              (senderData?.displayName as string) ||
              "User";
            senderImageUrl =
              senderImageUrl ||
              resolveAvatar(senderData?.imageurl);
          }
        }

        const batch = writeBatch(db);

        batch.set(doc(db, "users", myId, "friends", senderId), {
          synqCount: 0,
          since: serverTimestamp(),
          displayName: senderName,
          imageurl: resolveAvatar(senderImageUrl),
          notifyOnCreate: true,
        });

        batch.set(doc(db, "users", senderId, "friends", myId), {
          synqCount: 0,
          since: serverTimestamp(),
          displayName: myName,
          imageurl: myImageUrl,
        });

        batch.delete(doc(db, "users", myId, "friendRequests", request.id));
        batch.delete(doc(db, "users", myId, "outgoingFriendRequests", senderId));
        batch.delete(doc(db, "users", senderId, "outgoingFriendRequests", myId));

        await batch.commit();

        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        await deleteDoc(doc(db, "users", senderId, "friendRequests", myId)).catch(
          () => {}
        );

        showAlert("Success", `You are now connected with ${senderName}!`);
      } else {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await deleteDoc(doc(db, "users", myId, "friendRequests", request.id));
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      showAlert("Error", `Could not process request: ${message}`);
    }
  };

  const handleCommunityGroupInvite = async (
    item: CommunityGroupInviteFeedItem,
    accept: boolean
  ) => {
    if (!auth.currentUser || dismissingKeys.has(item.feedKey)) return;

    const myId = auth.currentUser.uid;
    setDismissingKeys((prev) => new Set(prev).add(item.feedKey));
    setCommunityGroupInvites((prev) => prev.filter((invite) => invite.groupId !== item.groupId));

    try {
      if (accept) {
        await acceptCommunityGroupInvite(myId, item.raw);
        showAlert("Joined", `You joined ${item.groupName}.`);
        router.push({
          pathname: "/community-group/[id]",
          params: { id: item.groupId },
        });
      } else {
        await declineCommunityGroupInvite(myId, item.groupId);
      }
    } catch (e: unknown) {
      setCommunityGroupInvites((prev) => {
        const exists = prev.some((invite) => invite.groupId === item.groupId);
        if (exists) return prev;
        return [...prev, item.raw];
      });
      showAlert("Error", e instanceof Error ? e.message : "Could not process invite.");
    } finally {
      setDismissingKeys((prev) => {
        const next = new Set(prev);
        next.delete(item.feedKey);
        return next;
      });
    }
  };

  const handlePlanInvite = async (item: PlanInviteFeedItem, accept: boolean) => {
    if (!auth.currentUser || dismissingKeys.has(item.feedKey)) return;

    if (!accept) {
      setDismissingKeys((prev) => new Set(prev).add(item.feedKey));
      try {
        await declinePlanInvite(item.id);
      } catch (err) {
        showAlert("Error", declinePlanInviteErrorMessage(err));
        return;
      } finally {
        setDismissingKeys((prev) => {
          const next = new Set(prev);
          next.delete(item.feedKey);
          return next;
        });
      }
      await dismissActivity(item);
      return;
    }

    setDismissingKeys((prev) => new Set(prev).add(item.feedKey));
    try {
      const { status } = await acceptPlanInvite(item.id);
      await dismissActivity(item);
      if (status === "already_joined") {
        showAlert("Already added", "This plan is already in your plans.");
      } else {
        showAlert("Added", "Plan added to your plans.");
      }
      router.push("/(tabs)/me");
    } catch (err) {
      showAlert("Error", acceptPlanInviteErrorMessage(err));
    } finally {
      setDismissingKeys((prev) => {
        const next = new Set(prev);
        next.delete(item.feedKey);
        return next;
      });
    }
  };

  const handleActivityPress = useCallback(async (item: FeedItem) => {
    if (
      item.kind === "friend_request" ||
      item.kind === "plan_invite" ||
      item.kind === "community_group_invite"
    ) {
      return;
    }

    if (item.kind === "friend_synq_active" || item.kind === "synq_nudge") {
      void dismissActivity(item);
      router.push("/(tabs)");
      return;
    }

    void dismissActivity(item);

    if (item.kind === "friend_accepted" && item.fromUserId) {
      router.push({
        pathname: "/friend-profile",
        params: { friendId: item.fromUserId },
      });
      return;
    }

    if (item.kind === "open_plan_interest") {
      if (item.eventId) {
        router.push(
          `/(tabs)/me?focusEventId=${encodeURIComponent(item.eventId)}`
        );
      } else {
        router.push("/(tabs)/me");
      }
      return;
    }

    if (item.kind === "community_plan_join" && item.groupId) {
      router.push({
        pathname: "/community-group/[id]",
        params: {
          id: item.groupId,
          ...(item.planId ? { planId: item.planId } : {}),
        },
      });
      return;
    }

    if (
      (item.kind === "community_post_approval" ||
        item.kind === "community_post_approved" ||
        item.kind === "community_post_rejected") &&
      item.groupId
    ) {
      router.push({
        pathname: "/community-group/[id]",
        params: { id: item.groupId },
      });
    }
  }, []);

  const FriendRequestRow = ({ item }: { item: Extract<FeedItem, { kind: "friend_request" }> }) => {
    const avatarUri = resolveAvatar(item.actorImageUrl);

    return (
      <View style={styles.row}>
        <View style={styles.rowLeft}>
          <View style={styles.avatar}>
            <ExpoImage
              source={{ uri: avatarUri }}
              style={styles.avatarImg}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={0}
              recyclingKey={avatarUri}
              priority="high"
            />
          </View>

          <View style={{ flex: 1 }}>
            <NotificationMessage
              name={item.actorName}
              rest=" wants to Synq with you"
            />
          </View>
        </View>

        <View style={styles.rowRight}>
          <TouchableOpacity
            onPress={() => handleRequest(item.raw as Record<string, unknown> & { id: string }, true)}
            style={styles.acceptBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Accept friend request"
          >
            <Ionicons name="checkmark" size={18} color="black" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleRequest(item.raw as Record<string, unknown> & { id: string }, false)}
            style={styles.dismissBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Decline friend request"
          >
            <CloseIcon size={20} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const CommunityGroupInviteRow = ({ item }: { item: CommunityGroupInviteFeedItem }) => {
    const avatarUri = resolveAvatar(item.actorImageUrl);
    const isDismissing = dismissingKeys.has(item.feedKey);
    const groupLabel = item.groupName.trim() || "a community group";

    return (
      <View style={styles.row}>
        <View style={styles.rowLeft}>
          <View style={styles.avatar}>
            <ExpoImage
              source={{ uri: avatarUri }}
              style={styles.avatarImg}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={0}
              recyclingKey={avatarUri}
              priority="high"
            />
          </View>

          <View style={{ flex: 1 }}>
            <NotificationMessage
              name={item.actorName}
              rest=" invited you to join "
              emphasis={groupLabel}
            />
          </View>
        </View>

        <View style={styles.rowRight}>
          <TouchableOpacity
            onPress={() => void handleCommunityGroupInvite(item, true)}
            style={styles.acceptBtn}
            disabled={isDismissing}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Accept group invite"
          >
            {isDismissing ? (
              <Ionicons name="checkmark" size={18} color="black" style={{ opacity: 0.5 }} />
            ) : (
              <Ionicons name="checkmark" size={18} color="black" />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => void handleCommunityGroupInvite(item, false)}
            style={styles.dismissBtn}
            disabled={isDismissing}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Decline group invite"
          >
            <CloseIcon size={20} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const PlanInviteRow = ({ item }: { item: PlanInviteFeedItem }) => {
    const avatarUri = resolveAvatar(item.actorImageUrl);
    const isDismissing = dismissingKeys.has(item.feedKey);

    return (
      <View style={styles.row}>
        <View style={styles.rowLeft}>
          <View style={styles.avatar}>
            <ExpoImage
              source={{ uri: avatarUri }}
              style={styles.avatarImg}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={0}
              recyclingKey={avatarUri}
              priority="high"
            />
          </View>

          <View style={{ flex: 1 }}>
            <NotificationMessage
              name={item.actorName}
              {...activityMessageParts(item.kind, item.planTitle)}
            />
          </View>
        </View>

        <View style={styles.rowRight}>
          <TouchableOpacity
            onPress={() => void handlePlanInvite(item, true)}
            style={styles.acceptBtn}
            disabled={isDismissing}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Accept plan invite"
          >
            {isDismissing ? (
              <Ionicons name="checkmark" size={18} color="black" style={{ opacity: 0.5 }} />
            ) : (
              <Ionicons name="checkmark" size={18} color="black" />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => void handlePlanInvite(item, false)}
            style={styles.dismissBtn}
            disabled={isDismissing}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Decline plan invite"
          >
            <CloseIcon size={20} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const ActivityRow = ({ item }: { item: StandardActivityFeedItem }) => {
    const avatarUri = resolveAvatar(item.actorImageUrl);
    const unread = !item.read;
    const isDismissing = dismissingKeys.has(item.feedKey);

    return (
      <View
        style={[styles.row, styles.activityRow, unread && styles.activityRowUnread]}
      >
        <TouchableOpacity
          style={styles.activityTapArea}
          activeOpacity={0.75}
          onPress={() => handleActivityPress(item)}
          disabled={isDismissing}
        >
          <View style={styles.rowLeft}>
            <View style={styles.avatar}>
              <ExpoImage
                source={{ uri: avatarUri }}
                style={styles.avatarImg}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={0}
                recyclingKey={avatarUri}
                priority="high"
              />
            </View>

            <View style={{ flex: 1 }}>
              <NotificationMessage
                name={item.actorName}
                {...activityMessageParts(
                  item.kind,
                  item.kind === "community_post_approval" ||
                  item.kind === "community_post_approved" ||
                  item.kind === "community_post_rejected"
                    ? item.groupName
                    : item.planTitle
                )}
              />
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => dismissActivity(item)}
          style={styles.dismissBtn}
          disabled={isDismissing}
          accessibilityRole="button"
          accessibilityLabel="Dismiss notification"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <View style={isDismissing ? { opacity: 0.5 } : undefined}>
            <CloseIcon size={20} />
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  const renderFeedItem = ({ item }: { item: FeedItem }) => (
    <View style={styles.group}>
      {item.kind === "friend_request" ? (
        <FriendRequestRow item={item} />
      ) : item.kind === "community_group_invite" ? (
        <CommunityGroupInviteRow item={item} />
      ) : item.kind === "plan_invite" ? (
        <PlanInviteRow item={item} />
      ) : (
        <ActivityRow item={item} />
      )}
    </View>
  );

  const isEmpty = feedItems.length === 0;
  const emptyTopOffset = Math.round(windowHeight * 0.2);
  const showInitialSkeleton = loading && isEmpty && !loadError;

  return (
    <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
      <StatusBar barStyle="light-content" />

      <StackScreenHeader
        title="Notifications"
        right={
          !loadError && !isEmpty ? (
            <TouchableOpacity
              onPress={() => setShowClearConfirm(true)}
              disabled={clearingAll}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Clear all notifications"
            >
              <Text style={[styles.clearAllText, clearingAll && { opacity: 0.5 }]}>
                Clear all
              </Text>
            </TouchableOpacity>
          ) : null
        }
      />

      {showInitialSkeleton ? (
        <View style={styles.listLoading}>
          <ListRowsSkeleton count={6} />
        </View>
      ) : loadError && isEmpty ? (
        <ScrollView
          style={styles.emptyScroll}
          contentContainerStyle={styles.center}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={ACCENT}
            />
          }
        >
          <Text style={styles.emptyTitle}>Could not load notifications</Text>
          <Text style={styles.emptySubtitle}>Pull down to refresh or try again later.</Text>
        </ScrollView>
      ) : isEmpty ? (
        <ScrollView
          style={styles.emptyScroll}
          contentContainerStyle={[
            styles.emptyScrollContent,
            { paddingTop: emptyTopOffset },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={ACCENT}
            />
          }
        >
          <NotificationsEmptyState />
        </ScrollView>
      ) : (
        <FlatList
          data={feedItems}
          keyExtractor={(item) => item.feedKey}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={onRefresh}
          renderItem={renderFeedItem}
        />
      )}

      <ConfirmModal
        visible={showClearConfirm}
        title="Clear all?"
        message="This removes every item in your notifications list. Pending friend requests will be declined."
        confirmText="Clear all"
        destructive
        onCancel={() => setShowClearConfirm(false)}
        onConfirm={clearAll}
      />

      <AlertModal
        visible={alertVisible}
        title={alertConfig?.title}
        message={alertConfig?.message || ""}
        onClose={() => setAlertVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BACKGROUND },
  center: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: SPACE_4 },
  listLoading: {
    flex: 1,
    paddingTop: SPACE_3,
    paddingHorizontal: SPACE_4,
  },
  listContent: {
    paddingBottom: SPACE_6 + 8,
    paddingTop: SPACE_3,
  },
  emptyScroll: {
    flex: 1,
  },
  emptyScrollContent: {
    flexGrow: 1,
    alignItems: "center",
    paddingBottom: SPACE_6,
  },
  emptyState: {
    alignItems: "center",
    paddingHorizontal: SPACE_5,
    maxWidth: 300,
    width: "100%",
    alignSelf: "center",
  },
  group: {
    backgroundColor: GROUP_SURFACE,
    marginHorizontal: SPACE_4 + 4,
    borderRadius: RADIUS_LG,
    overflow: "hidden",
    marginBottom: SPACE_3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GROUP_BORDER,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: SPACE_4 + 2,
    paddingHorizontal: SPACE_4 + 2,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER_SUBTLE_HEX,
  },
  activityRow: {
    borderBottomWidth: 0,
  },
  activityRowUnread: {
    backgroundColor: "transparent",
  },
  activityTapArea: {
    flex: 1,
    marginRight: SPACE_3,
  },
  dismissBtn: {
    backgroundColor: BORDER_STRONG,
    minWidth: 40,
    height: 40,
    borderRadius: RADIUS_LG,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: BORDER_MUTED,
    paddingHorizontal: 4,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: SPACE_3,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: RADIUS_2XL,
    backgroundColor: BORDER_STRONG,
    justifyContent: "center",
    alignItems: "center",
    marginRight: SPACE_4,
    overflow: "hidden",
  },
  avatarImg: {
    width: 56,
    height: 56,
    borderRadius: RADIUS_2XL,
  },
  rowText: {
    fontSize: TYPE_BODY,
    color: TEXT,
    fontFamily: fonts.medium,
    lineHeight: 22,
  },
  nameBold: {
    fontFamily: fonts.heavy,
    color: TEXT,
    fontSize: TYPE_BODY,
  },
  messageRest: {
    color: MUTED,
    fontFamily: fonts.book,
    fontSize: TYPE_BODY,
  },
  emphasisText: {
    color: TEXT,
    fontFamily: fonts.medium,
    fontSize: TYPE_BODY,
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  acceptBtn: {
    backgroundColor: ACCENT,
    minWidth: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: SPACE_3,
    paddingHorizontal: 6,
  },
  emptyIconRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: MUTED3,
    backgroundColor: SURFACE,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACE_5,
  },
  emptyHeadline: {
    ...emptyStateTitleText,
    textAlign: "center",
  },
  emptyHelper: {
    color: MUTED,
    fontSize: TYPE_BODY,
    fontFamily: fonts.book,
    textAlign: "center",
    lineHeight: 24,
    marginTop: SPACE_3,
    maxWidth: 280,
  },
  emptyTitle: {
    ...emptyStateTitleText,
    marginBottom: 4,
  },
  emptySubtitle: {
    color: MUTED2,
    fontSize: TYPE_BUTTON,
    fontFamily: fonts.medium,
    textAlign: "center",
    marginTop: 8,
  },
  clearAllText: {
    color: MUTED,
    fontSize: TYPE_CAPTION,
    fontFamily: fonts.medium,
  },
});
