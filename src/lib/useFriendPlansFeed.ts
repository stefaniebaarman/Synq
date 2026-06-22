import type { Friend } from "@/constants/Variables";
import { aggregateFriendPlans } from "@/src/lib/aggregateFriendPlans.js";
import { db } from "@/src/lib/firebase";
import { ignoreSnapshotPermissionDenied } from "@/src/lib/firestoreListeners";
import {
  buildJoinedPlanKeysForFriend,
  isViewerHostOfFriendPlan,
  joinFriendOpenPlan,
  planLooksJoinedForFriend,
  unjoinFriendOpenPlan,
  type FriendOpenPlanEvent,
} from "@/src/lib/friendOpenPlanJoin";
import { friendProfileCacheByUser } from "@/src/lib/socialCache";
import { doc, onSnapshot } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";

const viewerEventsCacheByUser: Record<string, FriendOpenPlanEvent[]> = {};

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
    const unsub = onSnapshot(
      doc(db, "users", userId),
      (snap) => {
        const events = snap.exists()
          ? ((snap.data()?.events as FriendOpenPlanEvent[] | undefined) ?? [])
          : [];
        const nextEvents = Array.isArray(events) ? events : [];
        viewerEventsCacheByUser[userId] = nextEvents;
        setViewerEvents(nextEvents);
      },
      ignoreSnapshotPermissionDenied
    );
    return unsub;
  }, [userId]);

  const seededEventsById = useMemo(
    () => seedFriendEventsById(userId, visibleFriends),
    [userId, friendIdsKey, visibleFriends]
  );

  const friendEventsById = useMemo(() => {
    const merged: Record<string, FriendOpenPlanEvent[]> = { ...seededEventsById };
    Object.entries(liveEventsById).forEach(([friendId, events]) => {
      merged[friendId] = events;
    });
    return merged;
  }, [seededEventsById, liveEventsById]);

  useEffect(() => {
    if (!userId || visibleFriends.length === 0) {
      setLiveEventsById({});
      setEventsHydrated(true);
      return;
    }

    const hydratedIds = new Set<string>();
    const unsubs = visibleFriends.map((friend) =>
      onSnapshot(
        doc(db, "users", friend.id),
        (snap) => {
          const events = snap.exists()
            ? ((snap.data()?.events as FriendOpenPlanEvent[] | undefined) ?? [])
            : [];
          const nextEvents = Array.isArray(events) ? events : [];
          setLiveEventsById((prev) => ({ ...prev, [friend.id]: nextEvents }));
          if (!friendProfileCacheByUser[userId]) {
            friendProfileCacheByUser[userId] = {};
          }
          friendProfileCacheByUser[userId][friend.id] = {
            id: friend.id,
            ...(snap.exists() ? (snap.data() as object) : {}),
            displayName: friend.displayName,
          } as Friend;
          if (!hydratedIds.has(friend.id)) {
            hydratedIds.add(friend.id);
            if (hydratedIds.size >= visibleFriends.length) {
              setEventsHydrated(true);
            }
          }
        },
        ignoreSnapshotPermissionDenied
      )
    );

    const timeout = setTimeout(() => setEventsHydrated(true), 1200);
    return () => {
      clearTimeout(timeout);
      unsubs.forEach((unsub) => unsub());
    };
  }, [userId, friendIdsKey, visibleFriends]);

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
    async (item: AggregatedFriendPlan) => {
      if (!userId) return;
      const planKey = `${item.sourceFriendId}|${item.event.id}`;
      if (planIsHost(item)) return;

      if (planJoined(item)) {
        setPendingUnjoin(item);
        return;
      }

      setBusyPlanKey(planKey);
      try {
        await joinFriendOpenPlan(
          item.event,
          item.sourceFriendId,
          item.sourceFriendName
        );
        showSuccessToast("Joined!");
      } catch (err: unknown) {
        showErrorAlert(
          err instanceof Error ? err.message : "Could not join this plan right now."
        );
      } finally {
        setBusyPlanKey(null);
      }
    },
    [userId, planIsHost, planJoined, showSuccessToast, showErrorAlert]
  );

  const confirmUnjoin = useCallback(async () => {
    const item = pendingUnjoin;
    setPendingUnjoin(null);
    if (!item) return;
    const planKey = `${item.sourceFriendId}|${item.event.id}`;
    setBusyPlanKey(planKey);
    try {
      await unjoinFriendOpenPlan(item.event, item.sourceFriendId);
      showSuccessToast("Removed");
    } catch (err: unknown) {
      showErrorAlert(
        err instanceof Error ? err.message : "Could not remove this plan."
      );
    } finally {
      setBusyPlanKey(null);
    }
  }, [pendingUnjoin, showSuccessToast, showErrorAlert]);

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
