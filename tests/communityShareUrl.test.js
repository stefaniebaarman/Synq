/** @jest-environment node */

const {
  buildCommunityShareWebUrl,
  parseCommunityShareCodeFromUrl,
} = require("../src/lib/communityShareUrlCore.js");

describe("community share URLs", () => {
  test("buildCommunityShareWebUrl encodes code", () => {
    expect(buildCommunityShareWebUrl("https://join.synq.app", "abC1234")).toBe(
      "https://join.synq.app/c/ABC1234"
    );
  });

  test("parseCommunityShareCodeFromUrl reads /c/{code}", () => {
    expect(parseCommunityShareCodeFromUrl("https://join.synq.app/c/abc1234")).toBe(
      "ABC1234"
    );
    expect(parseCommunityShareCodeFromUrl("synq://c/xyz9876")).toBe("XYZ9876");
  });

  test("parseCommunityShareCodeFromUrl ignores unrelated paths", () => {
    expect(parseCommunityShareCodeFromUrl("https://join.synq.app/u/ABC1234")).toBeNull();
    expect(parseCommunityShareCodeFromUrl("https://join.synq.app/open")).toBeNull();
  });
});
