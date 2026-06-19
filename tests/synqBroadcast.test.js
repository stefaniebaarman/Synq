const {
  buildSynqBroadcastFirestorePayload,
  filterActiveFriendsForInbound,
  isRecipientInSynqVisibleTo,
  resolveSynqVisibleTo,
  viewerInFriendAudience,
} = require("../src/lib/synqBroadcastCore");

function isSynqActiveForTest(userData) {
  if (!userData || userData.status !== "available" || !userData.synqStartedAt) return false;
  const startTime = userData.synqStartedAt.toDate().getTime();
  const hoursElapsed = (Date.now() - startTime) / (1000 * 60 * 60);
  return hoursElapsed <= 12;
}

function formatSynqAudienceLabel(userData, groups) {
  if (!userData || !isSynqActiveForTest(userData)) return null;
  const mode = String(userData.synqBroadcastMode ?? "all");
  if (mode !== "groups") return "All friends";
  const ids = userData.synqBroadcastGroupIds;
  if (!Array.isArray(ids) || ids.length === 0) return "Groups";
  const names = ids
    .map((id) => groups.find((g) => g.id === String(id))?.name)
    .filter(Boolean);
  if (names.length === 0) return "Groups";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return `${names.length} groups`;
}

describe("synqBroadcast", () => {
  const groups = [
    { id: "g1", name: "Roommates", memberIds: ["a", "b"], sortOrder: 0 },
    { id: "g2", name: "Work", memberIds: ["b", "c"], sortOrder: 1 },
    { id: "g3", name: "Empty", memberIds: [], sortOrder: 2 },
  ];
  const allFriends = ["a", "b", "c", "d"];

  test("resolves all friends mode", () => {
    const visible = resolveSynqVisibleTo({ mode: "all", groupIds: [] }, groups, allFriends);
    expect(visible.sort()).toEqual(allFriends.sort());
  });

  test("unions members across selected groups", () => {
    const visible = resolveSynqVisibleTo(
      { mode: "groups", groupIds: ["g1", "g2"] },
      groups,
      allFriends
    );
    expect(visible.sort()).toEqual(["a", "b", "c"].sort());
  });

  test("builds firestore payload for groups mode", () => {
    const payload = buildSynqBroadcastFirestorePayload(
      { mode: "groups", groupIds: ["g1"] },
      groups,
      allFriends
    );
    expect(payload.synqBroadcastMode).toBe("groups");
    expect(payload.synqBroadcastGroupIds).toEqual(["g1"]);
    expect(payload.synqVisibleTo.sort()).toEqual(["a", "b"]);
  });

  test("filters push recipients by synqVisibleTo", () => {
    const activated = {
      synqBroadcastMode: "groups",
      synqVisibleTo: ["a", "b"],
    };
    expect(isRecipientInSynqVisibleTo("a", activated)).toBe(true);
    expect(isRecipientInSynqVisibleTo("d", activated)).toBe(false);
    expect(isRecipientInSynqVisibleTo("d", { synqBroadcastMode: "all" })).toBe(true);
  });

  test("filters active friends to audience (Option A)", () => {
    const active = [
      { id: "a", synqBroadcastMode: "all" },
      { id: "b", synqBroadcastMode: "groups", synqVisibleTo: ["x"] },
      { id: "c" },
    ];
    const filtered = filterActiveFriendsForInbound(active, {
      myAudience: new Set(["a", "b"]),
      viewerId: "me",
      reciprocal: false,
    });
    expect(filtered.map((f) => f.id)).toEqual(["a", "b"]);
  });

  test("applies reciprocal visibility when enabled", () => {
    const active = [
      { id: "a", synqBroadcastMode: "all" },
      { id: "b", synqBroadcastMode: "groups", synqVisibleTo: ["me"] },
      { id: "c", synqBroadcastMode: "groups", synqVisibleTo: ["other"] },
    ];
    const filtered = filterActiveFriendsForInbound(active, {
      myAudience: new Set(["a", "b", "c"]),
      viewerId: "me",
      reciprocal: true,
    });
    expect(filtered.map((f) => f.id)).toEqual(["a", "b"]);
  });

  test("viewerInFriendAudience respects friend broadcast list", () => {
    expect(viewerInFriendAudience({ synqBroadcastMode: "all" }, "me")).toBe(true);
    expect(
      viewerInFriendAudience(
        { synqBroadcastMode: "groups", synqVisibleTo: ["me", "x"] },
        "me"
      )
    ).toBe(true);
    expect(
      viewerInFriendAudience(
        { synqBroadcastMode: "groups", synqVisibleTo: ["x"] },
        "me"
      )
    ).toBe(false);
  });

  test("formats audience label for widget", () => {
    const activeUser = {
      status: "available",
      synqStartedAt: { toDate: () => new Date() },
      synqBroadcastMode: "groups",
      synqBroadcastGroupIds: ["g1", "g2"],
    };
    expect(formatSynqAudienceLabel(activeUser, groups)).toBe("Roommates & Work");
  });
});
