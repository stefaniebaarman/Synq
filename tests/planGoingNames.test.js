const {
  formatTruncatedGoingLine,
  firstNameFromDisplay,
} = require("../src/lib/planGoingNames.js");

describe("planGoingNames", () => {
  test("firstNameFromDisplay takes first token", () => {
    expect(firstNameFromDisplay("Blake Smith")).toBe("Blake");
  });

  test("formats one person", () => {
    expect(formatTruncatedGoingLine(["Blake Smith"])).toBe("Blake is going");
  });

  test("formats two people", () => {
    expect(formatTruncatedGoingLine(["Blake", "Elliott"])).toBe(
      "Blake and Elliott are going"
    );
  });

  test("formats three people", () => {
    expect(formatTruncatedGoingLine(["Blake", "Elliott", "Maya"])).toBe(
      "Blake, Elliott and Maya are going"
    );
  });

  test("truncates four or more", () => {
    expect(
      formatTruncatedGoingLine(["Blake", "Elliott", "Maya", "Stef"])
    ).toBe("Blake, Elliott, Maya and 1 more are going");
  });
});
