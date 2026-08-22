import { auth, db } from "@/src/lib/firebase";
import { planLooseMatch, resolvePlanHostUidForJoin } from "@/src/lib/planAttribution";
import {
  eventKey,
  eventKeyLoose,
  matchesPlanEvent,
  openPlanSortValue,
} from "@/src/lib/planEvents";
import { collection, doc, getDoc, getDocs, updateDoc, arrayUnion } from "firebase/firestore";

export type FriendOpenPlanEvent = {
  id: string;
  date: string;
  title: string;
  time?: string;
  location?: string;
  planHostUid?: string;
  joinedFromFriendUid?: string;
  joinedFromId?: string;
  joinedFromIds?: string[];
  joinedFromName?: string;
  joinedFromNames?: string[];
  attendeeDisplayNames?: Record<string, string>;
  /** Denormalized avatars so non-friends can see faces on going lists. */
  attendeeImages?: Record<string, string>;
  mergedIntoExisting?: boolean;
};

export function isInSharedPlanWithFriend(
  event: FriendOpenPlanEvent | null | undefined,
  myUid: string,
  friendUid: string
): boolean {
  if (!event || !friendUid) return false;
  if (event.joinedFromFriendUid === friendUid) return true;
  const ids = new Set(
    [...(Array.isArray(event?.joinedFromIds) ? event.joinedFromIds : []), event?.joinedFromId]
      .map((id) => String(id || "").trim())
      .filter(Boolean)
  );
  return ids.has(myUid) && ids.has(friendUid);
}

export function isViewerHostOfFriendPlan(
  event: FriendOpenPlanEvent,
  viewerId: string,
  sourceFriendId: string
): boolean {
  const vid = String(viewerId || "").trim();
  const fk = String(sourceFriendId || "").trim();
  if (!vid || !fk) return false;
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
}

export function buildJoinedPlanKeysForFriend(
  viewerEvents: FriendOpenPlanEvent[],
  viewerId: string,
  sourceFriendId: string
): Record<string, boolean> {
  const next: Record<string, boolean> = {};
  viewerEvents.forEach((event) => {
    if (!isInSharedPlanWithFriend(event, viewerId, sourceFriendId)) return;
    next[eventKey(event)] = true;
    next[eventKeyLoose(event)] = true;
  });
  return next;
}

export function planLooksJoinedForFriend(
  joinedPlanKeys: Record<string, boolean>,
  event: FriendOpenPlanEvent
): boolean {
  return !!(joinedPlanKeys[eventKey(event)] || joinedPlanKeys[eventKeyLoose(event)]);
}

export function buildOptimisticJoinedViewerEvent(
  event: FriendOpenPlanEvent,
  sourceFriendId: string,
  sourceFriendName: string,
  viewerId: string
): FriendOpenPlanEvent {
  const friendKey = String(sourceFriendId || "").trim();
  const vid = String(viewerId || "").trim();
  const profileName = String(sourceFriendName || "Friend").trim();
  const sourceIds = Array.from(
    new Set(
      [
        ...(Array.isArray(event?.joinedFromIds) ? event.joinedFromIds : []),
        String(event?.joinedFromId || "").trim(),
        friendKey,
        vid,
      ]
        .map((id) => String(id).trim())
        .filter(Boolean)
    )
  );

  return {
    ...event,
    id: `optimistic-${String(event.id || "plan")}`,
    planHostUid: resolvePlanHostUidForJoin(event, friendKey),
    joinedFromFriendUid: friendKey,
    joinedFromId: friendKey,
    joinedFromIds: sourceIds,
    joinedFromName: profileName,
    joinedFromNames: [profileName],
    attendeeDisplayNames: {
      ...(event.attendeeDisplayNames && typeof event.attendeeDisplayNames === "object"
        ? event.attendeeDisplayNames
        : {}),
      ...(friendKey ? { [friendKey]: profileName } : {}),
    },
  };
}

export function appendOptimisticJoinedViewerEvent(
  viewerEvents: FriendOpenPlanEvent[],
  event: FriendOpenPlanEvent,
  sourceFriendId: string,
  sourceFriendName: string,
  viewerId: string
): FriendOpenPlanEvent[] {
  const joinedKeys = buildJoinedPlanKeysForFriend(viewerEvents, viewerId, sourceFriendId);
  if (planLooksJoinedForFriend(joinedKeys, event)) return viewerEvents;
  const optimistic = buildOptimisticJoinedViewerEvent(
    event,
    sourceFriendId,
    sourceFriendName,
    viewerId
  );
  return [...viewerEvents, optimistic];
}

export function removeJoinedViewerEvent(
  viewerEvents: FriendOpenPlanEvent[],
  event: FriendOpenPlanEvent,
  sourceFriendId: string,
  viewerId: string
): FriendOpenPlanEvent[] {
  return viewerEvents.filter(
    (row) =>
      !(
        isInSharedPlanWithFriend(row, viewerId, sourceFriendId) && planLooseMatch(row, event)
      )
  );
}

export type JoinFriendOpenPlanResult = "added" | "updated" | "error";

export async function joinFriendOpenPlan(
  event: FriendOpenPlanEvent,
  sourceFriendId: string,
  sourceFriendName: string
): Promise<JoinFriendOpenPlanResult> {
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in to add this plan.");

  const meRef = doc(db, "users", user.uid);
  const meSnap = await getDoc(meRef);
  const meData = meSnap.exists() ? (meSnap.data() as Record<string, unknown>) : {};
  const existingEvents = Array.isArray(meData?.events) ? [...(meData.events as FriendOpenPlanEvent[])] : [];
  const joinerName = String(meData?.displayName || user.displayName || "Friend").trim();
  const profileName = String(sourceFriendName || "Friend").trim();
  const friendKey = String(sourceFriendId || "").trim();
  if (!friendKey) throw new Error("This plan is unavailable.");

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
      const data = d.data() as Record<string, unknown>;
      const display = String(data?.displayName || "").trim().toLowerCase();
      if (display && sourceNameSet.has(display)) {
        sourceIdsSet.add(d.id);
      }
    });
  } catch {
    /* best-effort */
  }
  const sourceIds = Array.from(sourceIdsSet);

  const displayNameById: Record<string, string> = {};
  const imageById: Record<string, string> = {};
  const myImage = String(meData?.imageurl || "").trim();
  if (joinerName) displayNameById[user.uid] = joinerName;
  if (myImage) imageById[user.uid] = myImage;

  await Promise.all(
    sourceIds.map(async (uid) => {
      try {
        const s = await getDoc(doc(db, "users", uid));
        if (s.exists()) {
          const data = s.data() as Record<string, unknown>;
          displayNameById[uid] = String(data?.displayName || "").trim();
          const img = String(data?.imageurl || "").trim();
          if (img) imageById[uid] = img;
        }
      } catch {
        /* best-effort */
      }
    })
  );

  const planHostUid = resolvePlanHostUidForJoin(event, friendKey);
  const eventForMatch = { ...event, planHostUid: event.planHostUid || planHostUid };
  const discoveryHosts = Array.from(
    new Set(
      [planHostUid, friendKey]
        .map((id) => String(id || "").trim())
        .filter((id) => id && id !== user.uid)
    )
  );

  const exists = existingEvents.some((row) => matchesPlanEvent(row, eventForMatch, existingEvents));
  if (exists) {
    const updatedExistingEvents = existingEvents.map((row) => {
      if (!matchesPlanEvent(row, eventForMatch, existingEvents)) return row;
      const existingNames = Array.isArray(row?.joinedFromNames)
        ? row.joinedFromNames
        : [row?.joinedFromName].filter(Boolean);
      const mergedNames = Array.from(
        new Set([...existingNames, ...sourceNames].map((n) => String(n || "").trim()).filter(Boolean))
      );
      return {
        ...row,
        planHostUid:
          planHostUid ||
          event.planHostUid ||
          (String(row.planHostUid || "").trim() !== user.uid
            ? row.planHostUid
            : undefined),
        mergedIntoExisting: true,
        joinedFromFriendUid: friendKey,
        joinedFromIds: sourceIds,
        joinedFromId: sourceIds[0] || "",
        joinedFromNames: mergedNames,
        joinedFromName: mergedNames.join(", "),
        attendeeDisplayNames: {
          ...(row.attendeeDisplayNames || {}),
          ...displayNameById,
        },
        attendeeImages: {
          ...(row.attendeeImages || {}),
          ...imageById,
        },
      };
    });
    await updateDoc(meRef, {
      events: updatedExistingEvents,
      ...(discoveryHosts.length > 0
        ? { planDiscoveryHosts: arrayUnion(...discoveryHosts) }
        : {}),
    });
    return "updated";
  }

  const newEvent: FriendOpenPlanEvent = {
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
    attendeeImages: imageById,
  };

  const nextEvents = [...existingEvents, newEvent].sort(
    (a, b) => openPlanSortValue(a) - openPlanSortValue(b)
  );
  await updateDoc(meRef, {
    events: nextEvents,
    ...(discoveryHosts.length > 0
      ? { planDiscoveryHosts: arrayUnion(...discoveryHosts) }
      : {}),
  });
  return "added";
}

export async function unjoinFriendOpenPlan(
  event: FriendOpenPlanEvent,
  sourceFriendId: string
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in to update this plan.");
  const friendKey = String(sourceFriendId || "").trim();
  if (!friendKey) throw new Error("This plan is unavailable.");

  const meRef = doc(db, "users", user.uid);
  const meSnap = await getDoc(meRef);
  const meData = meSnap.exists() ? (meSnap.data() as Record<string, unknown>) : {};
  const existingEvents = Array.isArray(meData?.events) ? (meData.events as FriendOpenPlanEvent[]) : [];
  const myEvent = existingEvents.find((row) => matchesPlanEvent(row, event, existingEvents));
  if (!myEvent || !isInSharedPlanWithFriend(myEvent, user.uid, friendKey)) {
    throw new Error("You aren't going to this plan together.");
  }

  const idSet = new Set(
    [...(Array.isArray(myEvent.joinedFromIds) ? myEvent.joinedFromIds : []), myEvent.joinedFromId]
      .map((id) => String(id || "").trim())
      .filter(Boolean)
  );
  const shouldDemerge =
    myEvent.mergedIntoExisting === true ||
    (myEvent.mergedIntoExisting !== false && idSet.size > 2);

  let nextEvents: FriendOpenPlanEvent[];
  if (shouldDemerge) {
    const soloRest = { ...myEvent };
    delete soloRest.joinedFromId;
    delete soloRest.joinedFromIds;
    delete soloRest.joinedFromName;
    delete soloRest.joinedFromNames;
    delete soloRest.mergedIntoExisting;
    delete soloRest.joinedFromFriendUid;
    soloRest.planHostUid = user.uid;
    nextEvents = existingEvents.map((row) => (row.id === myEvent.id ? soloRest : row));
  } else {
    nextEvents = existingEvents.filter((row) => row.id !== myEvent.id);
  }

  await updateDoc(meRef, { events: nextEvents });
}
