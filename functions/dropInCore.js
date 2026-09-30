/** Shared Drop-in helpers (client + callable payloads). */

const DROP_IN_EXPIRATION_HOURS = 2;
const DROP_IN_EXPIRATION_MS = DROP_IN_EXPIRATION_HOURS * 60 * 60 * 1000;
const DROP_IN_COOLDOWN_MS = 45 * 60 * 1000;
const DROP_IN_TEXT_MAX = 120;
/** Max distance for live-status push / in-app fan-out (anti-spam). */
const DROP_IN_NOTIFY_RADIUS_MILES = 20;
const EARTH_RADIUS_MILES = 3958.7613;

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

/**
 * @param {Record<string, unknown> | null | undefined} data
 * @returns {{ lat: number, lng: number } | null}
 */
function readUserCoords(data) {
  if (!data || typeof data !== "object") return null;
  const lat = typeof data.lat === "number" && Number.isFinite(data.lat) ? data.lat : null;
  const lng = typeof data.lng === "number" && Number.isFinite(data.lng) ? data.lng : null;
  if (lat == null || lng == null) return null;
  return { lat, lng };
}

/**
 * Best available position for a live status: place pin, else profile coords.
 * @param {Record<string, unknown> | null | undefined} callerData
 * @returns {{ lat: number, lng: number } | null}
 */
function resolveDropInOriginCoords(callerData) {
  const place = normalizeDropInPlace(callerData?.dropInPlace);
  if (
    place &&
    typeof place.lat === "number" &&
    typeof place.lng === "number"
  ) {
    return { lat: place.lat, lng: place.lng };
  }
  return readUserCoords(callerData);
}

/**
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 */
function haversineMiles(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_MILES * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * @param {{ lat: number, lng: number }} origin
 * @param {{ lat: number, lng: number }} other
 * @param {number} [radiusMiles]
 */
function isWithinDropInNotifyRadius(
  origin,
  other,
  radiusMiles = DROP_IN_NOTIFY_RADIUS_MILES
) {
  if (!origin || !other) return false;
  const miles = haversineMiles(origin.lat, origin.lng, other.lat, other.lng);
  return Number.isFinite(miles) && miles <= radiusMiles;
}

module.exports = {
  DROP_IN_EXPIRATION_HOURS,
  DROP_IN_EXPIRATION_MS,
  DROP_IN_COOLDOWN_MS,
  DROP_IN_TEXT_MAX,
  DROP_IN_NOTIFY_RADIUS_MILES,
  timestampMillis,
  computeDropInActiveFromUserData,
  viewerInDropInAudience,
  normalizeDropInText,
  normalizeDropInPlace,
  readUserCoords,
  resolveDropInOriginCoords,
  haversineMiles,
  isWithinDropInNotifyRadius,
};
