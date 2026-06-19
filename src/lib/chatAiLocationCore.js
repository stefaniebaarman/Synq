/** @typedef {{ lat: number, lng: number }} Coords */

/** Hide AI suggestions when any pair of participants exceeds this distance. */
const CHAT_AI_MAX_DISTANCE_MILES = 20;
const CHAT_AI_MAX_DISTANCE_KM = CHAT_AI_MAX_DISTANCE_MILES * 1.609344;

function normalizeLocationKey(label) {
  return label
    .trim()
    .toLowerCase()
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s+/g, " ");
}

/** @param {Record<string, unknown> | undefined} data */
function formatUserLocationLabel(data) {
  if (!data) return "";
  const display =
    typeof data.locationDisplay === "string" ? data.locationDisplay.trim() : "";
  if (display) return display;

  const city = typeof data.city === "string" ? data.city.trim() : "";
  const state = typeof data.state === "string" ? data.state.trim() : "";
  if (!city) return "";
  return state ? `${city}, ${state}` : city;
}

/** @param {Record<string, unknown>[]} participantData */
function uniqueLocationLabels(participantData) {
  const seen = new Set();
  const labels = [];
  for (const data of participantData) {
    const label = formatUserLocationLabel(data);
    if (!label) continue;
    const key = normalizeLocationKey(label);
    if (seen.has(key)) continue;
    seen.add(key);
    labels.push(label);
  }
  return labels;
}

/** @param {string[]} labels */
function buildLocationPrompt(labels) {
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  const head = labels.slice(0, -1).join(", ");
  return `${head}, and ${labels[labels.length - 1]}`;
}

/**
 * @param {Coords[]} coords
 * @param {(lat1: number, lon1: number, lat2: number, lon2: number) => number} haversineKm
 */
function maxPairwiseDistanceKm(coords, haversineKm) {
  let maxKm = 0;
  for (let i = 0; i < coords.length; i++) {
    for (let j = i + 1; j < coords.length; j++) {
      const km = haversineKm(
        coords[i].lat,
        coords[i].lng,
        coords[j].lat,
        coords[j].lng
      );
      if (km > maxKm) maxKm = km;
    }
  }
  return maxKm;
}

function participantsWithinAiRange(maxDistanceKm) {
  return maxDistanceKm <= CHAT_AI_MAX_DISTANCE_KM;
}

module.exports = {
  CHAT_AI_MAX_DISTANCE_MILES,
  CHAT_AI_MAX_DISTANCE_KM,
  formatUserLocationLabel,
  uniqueLocationLabels,
  buildLocationPrompt,
  maxPairwiseDistanceKm,
  participantsWithinAiRange,
};
