/**
 * Server-side open-plan sync: clients can only write their own user doc (firestore.rules),
 * so interest and deletions must be propagated with admin privileges.
 *
 * Roster fan-out updates the host and every other attendee who already has a matching
 * plan copy — not just the host (clients used to attempt this and silently fail).
 */

const admin = require("firebase-admin");
const { logError, logInfo } = require("./serverLog");

function eventKey(e) {
  return `${String(e?.title || "").trim().toLowerCase()}|${String(e?.date || "").trim()}|${String(
    e?.time || ""
  ).trim().toLowerCase()}|${String(e?.location || "").trim().toLowerCase()}`;
}

function eventKeyLoose(e) {
  return `${String(e?.title || "").trim().toLowerCase()}|${String(e?.date || "").trim()}`;
}

function matchesPlanEvent(e, target, siblingEvents) {
  if (eventKey(e) === eventKey(target)) return true;

  const hostE = String(e?.planHostUid || "").trim();
  const hostT = String(target?.planHostUid || "").trim();
  if (hostE && hostT && hostE !== hostT) return false;

  if (hostE && hostT && hostE === hostT && eventKeyLoose(e) === eventKeyLoose(target)) {
    const sameHostLoose = siblingEvents.filter(
      (x) =>
        String(x?.planHostUid || "").trim() === hostE && eventKeyLoose(x) === eventKeyLoose(e)
    );
    if (sameHostLoose.length === 1) return true;
  }

  if (hostT && !hostE && eventKeyLoose(e) === eventKeyLoose(target)) {
    const sameLoose = siblingEvents.filter((x) => eventKeyLoose(x) === eventKeyLoose(target));
    const withoutHost = sameLoose.filter((x) => !String(x?.planHostUid || "").trim());
    if (withoutHost.length === 1 && withoutHost[0] === e) return true;
  }

  if (!hostT && hostE && eventKeyLoose(e) === eventKeyLoose(target)) {
    const sameLoose = siblingEvents.filter((x) => eventKeyLoose(x) === eventKeyLoose(target));
    const withHost = sameLoose.filter((x) => String(x?.planHostUid || "").trim() === hostE);
    if (withHost.length === 1 && withHost[0] === e) return true;
  }

  return false;
}

function collectJoinedIds(e) {
  const ids = new Set();
  if (Array.isArray(e?.joinedFromIds)) {
    e.joinedFromIds.forEach((id) => {
      const s = String(id || "").trim();
      if (s) ids.add(s);
    });
  }
  const j = String(e?.joinedFromId || "").trim();
  if (j) ids.add(j);
  return ids;
}

function findHostPlanIndex(hostEvents, joinCopy, hostUid) {
  const looseT = eventKeyLoose(joinCopy);
  const strictT = eventKey(joinCopy);
  const titleT = String(joinCopy.title || "").trim().toLowerCase();
  const candidates = hostEvents
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => {
      const titleE = String(e.title || "").trim().toLowerCase();
      if (titleE !== titleT) return false;
      if (eventKeyLoose(e) !== looseT) return false;
      const ph = String(e.planHostUid || "").trim();
      if (ph && ph !== hostUid) return false;
      return true;
    });
  if (candidates.length === 0) return -1;
  if (candidates.length === 1) return candidates[0].i;
  const strictMatches = candidates.filter(({ e }) => eventKey(e) === strictT);
  if (strictMatches.length === 1) return strictMatches[0].i;
  return -1;
}

/** Match a plan row on any user's calendar (id → host heuristics → content). */
function findMatchingPlanIndex(events, planSnapshot, planHostUid) {
  if (!Array.isArray(events) || events.length === 0) return -1;

  const id = String(planSnapshot?.id || "").trim();
  if (id) {
    const byId = events.findIndex((e) => String(e?.id || "").trim() === id);
    if (byId >= 0) return byId;
  }

  const host = String(planHostUid || planSnapshot?.planHostUid || "").trim();
  if (host) {
    const hostIdx = findHostPlanIndex(events, planSnapshot, host);
    if (hostIdx >= 0) return hostIdx;
  }

  return events.findIndex((e) => matchesPlanEvent(e, planSnapshot, events));
}

function planInviteNotifId(hostUid, recipientUid, eventId) {
  const safeEventId = String(eventId || "")
    .trim()
    .replace(/[/\s]/g, "_");
  return `plan_invite_${hostUid}_${recipientUid}_${safeEventId}`.slice(0, 1400);
}

function collectInvitedIds(e) {
  const ids = new Set();
  if (Array.isArray(e?.planInvitedIds)) {
    e.planInvitedIds.forEach((id) => {
      const s = String(id || "").trim();
      if (s) ids.add(s);
    });
  }
  return ids;
}

function joinerStillOnHostedPlan(joinerUid, beforeCopy, afterEvents) {
  const hostUid = String(beforeCopy?.planHostUid || "").trim();
  if (!hostUid || hostUid === joinerUid) return true;

  for (const ae of afterEvents) {
    const aeHost = String(ae?.planHostUid || "").trim();
    if (aeHost !== hostUid) continue;
    if (!matchesPlanEvent(ae, beforeCopy, afterEvents)) continue;
    if (collectJoinedIds(ae).has(joinerUid)) return true;
  }
  return false;
}

async function loadDisplayNames(db, uids) {
  const names = {};
  await Promise.all(
    [...uids].map(async (uid) => {
      try {
        const snap = await db.collection("users").doc(uid).get();
        if (snap.exists) {
          names[uid] = String(snap.data()?.displayName || "").trim();
        }
      } catch (e) {
        logError("openPlanSync_loadDisplayName", e, { uid });
      }
    })
  );
  return names;
}

function buildRosterNames(mergedIds, targetUid, displayNameById) {
  return mergedIds
    .filter((id) => id !== targetUid)
    .map((id) => displayNameById[id])
    .filter(Boolean);
}

/**
 * Merge full attendee roster onto one user's matching plan copy.
 * @returns {Promise<boolean>} whether the doc was updated
 */
async function mergeRosterOntoUser(db, targetUid, planSnapshot, allAttendeeIds, planHostUid) {
  const targetRef = db.collection("users").doc(targetUid);
  const targetSnap = await targetRef.get();
  if (!targetSnap.exists) return false;

  let events = Array.isArray(targetSnap.data()?.events) ? [...targetSnap.data().events] : [];
  const idx = findMatchingPlanIndex(events, planSnapshot, planHostUid);
  if (idx < 0) return false;

  const row = events[idx];
  const host = String(planHostUid || "").trim();
  const isHostDoc = !!host && targetUid === host;

  const mergedSet = new Set(
    [...collectJoinedIds(row), ...allAttendeeIds, host]
      .map((id) => String(id || "").trim())
      .filter(Boolean)
  );
  const mergedIds = Array.from(mergedSet);
  const orderedIds =
    isHostDoc && host
      ? [host, ...mergedIds.filter((id) => id !== host)]
      : mergedIds;

  const displayNameById = await loadDisplayNames(db, orderedIds);
  const otherNames = buildRosterNames(orderedIds, targetUid, displayNameById);

  const prevKey = [...collectJoinedIds(row)].map(String).sort().join("|");
  const nextKey = orderedIds.slice().sort().join("|");
  const prevNamesStr = (
    Array.isArray(row.joinedFromNames) ? row.joinedFromNames : [row.joinedFromName]
  )
    .filter(Boolean)
    .map(String)
    .sort()
    .join("|");
  const nextNamesStr = otherNames.slice().sort().join("|");
  const prevHost = String(row.planHostUid || "").trim();
  const nextHost = isHostDoc ? host || prevHost || undefined : host || prevHost || undefined;
  if (prevKey === nextKey && prevNamesStr === nextNamesStr && prevHost === String(nextHost || "")) {
    return false;
  }

  const updated = {
    ...row,
    planHostUid: nextHost,
    joinedFromIds: orderedIds,
    joinedFromId: isHostDoc && host ? host : orderedIds[0] || "",
    joinedFromNames: otherNames,
    joinedFromName: otherNames.join(", "),
    attendeeDisplayNames: {
      ...(row.attendeeDisplayNames && typeof row.attendeeDisplayNames === "object"
        ? row.attendeeDisplayNames
        : {}),
      ...displayNameById,
    },
  };
  if (isHostDoc) {
    delete updated.joinedFromFriendUid;
  }

  events[idx] = updated;
  await targetRef.update({ events });
  return true;
}

/**
 * Remove joiner from one user's matching plan copy.
 */
async function removeJoinerFromUser(db, targetUid, planSnapshot, joinerUid, planHostUid) {
  const targetRef = db.collection("users").doc(targetUid);
  const targetSnap = await targetRef.get();
  if (!targetSnap.exists) return false;

  let events = Array.isArray(targetSnap.data()?.events) ? [...targetSnap.data().events] : [];
  const idx = findMatchingPlanIndex(events, planSnapshot, planHostUid);
  if (idx < 0) return false;

  const row = events[idx];
  const existingIds = collectJoinedIds(row);
  if (!existingIds.has(joinerUid)) return false;

  existingIds.delete(joinerUid);
  const mergedIds = Array.from(existingIds);
  const displayNameById = await loadDisplayNames(db, mergedIds);
  const otherNames = buildRosterNames(mergedIds, targetUid, displayNameById);

  events[idx] = {
    ...row,
    joinedFromIds: mergedIds,
    joinedFromId: mergedIds[0] || "",
    joinedFromNames: otherNames,
    joinedFromName: otherNames.join(", "),
  };

  await targetRef.update({ events });
  return true;
}

/**
 * When a friend leaves a hosted plan, remove them from host + other attendees' rosters.
 */
async function syncUnjoinFromAttendees(db, joinerUid, beforeEvents, afterEvents) {
  const beforeJoinCopies = beforeEvents.filter((e) => {
    const host = String(e?.planHostUid || "").trim();
    return host && host !== joinerUid;
  });
  if (beforeJoinCopies.length === 0) return;

  for (const beforeCopy of beforeJoinCopies) {
    if (joinerStillOnHostedPlan(joinerUid, beforeCopy, afterEvents)) continue;

    const hostUid = String(beforeCopy.planHostUid).trim();
    const targets = new Set(
      [...collectJoinedIds(beforeCopy), hostUid]
        .map((id) => String(id || "").trim())
        .filter(Boolean)
    );
    targets.delete(joinerUid);

    for (const targetUid of targets) {
      try {
        const updated = await removeJoinerFromUser(
          db,
          targetUid,
          beforeCopy,
          joinerUid,
          hostUid
        );
        if (updated) {
          logInfo("openPlanSync_unjoin_merged", { hostUid, joinerUid, targetUid });
        }
      } catch (e) {
        logError("openPlanSync_unjoin", e, { hostUid, joinerUid, targetUid });
      }
    }
  }
}

async function revokePendingInvitesForPlan(db, hostUid, removedEv) {
  const eventId = String(removedEv?.id || "").trim();
  const invited = collectInvitedIds(removedEv);
  if (!eventId || invited.size === 0) return;

  const deletes = [];
  for (const recipientUid of invited) {
    const notifId = planInviteNotifId(hostUid, recipientUid, eventId);
    deletes.push(
      db.collection("users").doc(recipientUid).collection("notifications").doc(notifId).delete()
    );
    deletes.push(
      db
        .collection("users")
        .doc(recipientUid)
        .collection("notificationLocks")
        .doc(notifId)
        .delete()
    );
  }
  await Promise.allSettled(deletes);
}

function findRemovedHostedPlans(hostUid, beforeEvents, afterEvents) {
  const removed = [];
  for (const beforeEv of beforeEvents) {
    if (String(beforeEv?.planHostUid || "").trim() !== hostUid) continue;
    const stillThere = afterEvents.some((ae) => {
      const bid = String(beforeEv?.id || "").trim();
      const aid = String(ae?.id || "").trim();
      if (bid && aid && bid === aid) return true;
      return matchesPlanEvent(ae, beforeEv, afterEvents);
    });
    if (!stillThere) removed.push(beforeEv);
  }
  return removed;
}

/**
 * When a friend joins a plan, merge roster onto host + every listed attendee who has a copy.
 */
async function syncJoinerInterestToAttendees(db, joinerUid, beforeEvents, afterEvents) {
  const joinCopies = afterEvents.filter((e) => {
    const host = String(e?.planHostUid || "").trim();
    return host && host !== joinerUid;
  });
  if (joinCopies.length === 0) return;

  for (const joinCopy of joinCopies) {
    const hostUid = String(joinCopy.planHostUid).trim();
    const joinerIds = collectJoinedIds(joinCopy);
    if (!joinerIds.has(joinerUid)) continue;

    const beforeCopy = beforeEvents.find((e) => matchesPlanEvent(e, joinCopy, beforeEvents));
    const beforeJoinerIds = beforeCopy ? collectJoinedIds(beforeCopy) : new Set();
    if (beforeJoinerIds.has(joinerUid) && beforeCopy) {
      const prevLoose = eventKeyLoose(beforeCopy);
      if (prevLoose === eventKeyLoose(joinCopy)) {
        const prevIds = [...beforeJoinerIds].sort().join("|");
        const nextIds = [...joinerIds].sort().join("|");
        if (prevIds === nextIds) continue;
      }
    }

    const allAttendeeIds = Array.from(
      new Set(
        [...joinerIds, hostUid, joinerUid]
          .map((id) => String(id || "").trim())
          .filter(Boolean)
      )
    );

    for (const targetUid of allAttendeeIds) {
      if (targetUid === joinerUid) continue;
      try {
        const updated = await mergeRosterOntoUser(
          db,
          targetUid,
          joinCopy,
          allAttendeeIds,
          hostUid
        );
        if (updated) {
          logInfo("openPlanSync_interest_merged", { hostUid, joinerUid, targetUid });
        }
      } catch (e) {
        logError("openPlanSync_interest_merge", e, { hostUid, joinerUid, targetUid });
      }
    }
  }
}

/**
 * When a host deletes a plan, remove matching copies from interested friends (and listed attendees).
 */
async function cascadeDeletedPlans(db, hostUid, beforeEvents, afterEvents) {
  const removed = findRemovedHostedPlans(hostUid, beforeEvents, afterEvents);
  if (removed.length === 0) return;

  const targetUids = new Set();
  for (const ev of removed) {
    for (const id of collectJoinedIds(ev)) {
      if (id !== hostUid) targetUids.add(id);
    }
    await revokePendingInvitesForPlan(db, hostUid, ev);
  }

  try {
    const friendsSnap = await db.collection("users").doc(hostUid).collection("friends").get();
    friendsSnap.docs.forEach((d) => targetUids.add(d.id));
  } catch (e) {
    logError("openPlanSync_friends_list", e, { hostUid });
  }
  targetUids.delete(hostUid);

  for (const targetUid of targetUids) {
    try {
      const targetRef = db.collection("users").doc(targetUid);
      const targetSnap = await targetRef.get();
      if (!targetSnap.exists) continue;

      let events = Array.isArray(targetSnap.data()?.events) ? targetSnap.data().events : [];
      let next = events;
      for (const rem of removed) {
        const filtered = next.filter((e) => !matchesPlanEvent(e, rem, next));
        if (filtered.length !== next.length) next = filtered;
      }
      if (next.length === events.length) continue;

      await targetRef.update({ events: next });
      logInfo("openPlanSync_plan_removed", { hostUid, targetUid });
    } catch (e) {
      logError("openPlanSync_cascade_delete", e, { hostUid, targetUid });
    }
  }
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} userId
 * @param {object[]} beforeEvents
 * @param {object[]} afterEvents
 */
async function handleUserEventsChange(db, userId, beforeEvents, afterEvents) {
  if (JSON.stringify(beforeEvents) === JSON.stringify(afterEvents)) return;

  await syncUnjoinFromAttendees(db, userId, beforeEvents, afterEvents);
  await syncJoinerInterestToAttendees(db, userId, beforeEvents, afterEvents);
  await cascadeDeletedPlans(db, userId, beforeEvents, afterEvents);
}

module.exports = {
  eventKey,
  eventKeyLoose,
  matchesPlanEvent,
  collectJoinedIds,
  findHostPlanIndex,
  findMatchingPlanIndex,
  findRemovedHostedPlans,
  handleUserEventsChange,
};
