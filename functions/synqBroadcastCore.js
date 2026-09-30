/** Server-side synq/drop-in audience helpers (keep in sync with src/lib/synqBroadcastCore.js). */

function isRecipientInSynqVisibleTo(recipientId, activatedUserData) {
  const mode = String(activatedUserData?.synqBroadcastMode ?? "all");
  if (mode !== "groups") return true;
  const visible = activatedUserData?.synqVisibleTo;
  if (!Array.isArray(visible)) return true;
  return visible.some((id) => String(id) === String(recipientId));
}

/**
 * @param {{ mode: "all" | "groups", groupIds: string[] }} selection
 * @param {{ id: string, name: string, memberIds: string[] }[]} groups
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

module.exports = { isRecipientInSynqVisibleTo, resolveSynqVisibleTo };
