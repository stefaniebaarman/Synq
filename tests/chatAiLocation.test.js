const {
  buildLocationPrompt,
  maxPairwiseDistanceKm,
  participantsWithinAiRange,
  uniqueLocationLabels,
  CHAT_AI_MAX_DISTANCE_MILES,
} = require("../src/lib/chatAiLocationCore");

describe("chatAiLocation", () => {
  test("buildLocationPrompt joins two metro areas", () => {
    expect(
      buildLocationPrompt(["Washington, DC", "Arlington, VA"])
    ).toBe("Washington, DC and Arlington, VA");
  });

  test("uniqueLocationLabels dedupes same city", () => {
    const labels = uniqueLocationLabels([
      { city: "Washington", state: "DC" },
      { city: "Washington", state: "DC", lat: 38.9, lng: -77.0 },
    ]);
    expect(labels).toEqual(["Washington, DC"]);
  });

  test("participantsWithinAiRange respects 20 mile cap", () => {
    const twentyMilesKm = CHAT_AI_MAX_DISTANCE_MILES * 1.609344;
    expect(participantsWithinAiRange(twentyMilesKm)).toBe(true);
    expect(participantsWithinAiRange(twentyMilesKm + 0.01)).toBe(false);
  });

  test("maxPairwiseDistanceKm for single participant is zero", () => {
    expect(
      maxPairwiseDistanceKm([{ lat: 38.9, lng: -77.0 }], () => 999)
    ).toBe(0);
  });
});
