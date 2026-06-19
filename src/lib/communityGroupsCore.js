const MAX_COMMUNITY_GROUP_MEMBERS = 500;

function normalizeMemberIds(memberIds) {
  return [...new Set(memberIds.map((id) => String(id || "").trim()).filter(Boolean))].slice(
    0,
    MAX_COMMUNITY_GROUP_MEMBERS
  );
}

function mergeCommunityGroupMemberIds(currentMemberIds, newMemberIds) {
  return normalizeMemberIds([...currentMemberIds, ...newMemberIds]);
}

module.exports = {
  MAX_COMMUNITY_GROUP_MEMBERS,
  mergeCommunityGroupMemberIds,
  normalizeMemberIds,
};
