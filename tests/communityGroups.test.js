const { mergeCommunityGroupMemberIds } = require("../src/lib/communityGroupsCore.js");

describe("communityGroups", () => {
  test("mergeCommunityGroupMemberIds dedupes and preserves order", () => {
    expect(mergeCommunityGroupMemberIds(["a", "b"], ["b", "c"])).toEqual(["a", "b", "c"]);
  });

  test("mergeCommunityGroupMemberIds caps at max members", () => {
    const current = Array.from({ length: 498 }, (_, i) => `u${i}`);
    const merged = mergeCommunityGroupMemberIds(current, ["new1", "new2", "new3", "new4"]);
    expect(merged).toHaveLength(500);
    expect(merged).toContain("new1");
    expect(merged).toContain("new2");
  });
});
