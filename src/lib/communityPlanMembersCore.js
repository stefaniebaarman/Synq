/**
 * @param {import("./communityGroupPlans").CommunityGroupPlan | {
 *   creatorId: string;
 *   creatorDisplayName?: string;
 *   goingMemberIds: string[];
 * }} plan
 * @param {Record<string, { id: string; displayName?: string; imageurl?: string; synqActive?: boolean }>} memberProfiles
 */
function resolvePlanGoers(plan, memberProfiles) {
  const seen = new Set();
  const rows = [];

  for (const memberId of plan.goingMemberIds || []) {
    const id = String(memberId || "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const profile = memberProfiles[id];
    rows.push({
      id,
      displayName: profile?.displayName?.trim() || "Member",
      imageurl: profile?.imageurl,
      synqActive: profile?.synqActive,
    });
  }

  if (plan.creatorId && !seen.has(plan.creatorId)) {
    const profile = memberProfiles[plan.creatorId];
    rows.unshift({
      id: plan.creatorId,
      displayName:
        profile?.displayName?.trim() || String(plan.creatorDisplayName || "").trim() || "Member",
      imageurl: profile?.imageurl,
      synqActive: profile?.synqActive,
    });
  }

  return rows;
}

function formatGoerNamesLabel(names, viewerName = "You") {
  const viewer = String(viewerName || "You").trim() || "You";
  const others = names
    .map((name) => String(name || "").trim())
    .filter((name) => name && name !== viewer);
  if (others.length === 0) return "You joined";
  if (others.length === 1) return `Joined with ${others[0]}`;
  if (others.length === 2) return `Joined with ${others[0]} and ${others[1]}`;
  return `Joined with ${others[0]} and ${others.length - 1} others`;
}

function formatPlanGoerPreview(goers, maxNames = 2) {
  if (!goers.length) return "No one going yet";
  const names = goers.map((g) => g.displayName);
  if (goers.length === 1) return names[0];
  if (goers.length <= maxNames) {
    return names.length === 2 ? `${names[0]} and ${names[1]}` : names[0];
  }
  return `${names[0]} + ${goers.length - 1}`;
}

module.exports = {
  resolvePlanGoers,
  formatGoerNamesLabel,
  formatPlanGoerPreview,
};
