const {
  MIN_POLL_OPTIONS,
  MAX_POLL_OPTIONS,
  isPollMessage,
  normalizePollOptions,
  validatePollDraft,
  parsePollVotes,
  pollVoteCounts,
  pollVoteTotal,
  pollPreviewText,
} = require("../src/lib/chatPollCore.js");

describe("chatPoll", () => {
  test("isPollMessage only matches type poll", () => {
    expect(isPollMessage({ type: "poll" })).toBe(true);
    expect(isPollMessage({ type: "aiSuggestion" })).toBe(false);
    expect(isPollMessage({ text: "Poll: lunch?" })).toBe(false);
  });

  test("normalizePollOptions trims, drops blanks, and caps at 5", () => {
    expect(
      normalizePollOptions(["  Pizza  ", "", "Tacos", "pizza", "Sushi", "Thai", "Burgers"])
    ).toEqual(["Pizza", "Tacos", "Sushi", "Thai", "Burgers"]);
  });

  test("validatePollDraft allows an empty question and requires at least two options", () => {
    expect(validatePollDraft("  ", ["A", "B"])).toEqual({
      ok: true,
      question: "",
      options: ["A", "B"],
    });
    expect(validatePollDraft("Lunch?", ["A"]).ok).toBe(false);
    expect(validatePollDraft("Lunch?", ["A", "B"]).ok).toBe(true);
    expect(MIN_POLL_OPTIONS).toBe(2);
    expect(MAX_POLL_OPTIONS).toBe(5);
  });

  test("poll vote helpers count by option index", () => {
    const votes = { a: 0, b: 1, c: 0, d: 9 };
    expect(parsePollVotes(votes)).toEqual({ a: 0, b: 1, c: 0, d: 9 });
    expect(pollVoteCounts(2, votes)).toEqual([2, 1]);
    expect(pollVoteTotal(votes)).toBe(4);
    expect(pollPreviewText("  Lunch?  ")).toBe("Poll: Lunch?");
  });
});
