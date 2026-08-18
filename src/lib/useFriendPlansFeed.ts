import type { Friend } from "@/constants/Variables";
import { aggregateFriendPlans } from "@/src/lib/aggregateFriendPlans.js";
import {
  appendOptimisticJoinedViewerEvent,
  buildJoinedPlanKeysForFriend,
  isViewerHostOfFriendPlan,
  joinFriendOpenPlan,
  planLooksJoinedForFriend,
  removeJoinedViewerEvent,
  unjoinFriendOpenPlan,
  type FriendOpenPlanEvent,
} from "@/src/lib/friendOpenPlanJoin";
import { filterOutPastOpenPlans } from "@/src/lib/planEvents";
import { friendProfileCacheByUser } from "@/src/lib/socialCache";
import { subscribeUserDocMultiplexed } from "@/src/lib/socialListenerHub";
import { useCallback, useEffect, useMemo, useState } from "react";

const viewerEventsCacheByUser: Record<string, FriendOpenPlanEvent[]> = {};

function friendHasUpcomingHostedPlans(
  friendId: string,
  events: FriendOpenPlanEvent[] | undefined
): boolean {
  const upcoming = filterOutPastOpenPlans(Array.isArray(events) ? events : []);
  return upcoming.some((event) => {
    const host =
      String((event as { planHostUid?: string })?.planHostUid || "").trim() ||
      friendId;
    return host === friendId && !!event?.id && !!event?.date && !!event?.title;
  });
}

function seedFriendEventsById(
  userId: string,
  visibleFriends: Friend[]
): Record<string, FriendOpenPlanEvent[]> {
  const initial: Record<string, FriendOpenPlanEvent[]> = {};
  visibleFriends.forEach((friend) => {
    const fromProfile = userId
      ? friendProfileCacheByUser[userId]?.[friend.id]?.events
      : undefined;
    const fromList = friend.events;
    const events = Array.isArray(fromProfile)
      ? fromProfile
      : Array.isArray(fromList)
        ? fromList
        : [];
    initial[friend.id] = events;
  });
  return initial;
}

export type AggregatedFriendPlan = {
  event: FriendOpenPlanEvent;
  sourceFriendId: string;
  sourceFriendName: string;
};

type Options = {
  userId: string;
  friends: Friend[];
  isBlocked: (friendId: string) => boolean;
};

export function useFriendPlansFeed({ userId, friends, isBlocked }: Options) {
  const [liveEventsById, setLiveEventsById] = useState<Record<string, FriendOpenPlanEvent[]>>({});
  const [eventsHydrated, setEventsHydrated] = useState(true);
  const [viewerEvents, setViewerEvents] = useState<FriendOpenPlanEvent[]>(
    () => (userId ? viewerEventsCacheByUser[userId] ?? [] : [])
  );
  const [busyPlanKey, setBusyPlanKey] = useState<string | null>(null);
  const [pendingJoin, setPendingJoin] = useState<AggregatedFriendPlan | null>(null);
  const [pendingUnjoin, setPendingUnjoin] = useState<AggregatedFriendPlan | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [errorAlertVisible, setErrorAlertVisible] = useState(false);
  const [errorAlertMessage, setErrorAlertMessage] = useState("");

  const visibleFriends = useMemo(
    () => friends.filter((friend) => !isBlocked(friend.id)),
    [friends, isBlocked]
  );

  const friendIdsKey = useMemo(
    () => visibleFriends.map((friend) => friend.id).join("|"),
    [visibleFriends]
  );

  const showSuccessToast = useCallback((message: string) => {
    setSuccessToast(message);
  }, []);

  const dismissSuccessToast = useCallback(() => setSuccessToast(null), []);

  const showErrorAlert = useCallback((message: string) => {
    setErrorAlertMessage(message);
    setErrorAlertVisible(true);
  }, []);

  const dismissErrorAlert = useCallback(() => setErrorAlertVisible(false), []);

  useEffect(() => {
    if (!userId) return;
    const unsub = subscribeUserDocMultiplexed(userId, (data) => {
      const events = (data?.events as FriendOpenPlanEvent[] | undefined) ?? [];
      const nextEvents = Array.isArray(events) ? events : [];
      viewerEventsCacheByUser[userId] = nextEvents;
      setViewerEvents(nextEvents);
    });
    return unsub;
  }, [userId]);

  const seededEventsById = useMemo(
    () => seedFriendEventsById(userId, visibleFriends),
    // friendIdsKey intentionally tracks friend-set changes for reseeding
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, friendIdsKey, visibleFriends]
  );

  const friendEventsById = useMemo(() => {
    const merged: Record<string, FriendOpenPlanEvent[]> = { ...seededEventsById };
    Object.entries(liveEventsById).forEach(([friendId, events]) => {
      merged[friendId] = events;
    });
    return merged;
  }, [seededEventsById, liveEventsById]);

  // Only live-listen to friends that already show upcoming hosted plans (not N for every friend).
  const liveFriendIdsKey = useMemo(() => {
    return visibleFriends
      .filter((friend) =>
        friendHasUpcomingHostedPlans(friend.id, seededEventsById[friend.id])
      )
      .map((friend) => friend.id)
      .sort()
      .join("|");
  }, [visibleFriends, seededEventsById]);

  useEffect(() => {
    if (!userId) {
      setLiveEventsById({});
      setEventsHydrated(true);
      return;
    }

    const liveIds = liveFriendIdsKey ? liveFriendIdsKey.split("|").filter(Boolean) : [];
    if (liveIds.length === 0) {
      setLiveEventsById({});
      setEventsHydrated(true);
      return;
    }

    const hydratedIds = new Set<string>();
    const unsubs = liveIds.map((friendId) => {
      const friend = visibleFriends.find((f) => f.id === friendId);
      return subscribeUserDocMultiplexed(friendId, (data) => {
        const events = (data?.events as FriendOpenPlanEvent[] | undefined) ?? [];
        const nextEvents = Array.isArray(events) ? events : [];
        setLiveEventsById((prev) => ({ ...prev, [friendId]: nextEvents }));
        if (!friendProfileCacheByUser[userId]) {
          friendProfileCacheByUser[userId] = {};
        }
        friendProfileCacheByUser[userId][friendId] = {
          id: friendId,
          ...(data || {}),
          displayName: friend?.displayName,
        } as Friend;
        if (!hydratedIds.has(friendId)) {
          hydratedIds.add(friendId);
          if (hydratedIds.size >= liveIds.length) {
            setEventsHydrated(true);
          }
        }
      });
    });

    const timeout = setTimeout(() => setEventsHydrated(true), 1200);
    return () => {
      clearTimeout(timeout);
      unsubs.forEach((unsub) => unsub());
    };
  }, [userId, liveFriendIdsKey, visibleFriends]);

  const friendsWithPlans = useMemo(
    () =>
      visibleFriends.map((friend) => ({
        id: friend.id,
        displayName: friend.displayName,
        events: friendEventsById[friend.id] ?? [],
      })),
    [visibleFriends, friendEventsById]
  );

  const aggregatedPlans = useMemo(
    () =>
      aggregateFriendPlans(friendsWithPlans, {
        viewerId: userId,
        viewerEvents,
      }),
    [friendsWithPlans, userId, viewerEvents]
  );

  const hostDisplayNameByUid = useMemo(() => {
    const next: Record<string, string> = {};
    visibleFriends.forEach((friend) => {
      const name = String(friend.displayName || "").trim();
      if (name) next[friend.id] = name;
    });
    aggregatedPlans.forEach(({ event }) => {
      const stored = event.attendeeDisplayNames;
      if (!stored || typeof stored !== "object") return;
      Object.entries(stored).forEach(([uid, name]) => {
        const id = String(uid || "").trim();
        const label = String(name || "").trim();
        if (id && label) next[id] = label;
      });
    });
    return next;
  }, [visibleFriends, aggregatedPlans]);

  const planJoined = useCallback(
    (item: AggregatedFriendPlan) => {
      const joinedKeys = buildJoinedPlanKeysForFriend(
        viewerEvents,
        userId,
        item.sourceFriendId
      );
      return planLooksJoinedForFriend(joinedKeys, item.event);
    },
    [viewerEvents, userId]
  );

  const planIsHost = useCallback(
    (item: AggregatedFriendPlan) =>
      isViewerHostOfFriendPlan(item.event, userId, item.sourceFriendId),
    [userId]
  );

  const handlePlanAction = useCallback(
    (item: AggregatedFriendPlan) => {
      if (!userId) return;
      if (planIsHost(item)) return;

      if (planJoined(item)) {
        setPendingJoin(null);
        setPendingUnjoin((current) => current ?? item);
        return;
      }

      setPendingUnjoin(null);
      setPendingJoin((current) => current ?? item);
    },
    [userId, planIsHost, planJoined]
  );

  const confirmJoin = useCallback(async () => {
    const item = pendingJoin;
    setPendingJoin(null);
    if (!item || !userId) return;
    const planKey = `${item.sourceFriendId}|${item.event.id}`;

    setViewerEvents((prev) => {
      const next = appendOptimisticJoinedViewerEvent(
        prev,
        item.event,
        item.sourceFriendId,
        item.sourceFriendName,
        userId
      );
      viewerEventsCacheByUser[userId] = next;
      return next;
    });

    setBusyPlanKey(planKey);
    try {
      await joinFriendOpenPlan(
        item.event,
        item.sourceFriendId,
        item.sourceFriendName
      );
    } catch (err: unknown) {
      setViewerEvents((prev) => {
        const next = removeJoinedViewerEvent(
          prev,
          item.event,
          item.sourceFriendId,
          userId
        );
        viewerEventsCacheByUser[userId] = next;
        return next;
      });
      showErrorAlert(
        err instanceof Error ? err.message : "Could not join this plan right now."
      );
    } finally {
      setBusyPlanKey(null);
    }
  }, [pendingJoin, userId, showErrorAlert]);

  const cancelJoin = useCallback(() => setPendingJoin(null), []);

  const confirmUnjoin = useCallback(async () => {
    const item = pendingUnjoin;
    setPendingUnjoin(null);
    if (!item || !userId) return;
    const planKey = `${item.sourceFriendId}|${item.event.id}`;

    setViewerEvents((prev) => {
      const next = removeJoinedViewerEvent(
        prev,
        item.event,
        item.sourceFriendId,
        userId
      );
      viewerEventsCacheByUser[userId] = next;
      return next;
    });

    setBusyPlanKey(planKey);
    try {
      await unjoinFriendOpenPlan(item.event, item.sourceFriendId);
    } catch (err: unknown) {
      setViewerEvents((prev) => {
        const next = appendOptimisticJoinedViewerEvent(
          prev,
          item.event,
          item.sourceFriendId,
          item.sourceFriendName,
          userId
        );
        viewerEventsCacheByUser[userId] = next;
        return next;
      });
      showErrorAlert(
        err instanceof Error ? err.message : "Could not remove this plan."
      );
    } finally {
      setBusyPlanKey(null);
    }
  }, [pendingUnjoin, userId, showErrorAlert]);

  const cancelUnjoin = useCallback(() => setPendingUnjoin(null), []);

  const isPlanBusy = useCallback(
    (item: AggregatedFriendPlan) =>
      busyPlanKey === `${item.sourceFriendId}|${item.event.id}`,
    [busyPlanKey]
  );

  const friendImageByUid = useMemo(() => {
    const next: Record<string, string | null> = {};
    visibleFriends.forEach((friend) => {
      const url = String((friend as { imageurl?: string }).imageurl || "").trim();
      if (url) next[friend.id] = url;
    });
    return next;
  }, [visibleFriends]);

  return {
    aggregatedPlans,
    eventsHydrated,
    hostDisplayNameByUid,
    visibleFriends,
    viewerEvents,
    friendImageByUid,
    planJoined,
    planIsHost,
    handlePlanAction,
    isPlanBusy,
    pendingJoin,
    confirmJoin,
    cancelJoin,
    pendingUnjoin,
    confirmUnjoin,
    cancelUnjoin,
    successToast,
    dismissSuccessToast,
    errorAlertVisible,
    errorAlertMessage,
    dismissErrorAlert,
  };
}
