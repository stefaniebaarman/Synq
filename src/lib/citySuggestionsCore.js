/** @typedef {{ name: string, address: string, imageUrl: string }} CachedVenue */

const ARLINGTON_VA_LABELS = new Set(["arlington, va", "arlington va"]);

const NEW_YORK_CITY_LABELS = new Set([
  "new york, ny",
  "new york city, ny",
  "new york ny",
  "new york city ny",
]);

const DEWEY_BEACH_DE_LABELS = new Set([
  "dewey beach, de",
  "dewey beach de",
]);

const BOSTON_MA_LABELS = new Set(["boston, ma", "boston ma"]);

const CHICAGO_IL_LABELS = new Set(["chicago, il", "chicago il"]);

const AUSTIN_TX_LABELS = new Set(["austin, tx", "austin tx"]);

const SAN_DIEGO_CA_LABELS = new Set(["san diego, ca", "san diego ca"]);

const SEATTLE_WA_LABELS = new Set(["seattle, wa", "seattle wa"]);

const POTOMAC_MD_LABELS = new Set(["potomac, md", "potomac md"]);

const DC_METRO_LABELS = new Set([
  "washington, dc",
  "washington dc",
  "alexandria, va",
  "bethesda, md",
  "silver spring, md",
  "chevy chase, md",
  "hyattsville, md",
  "college park, md",
  "capitol heights, md",
  "takoma park, md",
]);

const VIBE_CATEGORIES = [
  "Drinks",
  "Dinner",
  "Coffee Spots",
  "Outdoors",
  "Surprise Me",
];

function normalizeLocationKey(label) {
  return String(label || "")
    .trim()
    .toLowerCase()
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s+/g, " ");
}

/** @param {string} locationPrompt */
function parseLocationLabels(locationPrompt) {
  if (!locationPrompt || typeof locationPrompt !== "string") return [];
  const trimmed = locationPrompt.trim();
  if (!trimmed) return [];

  const parts = trimmed.split(/\s+and\s+|,\s+and\s+/i);
  const labels = [];
  for (const part of parts) {
    const label = part.trim();
    if (!label) continue;
    if (label.includes(",")) {
      labels.push(label);
      continue;
    }
    const commaSplit = label.split(/,\s*/);
    if (commaSplit.length > 1) {
      labels.push(label);
    } else {
      labels.push(label);
    }
  }
  return labels;
}

/** @param {string[]} labels */
function matchesArlingtonVa(labels) {
  return labels.some((label) =>
    ARLINGTON_VA_LABELS.has(normalizeLocationKey(label))
  );
}

/** @param {string[]} labels */
function matchesNewYorkCity(labels) {
  return labels.some((label) =>
    NEW_YORK_CITY_LABELS.has(normalizeLocationKey(label))
  );
}

/** @param {string[]} labels */
function matchesDeweyBeachDe(labels) {
  return labels.some((label) =>
    DEWEY_BEACH_DE_LABELS.has(normalizeLocationKey(label))
  );
}

/** @param {string[]} labels */
function matchesBostonMa(labels) {
  return labels.some((label) =>
    BOSTON_MA_LABELS.has(normalizeLocationKey(label))
  );
}

/** @param {string[]} labels */
function matchesChicagoIl(labels) {
  return labels.some((label) =>
    CHICAGO_IL_LABELS.has(normalizeLocationKey(label))
  );
}

/** @param {string[]} labels */
function matchesAustinTx(labels) {
  return labels.some((label) =>
    AUSTIN_TX_LABELS.has(normalizeLocationKey(label))
  );
}

/** @param {string[]} labels */
function matchesSanDiegoCa(labels) {
  return labels.some((label) =>
    SAN_DIEGO_CA_LABELS.has(normalizeLocationKey(label))
  );
}

/** @param {string[]} labels */
function matchesSeattleWa(labels) {
  return labels.some((label) =>
    SEATTLE_WA_LABELS.has(normalizeLocationKey(label))
  );
}

/** @param {string[]} labels */
function matchesPotomacMd(labels) {
  return labels.some((label) =>
    POTOMAC_MD_LABELS.has(normalizeLocationKey(label))
  );
}

/** @param {string[]} labels */
function matchesWashingtonDcMetro(labels) {
  return labels.some((label) => {
    const key = normalizeLocationKey(label);
    if (DC_METRO_LABELS.has(key)) return true;
    return key.includes("washington") && key.includes("dc");
  });
}

/**
 * @param {string} senderLocationLabel
 * @param {Array<{ cityId: string, match: (labels: string[]) => boolean }>} registry
 */
function resolveCityId(senderLocationLabel, registry) {
  const label = String(senderLocationLabel || "").trim();
  if (!label) return null;
  const labels = [label];
  for (const entry of registry) {
    if (entry.match(labels)) return entry.cityId;
  }
  return null;
}

/** @param {string} name */
function normalizeVenueName(name) {
  return String(name || "")
    .trim()
    .toLowerCase();
}

/** Stable key for a suggestion batch so shuffle can avoid recently shown sets. */
function suggestionBatchKey(names) {
  return (Array.isArray(names) ? names : [])
    .map(normalizeVenueName)
    .filter(Boolean)
    .sort()
    .join("|");
}

/** @param {unknown[]} list */
function shuffleInPlace(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/**
 * Pick a suggestion batch.
 * Prefers venues not in `avoidNames`, and skips batches whose key is in
 * `recentBatchKeys` so shuffle does not flip between the same two halves.
 *
 * @param {CachedVenue[]} venues
 * @param {number} count
 * @param {{ avoidNames?: string[], recentBatchKeys?: string[] }} [options]
 */
function pickSuggestionBatch(venues, count = 5, options = {}) {
  if (!Array.isArray(venues) || venues.length === 0) return [];

  const avoid = new Set(
    (options.avoidNames || []).map(normalizeVenueName).filter(Boolean)
  );
  const recent = new Set(
    (options.recentBatchKeys || []).map((key) => String(key || "").trim()).filter(Boolean)
  );
  const pickCount = Math.min(count, venues.length);

  const toSuggestion = (venue) => ({
    name: venue.name,
    address: venue.address,
    location: venue.address,
    rating: "4.5",
  });

  const overlapScore = (picked) =>
    picked.reduce(
      (n, venue) => n + (avoid.has(normalizeVenueName(venue.name)) ? 1 : 0),
      0
    );

  /** @type {CachedVenue[] | null} */
  let best = null;
  let bestScore = Infinity;

  for (let attempt = 0; attempt < 48; attempt++) {
    const preferred = [];
    const rest = [];
    for (const venue of venues) {
      if (avoid.has(normalizeVenueName(venue.name))) rest.push(venue);
      else preferred.push(venue);
    }

    let pool;
    if (attempt < 20) {
      pool = [...shuffleInPlace(preferred), ...shuffleInPlace(rest)];
    } else {
      // Explore other combinations once preferred-first pools are exhausted.
      pool = shuffleInPlace([...venues]);
    }

    const picked = pool.slice(0, pickCount);
    const key = suggestionBatchKey(picked.map((venue) => venue.name));
    if (recent.has(key)) continue;

    const score = overlapScore(picked);
    if (score < bestScore) {
      best = picked;
      bestScore = score;
      // Entirely new vs the avoided set, and not a recent batch.
      if (score === 0) break;
    }
  }

  if (!best) {
    best = shuffleInPlace([...venues]).slice(0, pickCount);
  }

  return best.map(toSuggestion);
}

/** @param {CachedVenue[]} venues @param {number} count @param {string[]} excludeNames */
function pickRandomVenues(venues, count = 5, excludeNames = []) {
  if (!Array.isArray(venues) || venues.length === 0) return [];
  const exclude = new Set(
    (Array.isArray(excludeNames) ? excludeNames : [])
      .map(normalizeVenueName)
      .filter(Boolean)
  );
  const eligible = venues.filter(
    (venue) => !exclude.has(normalizeVenueName(venue.name))
  );
  if (eligible.length === 0) return [];

  const pickCount = Math.min(count, eligible.length);
  const pool = shuffleInPlace([...eligible]);
  return pool.slice(0, pickCount).map((venue) => ({
    name: venue.name,
    address: venue.address,
    location: venue.address,
    rating: "4.5",
  }));
}

/**
 * @param {string} senderLocationLabel
 * @param {string} category
 * @param {Record<string, { categories: Record<string, CachedVenue[]> }>} cityDataById
 * @param {Array<{ cityId: string, match: (labels: string[]) => boolean }>} registry
 */
/** @param {string[]} participantLocationLabels @param {Array<{ cityId: string, match: (labels: string[]) => boolean }>} registry */
function allParticipantsHaveCachedCitySuggestions(
  participantLocationLabels,
  registry
) {
  if (!Array.isArray(participantLocationLabels) || participantLocationLabels.length === 0) {
    return false;
  }
  return participantLocationLabels.every((label) => {
    const trimmed = String(label || "").trim();
    return trimmed.length > 0 && resolveCityId(trimmed, registry) !== null;
  });
}

function getCachedCitySuggestions(
  senderLocationLabel,
  category,
  cityDataById,
  registry,
  excludeOrOptions = []
) {
  const cityId = resolveCityId(senderLocationLabel, registry);
  if (!cityId) return null;

  const cityData = cityDataById[cityId];
  if (!cityData?.categories) return null;

  const normalizedCategory = String(category || "").trim();
  if (!VIBE_CATEGORIES.includes(normalizedCategory)) return null;

  const venues = cityData.categories[normalizedCategory];
  if (!Array.isArray(venues) || venues.length === 0) return null;

  const options = Array.isArray(excludeOrOptions)
    ? { avoidNames: excludeOrOptions }
    : excludeOrOptions && typeof excludeOrOptions === "object"
      ? excludeOrOptions
      : {};

  const suggestions = pickSuggestionBatch(venues, options.count || 5, {
    avoidNames: options.avoidNames || options.excludeNames || [],
    recentBatchKeys: options.recentBatchKeys || [],
  });
  return suggestions.length > 0 ? suggestions : null;
}

module.exports = {
  ARLINGTON_VA_LABELS,
  NEW_YORK_CITY_LABELS,
  DEWEY_BEACH_DE_LABELS,
  BOSTON_MA_LABELS,
  CHICAGO_IL_LABELS,
  AUSTIN_TX_LABELS,
  SAN_DIEGO_CA_LABELS,
  SEATTLE_WA_LABELS,
  POTOMAC_MD_LABELS,
  DC_METRO_LABELS,
  VIBE_CATEGORIES,
  normalizeLocationKey,
  parseLocationLabels,
  matchesArlingtonVa,
  matchesNewYorkCity,
  matchesDeweyBeachDe,
  matchesBostonMa,
  matchesChicagoIl,
  matchesAustinTx,
  matchesSanDiegoCa,
  matchesSeattleWa,
  matchesPotomacMd,
  matchesWashingtonDcMetro,
  resolveCityId,
  normalizeVenueName,
  suggestionBatchKey,
  pickSuggestionBatch,
  pickRandomVenues,
  allParticipantsHaveCachedCitySuggestions,
  getCachedCitySuggestions,
};
