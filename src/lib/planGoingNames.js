const MAX_VISIBLE_GOING_NAMES = 3;

function firstNameFromDisplay(name) {
  return String(name || "").trim().split(/\s+/)[0] || "";
}

/** Truncated "X, Y and N more are going" line for plan cards. */
function formatTruncatedGoingLine(names) {
  const firsts = Array.from(
    new Set(names.map(firstNameFromDisplay).filter(Boolean))
  );
  if (firsts.length === 0) return null;
  if (firsts.length === 1) return `${firsts[0]} is going`;
  if (firsts.length === 2) return `${firsts[0]} and ${firsts[1]} are going`;
  if (firsts.length === 3) {
    return `${firsts[0]}, ${firsts[1]} and ${firsts[2]} are going`;
  }
  const visible = firsts.slice(0, MAX_VISIBLE_GOING_NAMES);
  const remaining = firsts.length - MAX_VISIBLE_GOING_NAMES;
  return `${visible.join(", ")} and ${remaining} more are going`;
}

module.exports = {
  MAX_VISIBLE_GOING_NAMES,
  firstNameFromDisplay,
  formatTruncatedGoingLine,
};
