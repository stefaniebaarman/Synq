const crypto = require("crypto");
const admin = require("firebase-admin");

const SUGGESTION_LIST_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const VENUE_ENRICH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function normalizeToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s+/g, " ");
}

function buildSuggestionCacheKey(location, category, shared) {
  const loc = normalizeToken(location);
  const cat = normalizeToken(category);
  const interests = (Array.isArray(shared) ? shared : [])
    .map(normalizeToken)
    .filter(Boolean)
    .sort()
    .join("|");
  return `${loc}::${cat}::${interests || "default"}`;
}

function buildVenueCacheKey(name, location) {
  return `${normalizeToken(name)}::${normalizeToken(location)}`;
}

function hashCacheKey(key) {
  return crypto.createHash("sha256").update(key).digest("hex").slice(0, 40);
}

function expiresAtMs(raw) {
  if (!raw) return 0;
  if (typeof raw.toMillis === "function") return raw.toMillis();
  if (typeof raw === "number") return raw;
  return 0;
}

async function readSuggestionListCache(db, cacheKey) {
  const ref = db.collection("synqSuggestionCache").doc(hashCacheKey(cacheKey));
  const snap = await ref.get();
  if (!snap.exists) return null;
  const data = snap.data() || {};
  if (expiresAtMs(data.expiresAt) <= Date.now()) return null;
  if (!Array.isArray(data.suggestions) || data.suggestions.length === 0) return null;
  return data.suggestions;
}

async function writeSuggestionListCache(db, cacheKey, suggestions) {
  const ref = db.collection("synqSuggestionCache").doc(hashCacheKey(cacheKey));
  await ref.set({
    cacheKey,
    suggestions,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: admin.firestore.Timestamp.fromMillis(
      Date.now() + SUGGESTION_LIST_TTL_MS
    ),
  });
}

async function readVenueCache(db, name, location) {
  const cacheKey = buildVenueCacheKey(name, location);
  const ref = db.collection("synqVenueCache").doc(hashCacheKey(cacheKey));
  const snap = await ref.get();
  if (!snap.exists) return null;
  const data = snap.data() || {};
  if (expiresAtMs(data.expiresAt) <= Date.now()) return null;
  if (!data.venue || !String(data.venue.name || "").trim()) return null;
  return data.venue;
}

async function writeVenueCache(db, name, location, venue) {
  const cacheKey = buildVenueCacheKey(name, location);
  const ref = db.collection("synqVenueCache").doc(hashCacheKey(cacheKey));
  await ref.set({
    cacheKey,
    venue,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + VENUE_ENRICH_TTL_MS),
  });
}

module.exports = {
  SUGGESTION_LIST_TTL_MS,
  VENUE_ENRICH_TTL_MS,
  buildSuggestionCacheKey,
  buildVenueCacheKey,
  hashCacheKey,
  readSuggestionListCache,
  writeSuggestionListCache,
  readVenueCache,
  writeVenueCache,
};
