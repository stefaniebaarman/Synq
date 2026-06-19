/** @typedef {"all" | "groups"} SynqBroadcastMode */

/** @typedef {{ mode: SynqBroadcastMode, groupIds: string[] }} SynqAudienceSelection */

/** @typedef {{ id: string, name: string, memberIds: string[] }} FriendGroupLike */

/** When true, active list uses reciprocal visibility (Option B). Default: Option A. */
const SYNQ_RECIPROCAL_INBOUND = false;

/**
 * @param {SynqAudienceSelection} selection
 * @param {FriendGroupLike[]} groups
 * @param {string[]} allFriendIds
 */
function resolveSynqVisibleTo(selection, groups, allFriendIds) {
  if (selection.mode === "all") {
    return [...new Set(allFriendIds.map((id) => String(id || "").trim()).filter(Boolean))];
  }
  const visible = new Set();
  for (const gid of selection.groupIds) {
    const group = groups.find((g) => g.id === gid);
    if (!group) continue;
    group.memberIds.forEach((id) => {
      const trimmed = String(id || "").trim();
      if (trimmed) visible.add(trimmed);
    });
  }
  return [...visible];
}

/**
 * @param {SynqAudienceSelection} selection
 * @param {FriendGroupLike[]} groups
 * @param {string[]} allFriendIds
 */
function buildSynqBroadcastFirestorePayload(selection, groups, allFriendIds) {
  return {
    synqBroadcastMode: selection.mode,
    synqBroadcastGroupIds: selection.mode === "groups" ? selection.groupIds : [],
    synqVisibleTo: resolveSynqVisibleTo(selection, groups, allFriendIds),
  };
}

/**
 * @param {Record<string, unknown> | null | undefined} userData
 * @param {string[]} allFriendIds
 */
function getMyAudienceSet(userData, allFriendIds) {
  const mode = String(userData?.synqBroadcastMode ?? "all");
  if (mode !== "groups") {
    return new Set(allFriendIds.map((id) => String(id || "").trim()).filter(Boolean));
  }
  const visible = userData?.synqVisibleTo;
  if (Array.isArray(visible)) {
    return new Set(visible.map((id) => String(id || "").trim()).filter(Boolean));
  }
  return new Set();
}

/**
 * @param {Record<string, unknown> | null | undefined} friendData
 * @param {string} viewerId
 */
function viewerInFriendAudience(friendData, viewerId) {
  if (!viewerId) return false;
  const mode = String(friendData?.synqBroadcastMode ?? "all");
  if (mode !== "groups") return true;
  const visible = friendData?.synqVisibleTo;
  if (!Array.isArray(visible) || visible.length === 0) return true;
  return visible.some((id) => String(id) === viewerId);
}

/**
 * @param {{ id: string }[]} activeFriends
 * @param {{ myAudience: Set<string>, viewerId: string, reciprocal?: boolean }} options
 */
function filterActiveFriendsForInbound(activeFriends, options) {
  const { myAudience, viewerId, reciprocal = SYNQ_RECIPROCAL_INBOUND } = options;
  return activeFriends.filter((f) => {
    const fid = String(f.id ?? "").trim();
    if (!fid || !myAudience.has(fid)) return false;
    if (!reciprocal) return true;
    return viewerInFriendAudience(f, viewerId);
  });
}

/**
 * @param {string} recipientId
 * @param {Record<string, unknown> | null | undefined} activatedUserData
 */
function isRecipientInSynqVisibleTo(recipientId, activatedUserData) {
  const mode = String(activatedUserData?.synqBroadcastMode ?? "all");
  if (mode !== "groups") return true;
  const visible = activatedUserData?.synqVisibleTo;
  if (!Array.isArray(visible)) return true;
  return visible.some((id) => String(id) === String(recipientId));
}

module.exports = {
  SYNQ_RECIPROCAL_INBOUND,
  resolveSynqVisibleTo,
  buildSynqBroadcastFirestorePayload,
  getMyAudienceSet,
  viewerInFriendAudience,
  filterActiveFriendsForInbound,
  isRecipientInSynqVisibleTo,
};
