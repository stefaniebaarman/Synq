/** @typedef {"open" | "private"} PlanVisibility */

/**
 * Private plans are only for the owner (Me → Your plans). Missing/unknown = open.
 * @param {any} event
 * @returns {boolean}
 */
function isPrivatePlan(event) {
  return String(event?.visibility || "").trim().toLowerCase() === "private";
}

/**
 * @param {any} event
 * @returns {boolean}
 */
function isOpenPlan(event) {
  return !isPrivatePlan(event);
}

/**
 * Drop private rows (for friend feeds / friend profiles). Missing visibility stays.
 * @template T
 * @param {T[] | null | undefined} events
 * @returns {T[]}
 */
function filterToOpenPlans(events) {
  if (!Array.isArray(events)) return [];
  return events.filter((event) => isOpenPlan(event));
}

/** Soft Synq confirm window: plan starts within this many ms. */
const SOON_PLAN_WINDOW_MS = 3 * 60 * 60 * 1000;

/**
 * @param {string} dateStr
 * @param {string} [timeStr]
 * @returns {Date}
 */
function parsePlanDateTime(dateStr, timeStr) {
  const raw = String(dateStr || "").trim();
  const parts = raw.split("-").map(Number);
  const y = parts[0] || 1970;
  const m = parts[1] || 1;
  const d = parts[2] || 1;
  const date = new Date(y, m - 1, d);
  const timeRaw = String(timeStr || "").trim();
  if (!timeRaw) {
    date.setHours(12, 0, 0, 0);
    return date;
  }
  const cleaned = timeRaw.replace(/\u202f/g, " ").trim();
  const match12 = cleaned.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = parseInt(match12[2], 10);
    const period = match12[3].toUpperCase();
    if (period === "PM" && hours !== 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;
    date.setHours(hours, minutes || 0, 0, 0);
    return date;
  }
  const match24 = cleaned.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    date.setHours(parseInt(match24[1], 10), parseInt(match24[2], 10), 0, 0);
    return date;
  }
  date.setHours(23, 59, 59, 999);
  return date;
}

/**
 * Earliest upcoming plan that starts within the soft window (not already past start).
 * @param {any[] | null | undefined} events
 * @param {{ now?: Date, windowMs?: number }} [options]
 * @returns {any | null}
 */
function findSoonUpcomingPlan(events, options = {}) {
  if (!Array.isArray(events) || events.length === 0) return null;
  const now = options.now instanceof Date ? options.now : new Date();
  const windowMs =
    typeof options.windowMs === "number" && options.windowMs > 0
      ? options.windowMs
      : SOON_PLAN_WINDOW_MS;
  const nowMs = now.getTime();
  let best = null;
  let bestStart = Infinity;

  for (const event of events) {
    const dateStr = String(event?.date || "").trim();
    if (!dateStr) continue;
    const startMs = parsePlanDateTime(dateStr, event?.time).getTime();
    if (!Number.isFinite(startMs)) continue;
    if (startMs < nowMs) continue;
    if (startMs - nowMs > windowMs) continue;
    if (startMs < bestStart) {
      bestStart = startMs;
      best = event;
    }
  }

  return best;
}

/**
 * One-line confirm copy for Synq soft awareness.
 * @param {any} event
 * @returns {string}
 */
function formatSoonPlanConfirmMessage(event) {
  const title = String(event?.title || "").trim() || "a plan";
  const time = String(event?.time || "").trim();
  if (time) return `You have ${title} at ${time}.`;
  return `You have ${title} coming up.`;
}

module.exports = {
  isPrivatePlan,
  isOpenPlan,
  filterToOpenPlans,
  findSoonUpcomingPlan,
  formatSoonPlanConfirmMessage,
  SOON_PLAN_WINDOW_MS,
};
