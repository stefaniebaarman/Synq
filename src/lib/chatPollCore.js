/** Shared chat poll helpers (client + Jest). */

const MIN_POLL_OPTIONS = 2;
const MAX_POLL_OPTIONS = 5;
const MAX_POLL_QUESTION_LENGTH = 140;
const MAX_POLL_OPTION_LENGTH = 60;

function isPollMessage(item) {
  return item?.type === "poll";
}

function normalizePollOptions(options) {
  if (!Array.isArray(options)) return [];
  const seen = new Set();
  const next = [];
  for (const raw of options) {
    const text = String(raw ?? "").trim();
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(text.slice(0, MAX_POLL_OPTION_LENGTH));
    if (next.length >= MAX_POLL_OPTIONS) break;
  }
  return next;
}

function validatePollDraft(question, options) {
  const trimmedQuestion = String(question ?? "").trim();
  if (!trimmedQuestion) {
    return { ok: false, reason: "Add a question for your poll." };
  }
  if (trimmedQuestion.length > MAX_POLL_QUESTION_LENGTH) {
    return { ok: false, reason: "Keep the question a bit shorter." };
  }
  const normalized = normalizePollOptions(options);
  if (normalized.length < MIN_POLL_OPTIONS) {
    return {
      ok: false,
      reason: `Add at least ${MIN_POLL_OPTIONS} options.`,
    };
  }
  return { ok: true, question: trimmedQuestion.slice(0, MAX_POLL_QUESTION_LENGTH), options: normalized };
}

function parsePollVotes(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const votes = {};
  for (const [uid, value] of Object.entries(raw)) {
    const index = typeof value === "number" ? value : Number(value);
    if (!uid || !Number.isInteger(index) || index < 0) continue;
    votes[uid] = index;
  }
  return votes;
}

function pollVoteCounts(optionCount, votes) {
  const counts = Array.from({ length: Math.max(0, optionCount) }, () => 0);
  for (const index of Object.values(parsePollVotes(votes))) {
    if (index >= 0 && index < counts.length) counts[index] += 1;
  }
  return counts;
}

function pollVoteTotal(votes) {
  return Object.keys(parsePollVotes(votes)).length;
}

function pollPreviewText(question) {
  const trimmed = String(question ?? "").trim();
  if (!trimmed) return "Poll";
  return `Poll: ${trimmed}`;
}

module.exports = {
  MIN_POLL_OPTIONS,
  MAX_POLL_OPTIONS,
  MAX_POLL_QUESTION_LENGTH,
  MAX_POLL_OPTION_LENGTH,
  isPollMessage,
  normalizePollOptions,
  validatePollDraft,
  parsePollVotes,
  pollVoteCounts,
  pollVoteTotal,
  pollPreviewText,
};
