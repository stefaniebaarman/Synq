/** @jest-environment node */

const {
  buildAmbassadorShareWebUrl,
  isValidAmbassadorCodeShape,
  normalizeAmbassadorCode,
  parseAmbassadorCodeFromClipboard,
  parseAmbassadorCodeFromReferrer,
  parseAmbassadorCodeFromUrl,
} = require("../src/lib/ambassadorReferralCore.js");

describe("ambassador referral helpers", () => {
  test("normalize and validate codes", () => {
    expect(normalizeAmbassadorCode(" duke-aepi ")).toBe("DUKE-AEPI");
    expect(isValidAmbassadorCodeShape("DUKE-AEPI")).toBe(true);
    expect(isValidAmbassadorCodeShape("A")).toBe(false);
    expect(isValidAmbassadorCodeShape("-BAD")).toBe(false);
  });

  test("buildAmbassadorShareWebUrl", () => {
    expect(buildAmbassadorShareWebUrl("https://join.synq.app", "duke-aepi")).toBe(
      "https://join.synq.app/a/DUKE-AEPI"
    );
  });

  test("parseAmbassadorCodeFromUrl", () => {
    expect(parseAmbassadorCodeFromUrl("https://join.synq.app/a/duke-aepi")).toBe(
      "DUKE-AEPI"
    );
    expect(parseAmbassadorCodeFromUrl("synq://a/XYZ-123")).toBe("XYZ-123");
    expect(parseAmbassadorCodeFromUrl("https://join.synq.app/u/ABC1234")).toBeNull();
  });

  test("parseAmbassadorCodeFromClipboard", () => {
    expect(parseAmbassadorCodeFromClipboard("SYNQ-A:DUKE-AEPI")).toBe("DUKE-AEPI");
    expect(parseAmbassadorCodeFromClipboard("random text")).toBeNull();
  });

  test("parseAmbassadorCodeFromReferrer", () => {
    expect(
      parseAmbassadorCodeFromReferrer(
        "utm_source=ambassador&utm_content=DUKE-AEPI&ambassador=DUKE-AEPI"
      )
    ).toBe("DUKE-AEPI");
    expect(parseAmbassadorCodeFromReferrer("utm_source=google")).toBeNull();
  });
});
