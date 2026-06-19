/** Copy to functions/contentFilter.js locally (gitignored). Do not commit real terms here. */
const BLOCKED_TERMS = [];
const LEET_MAP = {
  "@": "a",
  "4": "a",
  "3": "e",
  "1": "i",
  "!": "i",
  "0": "o",
  $: "s",
  "5": "s",
  "7": "t",
};

function normalizeForFilter(input) {
  let s = String(input || "").toLowerCase();
  s = s.replace(/[\s_\-.*]+/g, "");
  s = s
    .split("")
    .map((ch) => LEET_MAP[ch] ?? ch)
    .join("");
  s = s.replace(/[^a-z0-9]/g, "");
  return s.replace(/(.)\1{2,}/g, "$1$1");
}

function containsObjectionableContent(text) {
  const normalized = normalizeForFilter(text);
  if (!normalized) return false;
  return BLOCKED_TERMS.some((term) => normalized.includes(term));
}

function filterOrReject(text) {
  if (containsObjectionableContent(text)) {
    return {
      ok: false,
      reason: "This content isn't allowed on Synq. Please remove offensive language.",
    };
  }
  return { ok: true };
}

module.exports = {
  containsObjectionableContent,
  normalizeForFilter,
  filterOrReject,
};
