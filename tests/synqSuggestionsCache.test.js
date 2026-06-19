const {
  buildSuggestionCacheKey,
  buildVenueCacheKey,
  hashCacheKey,
} = require("../functions/synqSuggestionsCache");

describe("synqSuggestionsCache", () => {
  test("buildSuggestionCacheKey normalizes location, category, and interests", () => {
    expect(
      buildSuggestionCacheKey(" Austin , TX ", " Dinner ", ["Coffee", "Hiking"])
    ).toBe("austin, tx::dinner::coffee|hiking");
  });

  test("buildSuggestionCacheKey sorts interests for stable keys", () => {
    const a = buildSuggestionCacheKey("Austin", "Chill", ["b", "a"]);
    const b = buildSuggestionCacheKey("Austin", "Chill", ["a", "b"]);
    expect(a).toBe(b);
  });

  test("buildVenueCacheKey normalizes venue name and location", () => {
    expect(buildVenueCacheKey("  Jo's Coffee ", " Austin, TX ")).toBe(
      "jo's coffee::austin, tx"
    );
  });

  test("hashCacheKey is stable", () => {
    const key = buildSuggestionCacheKey("Austin", "Dinner", ["coffee"]);
    expect(hashCacheKey(key)).toBe(hashCacheKey(key));
    expect(hashCacheKey(key)).toHaveLength(40);
  });
});
