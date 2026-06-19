function friendIdsKey(ids) {
  return [...new Set(ids.map((id) => String(id || "").trim()).filter(Boolean))].sort().join("|");
}

describe("socialCache friendIdsKey", () => {
  test("sorts and dedupes ids", () => {
    expect(friendIdsKey(["b", "a", "b", ""])).toBe("a|b");
  });

  test("is stable regardless of input order", () => {
    expect(friendIdsKey(["c", "a", "b"])).toBe(friendIdsKey(["b", "c", "a"]));
  });
});
