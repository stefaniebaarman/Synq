const {
  collectJoinedIds,
  resolveEffectiveHostUid,
  planLooseMatch,
} = require("./planAttribution.js");

function eventKeyLoose(event) {
  return `${String(event?.title || "").trim().toLowerCase()}|${String(event?.date || "").trim()}`;
}

function parseOpenPlanDateTime(dateStr, timeStr) {
  const raw = String(dateStr || "").trim();
  const parts = raw.split("-").map(Number);
  const y = parts[0] || 1970;
  const m = parts[1] || 1;
  const d = parts[2] || 1;
  const date = new Date(y, m - 1, d);
  const timeRaw = String(timeStr || "").trim();
  if (!timeRaw) {
    date.setHours(12, 0, 0, 0);
    return date;
  }
  const match12 = timeRaw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = parseInt(match12[2], 10);
    const period = match12[3].toUpperCase();
    if (period === "PM" && hours !== 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;
    date.setHours(hours, minutes || 0, 0, 0);
    return date;
  }
  date.setHours(23, 59, 59, 999);
  return date;
}

function isOpenPlanPast(event, now = new Date()) {
  const dateStr = String(event?.date || "").trim();
  if (!dateStr) return false;
  const startMs = parseOpenPlanDateTime(dateStr, event?.time).getTime();
  return now.getTime() >= startMs + 12 * 60 * 60 * 1000;
}

function filterOutPastOpenPlans(events) {
  if (!Array.isArray(events)) return [];
  return events.filter((event) => !isOpenPlanPast(event));
}

function openPlanSortValue(event) {
  return parseOpenPlanDateTime(String(event?.date || ""), event?.time).getTime();
}

function planDedupeKey(event, hostUid) {
  const host = String(hostUid || "").trim() || "unknown";
  return `${host}|${eventKeyLoose(event)}`;
}

function hasJoinMetadata(event, joinedIds) {
  return (
    joinedIds.length > 1 ||
    !!event?.joinedFromId ||
    !!event?.joinedFromName ||
    (Array.isArray(event?.joinedFromNames) && event.joinedFromNames.length > 0) ||
    !!event?.joinedFromFriendUid
  );
}

/** Resolve who created/hosts an open plan row (may live on a joiner's profile). */
function resolveOpenPlanHostUid(event, profileFriendId) {
  const fid = String(profileFriendId || "").trim();
  const storedHost = String(event?.planHostUid || "").trim();
  const joinedIds = collectJoinedIds(event);

  if (!hasJoinMetadata(event, joinedIds)) {
    return storedHost || fid;
  }

  const probes = [];
  for (const id of joinedIds) {
    if (id !== fid) probes.push(id);
  }
  probes.push(...joinedIds, "");

  const seen = new Set();
  for (const probe of probes) {
    const key = String(probe);
    if (seen.has(key)) continue;
    seen.add(key);
    const host = resolveEffectiveHostUid(event, probe, joinedIds, fid);
    if (host) return host;
  }

  return storedHost || fid;
}

function findMatchingViewerEvent(event, viewerEvents) {
  if (!Array.isArray(viewerEvents)) return null;
  for (const row of viewerEvents) {
    if (planLooseMatch(row, event)) return row;
  }
  return null;
}

/**
 * True when the viewer is on the same plan but someone else is the real host.
 * Catches solo-shaped rows on a joiner's profile (e.g. Elliott hosting Shawn's plan).
 * Does not apply when the viewer joined through this friend's profile.
 */
function viewerContradictsFriendAsHost(event, viewerEvents, viewerId, profileFriendId) {
  const uid = String(viewerId || "").trim();
  const fid = String(profileFriendId || "").trim();
  if (!uid || !fid) return false;

  const viewerRow = findMatchingViewerEvent(event, viewerEvents);
  if (!viewerRow) return false;

  const joinedThrough = String(
    viewerRow?.joinedFromFriendUid || viewerRow?.joinedFromId || ""
  ).trim();
  if (joinedThrough === fid) return false;

  const viewerHost = resolveOpenPlanHostUid(viewerRow, uid);
  return !!(viewerHost && viewerHost !== fid);
}

function hostDisplayName(event, hostUid, friendById) {
  const hostFriend = friendById.get(hostUid);
  const fromFriend = String(hostFriend?.displayName || "").trim();
  if (fromFriend) return fromFriend;
  const fromEvent = String(event?.attendeeDisplayNames?.[hostUid] || "").trim();
  if (fromEvent) return fromEvent;
  return "Friend";
}

/**
 * Merge upcoming open plans from friends' profiles.
 * Only includes plans created/hosted by that friend (not plans they joined).
 */
function aggregateFriendPlans(friends, options = {}) {
  const blocked = options.blockedIds;
  const visibleFriends = friends.filter((friend) => !blocked?.has(friend.id));
  const friendIdSet = new Set(visibleFriends.map((friend) => friend.id));
  const friendById = new Map(visibleFriends.map((friend) => [friend.id, friend]));
  const seen = new Map();

  for (const friend of visibleFriends) {
    const rawEvents = Array.isArray(friend.events) ? friend.events : [];
    const upcoming = filterOutPastOpenPlans(rawEvents);

    for (const event of upcoming) {
      if (!event?.id || !event?.date || !event?.title) continue;

      const hostUid = resolveOpenPlanHostUid(event, friend.id);

      // Only show plans this friend created — skip rows where they are attending.
      if (hostUid !== friend.id) continue;

      if (
        viewerContradictsFriendAsHost(
          event,
          options.viewerEvents,
          options.viewerId,
          friend.id
        )
      ) {
        continue;
      }

      if (!friendIdSet.has(hostUid)) continue;

      const key = planDedupeKey(event, hostUid);
      const entry = {
        event,
        sourceFriendId: hostUid,
        sourceFriendName: hostDisplayName(event, hostUid, friendById),
      };

      if (!seen.has(key)) {
        seen.set(key, entry);
      }
    }
  }

  return [...seen.values()].sort(
    (a, b) => openPlanSortValue(a.event) - openPlanSortValue(b.event)
  );
}

/** @deprecated Use resolveOpenPlanHostUid + friendIdSet check instead. */
function isFriendHostedOpenPlan(event, friendId) {
  const hostUid = resolveOpenPlanHostUid(event, friendId);
  return hostUid === String(friendId || "").trim();
}

module.exports = {
  aggregateFriendPlans,
  isFriendHostedOpenPlan,
  resolveOpenPlanHostUid,
  viewerContradictsFriendAsHost,
};
