/** @typedef {{ lat: number, lng: number }} Coords */
/** @typedef {{ name: string, address: string, location: string, lat: number, lng: number, tags: Record<string, string>, distanceKm: number }} LiveVenue */

const EARTH_RADIUS_KM = 6371;
const DEFAULT_RADIUS_METERS = 4000;
const DEFAULT_MAX_OUT = 50;
const PICK_COUNT = 5;

const CATEGORY_FILTERS = {
  Drinks: [
    '["amenity"="bar"]',
    '["amenity"="pub"]',
    '["amenity"="nightclub"]',
    '["amenity"="biergarten"]',
  ],
  Dinner: ['["amenity"="restaurant"]'],
  "Coffee Spots": ['["amenity"="cafe"]', '["shop"="coffee"]'],
  Outdoors: [
    '["leisure"="park"]',
    '["leisure"="garden"]',
    '["leisure"="nature_reserve"]',
    '["tourism"="viewpoint"]',
    '["natural"="beach"]',
  ],
  Brunch: ['["amenity"="cafe"]', '["amenity"="restaurant"]', '["shop"="bakery"]'],
  "Night out": [
    '["amenity"="nightclub"]',
    '["amenity"="bar"]',
    '["amenity"="pub"]',
    '["amenity"="biergarten"]',
  ],
  Shopping: [
    '["shop"="mall"]',
    '["shop"="supermarket"]',
    '["shop"="convenience"]',
    '["shop"="clothes"]',
    '["amenity"="marketplace"]',
  ],
  "Surprise Me": [
    '["amenity"="restaurant"]',
    '["amenity"="cafe"]',
    '["amenity"="bar"]',
    '["amenity"="pub"]',
    '["amenity"="fast_food"]',
    '["leisure"="park"]',
    '["shop"="supermarket"]',
  ],
};

/** @type {Record<string, string[]>} */
const INTEREST_NEEDLES = {
  "going out to eat": ["restaurant", "cuisine", "food"],
  coffee: ["cafe", "coffee"],
  drinks: ["bar", "pub", "nightclub", "biergarten", "cocktail"],
  walking: ["park", "garden", "trail", "footway"],
  gym: ["fitness", "gym", "sports_centre"],
  "pilates / yoga": ["yoga", "pilates", "fitness"],
  pickleball: ["pickleball", "pitch"],
  basketball: ["basketball"],
  soccer: ["soccer", "football"],
  bowling: ["bowling"],
  games: ["arcade", "escape", "adult_gaming", "board"],
  karaoke: ["karaoke"],
  "live music": ["live_music", "music", "concert", "nightclub"],
  museums: ["museum", "gallery"],
  movies: ["cinema"],
  "sports bars": ["bar", "pub", "sport"],
  hiking: ["park", "nature_reserve", "trail", "peak", "wood"],
  shopping: ["mall", "marketplace", "shop"],
  cooking: ["restaurant", "cuisine"],
  "dog park": ["dog", "park"],
  art: ["gallery", "arts_centre", "artwork", "museum"],
  reading: ["library", "books", "book"],
};

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normalizeVenueName(name) {
  return String(name || "")
    .trim()
    .toLowerCase();
}

function suggestionBatchKey(names) {
  return (Array.isArray(names) ? names : [])
    .map(normalizeVenueName)
    .filter(Boolean)
    .sort()
    .join("|");
}

function normalizeInterest(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {Record<string, unknown>[]} participantData
 * @returns {{ key: string, count: number }[]}
 */
function collectParticipantInterests(participantData) {
  /** @type {Map<string, number>} */
  const counts = new Map();
  const list = Array.isArray(participantData) ? participantData : [];
  for (const data of list) {
    const interests = Array.isArray(data?.interests) ? data.interests : [];
    const seen = new Set();
    for (const raw of interests) {
      const key = normalizeInterest(raw);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  return [...counts.entries()].map(([key, count]) => ({ key, count }));
}

const INTEREST_CHIP_LABEL = {
  "going out to eat": "Food",
  coffee: "Coffee",
  drinks: "Drinks",
  walking: "Walks",
  gym: "Gym",
  "pilates / yoga": "Yoga",
  pickleball: "Pickleball",
  basketball: "Basketball",
  soccer: "Soccer",
  bowling: "Bowling",
  games: "Games",
  karaoke: "Karaoke",
  "live music": "Live music",
  museums: "Museums",
  movies: "Movies",
  "sports bars": "Sports bars",
  hiking: "Hiking",
  shopping: "Shopping",
  cooking: "Cooking",
  "dog park": "Dogs",
  art: "Art",
  reading: "Reading",
};

function interestChipLabel(key) {
  if (INTEREST_CHIP_LABEL[key]) return INTEREST_CHIP_LABEL[key];
  return String(key || "")
    .split(" ")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}

function collectDisplayInterests(participantData, limit = 3) {
  return collectParticipantInterests(participantData)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((row) => interestChipLabel(row.key))
    .filter(Boolean);
}

const CATEGORY_WHY_INTERESTS = {
  Drinks: ["drinks", "sports bars", "karaoke", "live music"],
  "Coffee Spots": ["coffee"],
  Dinner: ["going out to eat", "cooking"],
  Brunch: ["coffee", "going out to eat"],
  "Night out": ["drinks", "live music", "karaoke"],
  Outdoors: ["walking", "hiking", "dog park"],
  Shopping: ["shopping"],
};

function interestsForWhy(interests, category) {
  const list = Array.isArray(interests) ? interests : [];
  const allowed = CATEGORY_WHY_INTERESTS[canonicalCategory(category)];
  if (!allowed) return list;
  const allow = new Set(allowed);
  return list.filter((row) => allow.has(row.key));
}

function matchedInterestKey(haystack, interests) {
  if (!haystack || !Array.isArray(interests)) return null;
  for (const interest of interests) {
    const needles = INTEREST_NEEDLES[interest.key] || [interest.key];
    if (needles.some((needle) => haystack.includes(needle))) return interest.key;
  }
  return null;
}

function formatDistanceWhy(distanceKm) {
  const miles = Number(distanceKm) / 1.609344;
  if (!Number.isFinite(miles)) return "";
  if (miles < 0.2) return "Around the corner";
  if (miles < 10) return `${miles.toFixed(1)} mi away`;
  return `${Math.round(miles)} mi away`;
}

function suggestionWhy(venue, options = {}) {
  const haystack = venueTagHaystack(venue.tags);
  const distance = formatDistanceWhy(venue.distanceKm);
  const matched = matchedInterestKey(
    haystack,
    interestsForWhy(options.interests, options.category)
  );
  if (matched) {
    const label = interestChipLabel(matched).toLowerCase();
    return distance ? `Fits ${label} · ${distance}` : `Fits ${label}`;
  }
  const hour = Number.isFinite(options.hour) ? options.hour : new Date().getHours();
  const isNightSpot =
    haystack.includes("bar") ||
    haystack.includes("pub") ||
    haystack.includes("restaurant");
  if ((hour >= 17 || hour < 5) && isNightSpot) {
    return distance ? `Good for tonight · ${distance}` : "Good for tonight";
  }
  if (!venue.tags?.brand) {
    return distance ? `Local pick · ${distance}` : "Local pick";
  }
  return distance || "Nearby";
}

function uniqueCoords(coordsList) {
  const seen = new Set();
  const out = [];
  for (const coords of Array.isArray(coordsList) ? coordsList : []) {
    if (!coords || typeof coords.lat !== "number" || typeof coords.lng !== "number") {
      continue;
    }
    const key = `${Number(coords.lat).toFixed(4)},${Number(coords.lng).toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(coords);
  }
  return out;
}

/**
 * @param {Coords} sender
 * @param {Coords[]} others
 * @param {number} maxDistanceKm
 * @returns {Coords | null}
 */
function pickSuggestionOrigin(sender, others, maxDistanceKm) {
  const all = uniqueCoords([
    sender,
    ...(Array.isArray(others) ? others : []),
  ]);
  if (all.length === 0) return null;
  if (!sender || typeof sender.lat !== "number" || typeof sender.lng !== "number") {
    return all[0];
  }
  if (all.length === 1) return sender;

  let maxKm = 0;
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const km = haversineKm(all[i].lat, all[i].lng, all[j].lat, all[j].lng);
      if (km > maxKm) maxKm = km;
    }
  }
  if (maxKm > maxDistanceKm) return sender;

  const lat = all.reduce((sum, coords) => sum + coords.lat, 0) / all.length;
  const lng = all.reduce((sum, coords) => sum + coords.lng, 0) / all.length;
  return { lat, lng };
}

function cacheCellKey(lat, lng, category) {
  const cellLat = Number(lat).toFixed(2);
  const cellLng = Number(lng).toFixed(2);
  const cat = canonicalCategory(category) || "Surprise Me";
  return `${cellLat},${cellLng}::${cat}`;
}

function canonicalCategory(category) {
  const key = String(category || "").trim();
  if (key === "Active") return "Outdoors";
  return key;
}

function categoryFilters(category) {
  const key = canonicalCategory(category);
  return CATEGORY_FILTERS[key] || CATEGORY_FILTERS["Surprise Me"];
}

function overpassElementType(category) {
  const key = canonicalCategory(category);
  if (key === "Outdoors") return "nwr";
  return "node";
}

function buildOverpassQuery(
  lat,
  lng,
  category,
  radiusMeters = DEFAULT_RADIUS_METERS,
  maxOut = DEFAULT_MAX_OUT
) {
  const around = `(around:${Math.round(radiusMeters)},${Number(lat).toFixed(5)},${Number(
    lng
  ).toFixed(5)})`;
  const key = canonicalCategory(category);
  if (key === "Drinks" || key === "Night out") {
    return `[out:json][timeout:12];\nnode["amenity"~"^(bar|pub|nightclub|biergarten)$"]${around};\nout tags center ${Math.round(
      maxOut
    )};`;
  }
  if (key === "Shopping") {
    return `[out:json][timeout:12];\nnode["shop"]${around};\nout tags center ${Math.round(
      maxOut
    )};`;
  }
  const kind = overpassElementType(key);
  const unions = categoryFilters(key)
    .map((filter) => `  ${kind}${filter}${around};`)
    .join("\n");
  return `[out:json][timeout:12];\n(\n${unions}\n);\nout tags center ${Math.round(maxOut)};`;
}

function elementCoords(element) {
  if (typeof element?.lat === "number" && typeof element?.lon === "number") {
    return { lat: element.lat, lng: element.lon };
  }
  const center = element?.center;
  if (center && typeof center.lat === "number" && typeof center.lon === "number") {
    return { lat: center.lat, lng: center.lon };
  }
  return null;
}

function formatOsmAddress(tags, fallbackLabel) {
  if (!tags || typeof tags !== "object") {
    return String(fallbackLabel || "").trim();
  }
  const number = String(tags["addr:housenumber"] || "").trim();
  const street = String(tags["addr:street"] || "").trim();
  const streetLine = [number, street].filter(Boolean).join(" ");
  const city = String(tags["addr:city"] || tags["addr:suburb"] || "").trim();
  const state = String(tags["addr:state"] || "").trim();
  const cityLine = [city, state].filter(Boolean).join(", ");
  const parts = [streetLine, cityLine].filter(Boolean);
  if (parts.length > 0) return parts.join(", ");
  const full = String(tags["addr:full"] || "").trim();
  if (full) return full;
  return String(fallbackLabel || "").trim();
}

function venueTagHaystack(tags) {
  if (!tags || typeof tags !== "object") return "";
  const keys = [
    "amenity",
    "leisure",
    "tourism",
    "shop",
    "cuisine",
    "sport",
    "live_music",
    "karaoke",
    "dog",
    "outdoor_seating",
  ];
  return keys
    .map((key) => String(tags[key] || "").toLowerCase())
    .filter(Boolean)
    .join(" ");
}

/**
 * @param {unknown} data
 * @param {Coords} origin
 * @param {string} [fallbackLabel]
 * @returns {LiveVenue[]}
 */
function venuesFromOverpassJson(data, origin, fallbackLabel = "") {
  const elements = Array.isArray(data?.elements) ? data.elements : [];
  /** @type {Map<string, LiveVenue>} */
  const unique = new Map();

  for (const element of elements) {
    const tags = element?.tags && typeof element.tags === "object" ? element.tags : null;
    const name = String(tags?.name || "").trim();
    if (!name || !tags) continue;
    const coords = elementCoords(element);
    if (!coords) continue;

    const rounded = `${coords.lat.toFixed(4)},${coords.lng.toFixed(4)}`;
    const key = `${normalizeVenueName(name)}|${rounded}`;
    if (unique.has(key)) continue;

    const address = formatOsmAddress(tags, fallbackLabel);
    const distanceKm = haversineKm(origin.lat, origin.lng, coords.lat, coords.lng);
    unique.set(key, {
      name,
      address,
      location: address,
      lat: coords.lat,
      lng: coords.lng,
      tags,
      distanceKm,
    });
  }

  return [...unique.values()];
}

function interestScore(haystack, interests) {
  if (!Array.isArray(interests) || interests.length === 0) return 0;
  let score = 0;
  for (const interest of interests) {
    const needles = INTEREST_NEEDLES[interest.key] || [interest.key];
    const matched = needles.some((needle) => haystack.includes(needle));
    if (!matched) continue;
    score += 6;
    if (interest.count >= 2) score += 4;
  }
  return score;
}

function timeOfDayScore(haystack, hour) {
  const h = Number.isFinite(hour) ? hour : new Date().getHours();
  const isCafe = haystack.includes("cafe") || haystack.includes("coffee");
  const isBar =
    haystack.includes("bar") ||
    haystack.includes("pub") ||
    haystack.includes("nightclub") ||
    haystack.includes("biergarten");
  const isRestaurant = haystack.includes("restaurant");
  const isPark = haystack.includes("park") || haystack.includes("garden");

  if (h >= 6 && h < 11) {
    return (isCafe ? 4 : 0) + (isPark ? 2 : 0) + (isBar ? -3 : 0);
  }
  if (h >= 11 && h < 15) {
    return (isRestaurant ? 3 : 0) + (isCafe ? 2 : 0);
  }
  if (h >= 17 && h < 22) {
    return (isRestaurant ? 3 : 0) + (isBar ? 3 : 0);
  }
  if (h >= 22 || h < 5) {
    return (isBar ? 4 : 0) + (isCafe ? -2 : 0);
  }
  return 0;
}

/**
 * @param {LiveVenue} venue
 * @param {{ interests?: { key: string, count: number }[], hour?: number }} [options]
 */
function nightOutScore(haystack, category) {
  if (String(category || "").trim() !== "Night out") return 0;
  const isClub =
    haystack.includes("nightclub") || haystack.includes("dance");
  const isMusic =
    haystack.includes("live_music") ||
    haystack.includes("music") ||
    haystack.includes("karaoke") ||
    haystack.includes("dj");
  return (isClub ? 10 : 0) + (isMusic ? 4 : 0);
}

/**
 * @param {LiveVenue} venue
 * @param {{ interests?: { key: string, count: number }[], hour?: number, category?: string }} [options]
 */
function scoreVenue(venue, options = {}) {
  const haystack = venueTagHaystack(venue.tags);
  const distanceKm = Number(venue.distanceKm) || 0;
  const addressBonus = venue.address && venue.address.includes(",") ? 1 : 0;
  const chainPenalty = venue.tags?.brand ? 2.5 : 0;
  return (
    interestScore(haystack, options.interests || []) +
    timeOfDayScore(haystack, options.hour) +
    nightOutScore(haystack, options.category) +
    addressBonus -
    distanceKm * 1.5 -
    chainPenalty
  );
}

function shuffleInPlace(list, random = Math.random) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function toSuggestion(venue, options = {}, featured = false) {
  return {
    name: venue.name,
    address: venue.address,
    location: venue.location || venue.address,
    lat: venue.lat,
    lng: venue.lng,
    rating: undefined,
    imageUrl: null,
    why: featured ? formatDistanceWhy(venue.distanceKm) || undefined : undefined,
    featured: !!featured,
  };
}

/**
 * Rank a live venue pool and pick a batch that avoids recently shown sets.
 *
 * @param {LiveVenue[]} venues
 * @param {{
 *   count?: number,
 *   avoidNames?: string[],
 *   recentBatchKeys?: string[],
 *   interests?: { key: string, count: number }[],
 *   hour?: number,
 *   random?: () => number,
 * }} [options]
 */
function pickRankedSuggestionBatch(venues, options = {}) {
  if (!Array.isArray(venues) || venues.length === 0) return [];

  const count = Math.min(options.count || PICK_COUNT, venues.length);
  const avoid = new Set(
    (options.avoidNames || []).map(normalizeVenueName).filter(Boolean)
  );
  const recent = new Set(
    (options.recentBatchKeys || []).map((key) => String(key || "").trim()).filter(Boolean)
  );
  const random = typeof options.random === "function" ? options.random : Math.random;

  const ranked = venues
    .map((venue) => ({
      venue,
      score: scoreVenue(venue, options) + random() * 0.8,
    }))
    .sort((a, b) => b.score - a.score);

  const preferred = [];
  const rest = [];
  for (const row of ranked) {
    if (avoid.has(normalizeVenueName(row.venue.name))) rest.push(row.venue);
    else preferred.push(row.venue);
  }

  const overlapScore = (picked) =>
    picked.reduce(
      (n, venue) => n + (avoid.has(normalizeVenueName(venue.name)) ? 1 : 0),
      0
    );

  /** @type {LiveVenue[] | null} */
  let best = null;
  let bestScore = Infinity;

  const tryPool = (pool) => {
    const picked = pool.slice(0, count);
    if (picked.length === 0) return;
    const key = suggestionBatchKey(picked.map((venue) => venue.name));
    if (recent.has(key)) return;
    const score = overlapScore(picked);
    if (score < bestScore) {
      best = picked;
      bestScore = score;
    }
  };

  // Explore a few shuffles of the top-ranked slice so shuffle feels fresh
  // without ignoring personalization.
  const topPreferred = preferred.slice(0, Math.max(count * 5, 16));
  for (let attempt = 0; attempt < 24; attempt++) {
    const mixed =
      attempt === 0
        ? [...topPreferred, ...rest]
        : [...shuffleInPlace([...topPreferred], random), ...rest];
    tryPool(mixed);
    if (best && bestScore === 0) break;
  }

  if (!best) {
    tryPool([...preferred, ...rest]);
  }
  if (!best) {
    best = ranked.slice(0, count).map((row) => row.venue);
  }

  return best.map((venue, index) => toSuggestion(venue, options, index === 0));
}

module.exports = {
  DEFAULT_RADIUS_METERS,
  CATEGORY_FILTERS,
  INTEREST_NEEDLES,
  haversineKm,
  normalizeVenueName,
  suggestionBatchKey,
  normalizeInterest,
  collectParticipantInterests,
  collectDisplayInterests,
  uniqueCoords,
  pickSuggestionOrigin,
  cacheCellKey,
  buildOverpassQuery,
  formatOsmAddress,
  venuesFromOverpassJson,
  scoreVenue,
  suggestionWhy,
  pickRankedSuggestionBatch,
};
