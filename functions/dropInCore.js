/** Shared Drop-in helpers (client + callable payloads). */

const DROP_IN_EXPIRATION_HOURS = 2;
const DROP_IN_EXPIRATION_MS = DROP_IN_EXPIRATION_HOURS * 60 * 60 * 1000;
const DROP_IN_COOLDOWN_MS = 45 * 60 * 1000;
const DROP_IN_TEXT_MAX = 120;

/**
 * @param {unknown} t
 * @returns {number | null}
 */
function timestampMillis(t) {
  if (!t) return null;
  if (typeof t.toMillis === "function") {
    try {
      return t.toMillis();
    } catch {
      /* fall through */
    }
  }
  if (typeof t._seconds === "number") return t._seconds * 1000;
  if (typeof t.seconds === "number") return t.seconds * 1000;
  if (typeof t === "number" && Number.isFinite(t)) return t;
  if (typeof t === "string" && t.trim() && !Number.isNaN(Date.parse(t))) {
    return Date.parse(t);
  }
  if (t instanceof Date) return t.getTime();
  return null;
}

/**
 * @param {Record<string, unknown> | null | undefined} userData
 */
function computeDropInActiveFromUserData(userData) {
  if (!userData || typeof userData !== "object") return false;
  if (userData.dropInActive !== true) return false;
  const expiresMs = timestampMillis(userData.dropInExpiresAt);
  if (expiresMs == null) return true;
  return Date.now() < expiresMs;
}

/**
 * @param {Record<string, unknown> | null | undefined} userData
 * @param {string} viewerId
 */
function viewerInDropInAudience(userData, viewerId) {
  if (!viewerId || !userData) return false;
  if (!computeDropInActiveFromUserData(userData)) return false;
  const mode = String(userData.dropInAudienceMode ?? "all");
  if (mode !== "groups") return true;
  const visible = userData.dropInVisibleTo;
  if (!Array.isArray(visible) || visible.length === 0) return true;
  return visible.some((id) => String(id) === String(viewerId));
}

/**
 * @param {string} text
 */
function normalizeDropInText(text) {
  return String(text || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, DROP_IN_TEXT_MAX);
}

/**
 * @param {unknown} place
 * @returns {{ name: string, placeId?: string, lat?: number, lng?: number, address?: string } | null}
 */
function normalizeDropInPlace(place) {
  if (!place || typeof place !== "object") return null;
  const p = /** @type {Record<string, unknown>} */ (place);
  const name = String(p.name || p.location || "").trim().slice(0, 120);
  if (!name) return null;
  const placeId = String(p.placeId || "").trim().slice(0, 256) || undefined;
  const address = String(p.address || "").trim().slice(0, 200) || undefined;
  const latRaw = p.lat ?? p.locationLat;
  const lngRaw = p.lng ?? p.locationLng;
  const lat =
    typeof latRaw === "number" && Number.isFinite(latRaw) ? latRaw : undefined;
  const lng =
    typeof lngRaw === "number" && Number.isFinite(lngRaw) ? lngRaw : undefined;
  return {
    name,
    ...(placeId ? { placeId } : {}),
    ...(address ? { address } : {}),
    ...(typeof lat === "number" ? { lat } : {}),
    ...(typeof lng === "number" ? { lng } : {}),
  };
}

module.exports = {
  DROP_IN_EXPIRATION_HOURS,
  DROP_IN_EXPIRATION_MS,
  DROP_IN_COOLDOWN_MS,
  DROP_IN_TEXT_MAX,
  timestampMillis,
  computeDropInActiveFromUserData,
  viewerInDropInAudience,
  normalizeDropInText,
  normalizeDropInPlace,
};
