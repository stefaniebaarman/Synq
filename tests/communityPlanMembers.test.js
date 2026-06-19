const {
  formatGoerNamesLabel,
  resolvePlanGoers,
} = require("../src/lib/communityPlanMembersCore.js");

describe("communityPlanMembers", () => {
  test("resolvePlanGoers includes creator and going members", () => {
    const plan = {
      id: "p1",
      groupId: "g1",
      creatorId: "host",
      creatorDisplayName: "Host",
      title: "Coffee",
      date: "2026-06-15",
      goingMemberIds: ["alice", "bob"],
    };
    const profiles = {
      host: { id: "host", displayName: "Host" },
      alice: { id: "alice", displayName: "Alice" },
      bob: { id: "bob", displayName: "Bob" },
    };

    expect(resolvePlanGoers(plan, profiles).map((row) => row.id)).toEqual([
      "host",
      "alice",
      "bob",
    ]);
  });

  test("formatGoerNamesLabel summarizes other goers", () => {
    expect(formatGoerNamesLabel(["You", "Alex", "Sam"], "You")).toBe(
      "Joined with Alex and Sam"
    );
  });
});
