const MAX_VISIBLE_GOING_NAMES = 3;

function firstNameFromDisplay(name) {
  return String(name || "").trim().split(/\s+/)[0] || "";
}

function parseDisplayName(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const first = parts[0] || "";
  const last = parts.slice(1).join(" ");
  return { first, last, full: String(name || "").trim() };
}

/**
 * Labels for the going preview. Unique first names stay as first name only.
 * Shared first names use the full last name so people are never collapsed.
 */
function disambiguateGoingLabels(names) {
  const parsed = (Array.isArray(names) ? names : [])
    .map(parseDisplayName)
    .filter((p) => p.first);

  const firstCounts = new Map();
  for (const p of parsed) {
    const key = p.first.toLowerCase();
    firstCounts.set(key, (firstCounts.get(key) || 0) + 1);
  }

  return parsed.map((p) => {
    const firstKey = p.first.toLowerCase();
    if ((firstCounts.get(firstKey) || 0) < 2) return p.first;
    if (p.last) return `${p.first} ${p.last}`;
    return p.first;
  });
}

/** Truncated "X, Y and N more are going" line for plan cards. */
function formatTruncatedGoingLine(names) {
  const labels = disambiguateGoingLabels(names);
  if (labels.length === 0) return null;
  if (labels.length === 1) return `${labels[0]} is going`;
  if (labels.length === 2) return `${labels[0]} and ${labels[1]} are going`;
  if (labels.length === 3) {
    return `${labels[0]}, ${labels[1]} and ${labels[2]} are going`;
  }
  const visible = labels.slice(0, MAX_VISIBLE_GOING_NAMES);
  const remaining = labels.length - MAX_VISIBLE_GOING_NAMES;
  return `${visible.join(", ")} and ${remaining} more are going`;
}

/** "You and X are going" when the viewer joined someone else's plan. */
function formatYouAndGoingLine(names) {
  const labels = disambiguateGoingLabels(names);
  if (labels.length === 0) return "You are going";
  if (labels.length === 1) return `You and ${labels[0]} are going`;
  if (labels.length === 2) {
    return `You, ${labels[0]} and ${labels[1]} are going`;
  }
  if (labels.length === 3) {
    return `You, ${labels[0]}, ${labels[1]} and ${labels[2]} are going`;
  }
  const visible = labels.slice(0, MAX_VISIBLE_GOING_NAMES);
  const remaining = labels.length - MAX_VISIBLE_GOING_NAMES;
  return `You, ${visible.join(", ")} and ${remaining} more are going`;
}

/**
 * Compact going line: "3 others are going".
 */
function formatOthersGoingLine(count) {
  const n = Math.max(0, Number(count) || 0);
  if (n <= 0) return null;
  if (n === 1) return "1 other is going";
  return `${n} others are going`;
}

module.exports = {
  MAX_VISIBLE_GOING_NAMES,
  firstNameFromDisplay,
  disambiguateGoingLabels,
  formatTruncatedGoingLine,
  formatYouAndGoingLine,
  formatOthersGoingLine,
};
