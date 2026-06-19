/**
 * Server-side open-plan sync: clients can only write their own user doc (firestore.rules),
 * so interest and deletions must be propagated with admin privileges.
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

/**
 * When a friend leaves a hosted plan, remove them from the host's joinedFromIds.
 */
async function syncUnjoinFromHosts(db, joinerUid, beforeEvents, afterEvents) {
  const beforeJoinCopies = beforeEvents.filter((e) => {
    const host = String(e?.planHostUid || "").trim();
    return host && host !== joinerUid;
  });
  if (beforeJoinCopies.length === 0) return;

  for (const beforeCopy of beforeJoinCopies) {
    if (joinerStillOnHostedPlan(joinerUid, beforeCopy, afterEvents)) continue;

    const hostUid = String(beforeCopy.planHostUid).trim();
    try {
      const hostRef = db.collection("users").doc(hostUid);
      const hostSnap = await hostRef.get();
      if (!hostSnap.exists) continue;

      let hostEvents = Array.isArray(hostSnap.data()?.events) ? [...hostSnap.data().events] : [];
      const idx = findHostPlanIndex(hostEvents, beforeCopy, hostUid);
      if (idx < 0) continue;

      const hostEv = hostEvents[idx];
      const existingIds = collectJoinedIds(hostEv);
      if (!existingIds.has(joinerUid)) continue;

      existingIds.delete(joinerUid);
      const mergedIds = Array.from(existingIds);
      const displayNameById = await loadDisplayNames(db, mergedIds);
      const otherNames = mergedIds
        .filter((id) => id !== hostUid)
        .map((id) => displayNameById[id])
        .filter(Boolean);

      hostEvents[idx] = {
        ...hostEv,
        joinedFromIds: mergedIds,
        joinedFromId: mergedIds[0] || "",
        joinedFromNames: otherNames,
        joinedFromName: otherNames.join(", "),
      };

      await hostRef.update({ events: hostEvents });
      logInfo("openPlanSync_unjoin_merged", { hostUid, joinerUid });
    } catch (e) {
      logError("openPlanSync_unjoin", e, { hostUid, joinerUid });
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

/**
 * When a friend joins a plan, merge their interest onto the host's calendar (triggers push via onOpenPlanInterest).
 */
async function syncJoinerInterestToHosts(db, joinerUid, beforeEvents, afterEvents) {
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

    try {
      const hostRef = db.collection("users").doc(hostUid);
      const hostSnap = await hostRef.get();
      if (!hostSnap.exists) continue;

      let hostEvents = Array.isArray(hostSnap.data()?.events) ? [...hostSnap.data().events] : [];
      const idx = findHostPlanIndex(hostEvents, joinCopy, hostUid);
      if (idx < 0) continue;

      const hostEv = hostEvents[idx];
      const existingIds = new Set(
        [...collectJoinedIds(hostEv), hostUid, joinerUid]
          .map((x) => String(x).trim())
          .filter(Boolean)
      );
      for (const id of joinerIds) existingIds.add(id);

      const mergedIds = Array.from(existingIds);
      const displayNameById = await loadDisplayNames(db, mergedIds);
      const otherNames = mergedIds
        .filter((id) => id !== hostUid)
        .map((id) => displayNameById[id])
        .filter(Boolean);
      const orderedIds = [hostUid, ...mergedIds.filter((id) => id !== hostUid)];

      const prevKey = [...collectJoinedIds(hostEv)].map(String).sort().join("|");
      const nextKey = orderedIds.slice().sort().join("|");
      const prevNamesStr = (Array.isArray(hostEv.joinedFromNames)
        ? hostEv.joinedFromNames
        : [hostEv.joinedFromName]
      )
        .filter(Boolean)
        .map(String)
        .sort()
        .join("|");
      const nextNamesStr = otherNames.slice().sort().join("|");
      if (prevKey === nextKey && prevNamesStr === nextNamesStr) continue;

      hostEvents[idx] = {
        ...hostEv,
        planHostUid: hostUid,
        joinedFromIds: orderedIds,
        joinedFromId: hostUid,
        joinedFromNames: otherNames,
        joinedFromName: otherNames.join(", "),
      };
      delete hostEvents[idx].joinedFromFriendUid;

      await hostRef.update({ events: hostEvents });
      logInfo("openPlanSync_interest_merged", { hostUid, joinerUid });
    } catch (e) {
      logError("openPlanSync_interest_merge", e, { hostUid, joinerUid });
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

  await syncUnjoinFromHosts(db, userId, beforeEvents, afterEvents);
  await syncJoinerInterestToHosts(db, userId, beforeEvents, afterEvents);
  await cascadeDeletedPlans(db, userId, beforeEvents, afterEvents);
}

module.exports = {
  eventKey,
  eventKeyLoose,
  matchesPlanEvent,
  collectJoinedIds,
  findHostPlanIndex,
  findRemovedHostedPlans,
  handleUserEventsChange,
};
