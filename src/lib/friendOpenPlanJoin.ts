import { resolvePlanHostUidForJoin } from "@/src/lib/planAttribution";
import {
  eventKey,
  eventKeyLoose,
  matchesPlanEvent,
  matchesPlanEventForHostSync,
  openPlanSortValue,
} from "@/src/lib/planEvents";
import { auth, db } from "@/src/lib/firebase";
import { collection, doc, getDoc, getDocs, updateDoc } from "firebase/firestore";

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
  await Promise.all(
    sourceIds.map(async (uid) => {
      try {
        const s = await getDoc(doc(db, "users", uid));
        if (s.exists()) {
          displayNameById[uid] = String((s.data() as Record<string, unknown>)?.displayName || "").trim();
        }
      } catch {
        /* best-effort */
      }
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
          const attendeeData = attendeeSnap.data() as Record<string, unknown>;
          const attendeeEvents = Array.isArray(attendeeData?.events)
            ? (attendeeData.events as FriendOpenPlanEvent[])
            : [];
          let changed = false;
          const nextAttendeeEvents = attendeeEvents.map((row) => {
            const isHostDoc = !!planHostUid && String(attendeeId) === planHostUid;
            const hostMatchedById =
              isHostDoc && event?.id != null && row?.id != null && String(row.id) === String(event.id);
            const matched =
              hostMatchedById ||
              matchesPlanEvent(row, eventForMatch, attendeeEvents) ||
              (isHostDoc &&
                matchesPlanEventForHostSync(row, eventForMatch, attendeeEvents, planHostUid));
            if (!matched) return row;
            const existingIds = Array.isArray(row?.joinedFromIds)
              ? row.joinedFromIds
              : [row?.joinedFromId].filter(Boolean);
            const mergedIds = Array.from(
              new Set(
                [...existingIds, ...allAttendeeIds]
                  .map((id) => String(id || "").trim())
                  .filter(Boolean)
              )
            );
            const otherNames = mergedIds
              .filter((id) => id !== attendeeId)
              .map((id) => displayNameById[id])
              .filter(Boolean);
            const prevNames = Array.isArray(row?.joinedFromNames)
              ? row.joinedFromNames
              : [row?.joinedFromName].filter(Boolean);
            const idsChanged = mergedIds.join("|") !== existingIds.join("|");
            const namesChanged = otherNames.join("|") !== prevNames.join("|");
            const resolvedHost = String(planHostUid || "").trim();
            const attendeeIsResolvedHost = !!resolvedHost && String(attendeeId) === resolvedHost;
            const nextHost = attendeeIsResolvedHost
              ? row.planHostUid || planHostUid || undefined
              : resolvedHost || row.planHostUid || planHostUid || undefined;
            const hostChanged = String(nextHost || "") !== String(row?.planHostUid || "");
            const hostUidForDoc = String(nextHost || planHostUid || "").trim();
            const orderedIds =
              isHostDoc && hostUidForDoc
                ? [hostUidForDoc, ...mergedIds.filter((id) => id !== hostUidForDoc)]
                : mergedIds;
            const nextJoinedFromId =
              isHostDoc && hostUidForDoc ? hostUidForDoc : orderedIds[0] || "";
            const hadWrongJoinAnchor =
              isHostDoc &&
              !!String(row?.joinedFromFriendUid || "").trim() &&
              String(row.joinedFromFriendUid).trim() !== hostUidForDoc;
            if (
              !idsChanged &&
              !namesChanged &&
              !hostChanged &&
              !hadWrongJoinAnchor &&
              orderedIds.join("|") === mergedIds.join("|") &&
              String(row?.joinedFromId || "") === nextJoinedFromId
            ) {
              return row;
            }
            changed = true;
            const updated: FriendOpenPlanEvent = {
              ...row,
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
        } catch {
          /* best-effort */
        }
      })
    );
  };

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
      };
    });
    await updateDoc(meRef, { events: updatedExistingEvents });
    await syncAttendeesAcrossUsers(sourceIds);
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
  };

  const nextEvents = [...existingEvents, newEvent].sort(
    (a, b) => openPlanSortValue(a) - openPlanSortValue(b)
  );
  await updateDoc(meRef, { events: nextEvents });
  await syncAttendeesAcrossUsers(sourceIds);
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
          displayNameById[uid] = String((s.data() as Record<string, unknown>)?.displayName || "").trim();
        }
      } catch {
        /* best-effort */
      }
    })
  );

  await Promise.all(
    allAttendeeIds.map(async (attendeeId) => {
      if (attendeeId === user.uid) return;
      try {
        const attendeeRef = doc(db, "users", attendeeId);
        const attendeeSnap = await getDoc(attendeeRef);
        if (!attendeeSnap.exists()) return;
        const attendeeData = attendeeSnap.data() as Record<string, unknown>;
        const attendeeEvents = Array.isArray(attendeeData?.events)
          ? (attendeeData.events as FriendOpenPlanEvent[])
          : [];
        let changed = false;
        const nextAttendeeEvents = attendeeEvents.map((row) => {
          if (!matchesPlanEvent(row, event, attendeeEvents)) return row;
          const existingIds = Array.isArray(row?.joinedFromIds)
            ? row.joinedFromIds
            : [row?.joinedFromId].filter(Boolean);
          const mergedIds = existingIds
            .map((id) => String(id || "").trim())
            .filter(Boolean)
            .filter((id) => id !== user.uid);
          const otherNames = mergedIds
            .filter((id) => id !== attendeeId)
            .map((id) => displayNameById[id])
            .filter(Boolean);
          const prevNames = Array.isArray(row?.joinedFromNames)
            ? row.joinedFromNames
            : [row?.joinedFromName].filter(Boolean);
          const idsChanged = mergedIds.join("|") !== existingIds.join("|");
          const namesChanged = otherNames.join("|") !== prevNames.join("|");
          if (!idsChanged && !namesChanged) return row;
          changed = true;
          return {
            ...row,
            joinedFromIds: mergedIds,
            joinedFromId: mergedIds[0] || "",
            joinedFromNames: otherNames,
            joinedFromName: otherNames.join(", "),
          };
        });
        if (changed) {
          await updateDoc(attendeeRef, { events: nextAttendeeEvents });
        }
      } catch {
        /* best-effort */
      }
    })
  );

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
