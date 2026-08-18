import {
  CHAT_AI_MAX_DISTANCE_KM,
  formatUserLocationLabel,
} from "./chatAiLocation";
import { getCachedCitySuggestions } from "./citySuggestions";
import {
  geocodePlace,
  userOriginFromProfile,
} from "./friendDistance";
import type { SynqSuggestion } from "./synqSuggestions";

import {
  buildOverpassQuery,
  cacheCellKey,
  collectDisplayInterests,
  collectParticipantInterests,
  pickRankedSuggestionBatch,
  pickSuggestionOrigin,
  venuesFromOverpassJson,
} from "./liveSuggestionsCore";

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const USER_AGENT = "SynqApp/1.0 (https://synqapp.com; venue-suggestions)";
const POOL_TTL_MS = 30 * 60 * 1000;
const FETCH_TIMEOUT_MS = 12000;
const GEOCODE_TIMEOUT_MS = 2500;

type Coords = { lat: number; lng: number };

type LiveVenue = {
  name: string;
  address: string;
  location: string;
  lat: number;
  lng: number;
  tags: Record<string, string>;
  distanceKm: number;
};

export type LiveSuggestionContext = {
  locationLabel: string;
  origin: Coords | null;
  interests: { key: string; count: number }[];
  category: string;
  source: "live" | "cached-city";
};

type PoolEntry = { venues: LiveVenue[]; fetchedAt: number };

const poolCache = new Map<string, PoolEntry>();

function poolCategoryKey(category: string) {
  const key = String(category || "").trim();
  if (key === "Night out" || key === "Drinks") return "nightlife";
  if (key === "Active") return "Outdoors";
  return key;
}

function abortTimeout(ms: number): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timer),
  };
}

async function raceTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function geocodeNominatim(query: string): Promise<Coords | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;
  const timeout = abortTimeout(2000);
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
      trimmed
    )}`;
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
      signal: timeout.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ lat?: string; lon?: string }>;
    const hit = data?.[0];
    const lat = Number(hit?.lat);
    const lng = Number(hit?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  } finally {
    timeout.cancel();
  }
}

async function resolveProfileCoords(
  data: Record<string, unknown> | undefined
): Promise<Coords | null> {
  const { myCoords, myCityLabel } = userOriginFromProfile(data);
  if (myCoords) return myCoords;
  if (!myCityLabel.trim()) return null;
  const fromDevice = await raceTimeout(geocodePlace(myCityLabel), GEOCODE_TIMEOUT_MS);
  if (fromDevice) return fromDevice;
  return geocodeNominatim(myCityLabel);
}

async function postOverpass(endpoint: string, query: string): Promise<unknown> {
  const timeout = abortTimeout(FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "User-Agent": USER_AGENT,
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: timeout.signal,
    });
    if (!res.ok) {
      throw new Error(`Overpass ${res.status}`);
    }
    return await res.json();
  } finally {
    timeout.cancel();
  }
}

async function fetchOverpassPool(
  origin: Coords,
  category: string,
  fallbackLabel: string
): Promise<LiveVenue[]> {
  const cacheKey = cacheCellKey(origin.lat, origin.lng, poolCategoryKey(category));
  const cached = poolCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < POOL_TTL_MS) {
    return cached.venues;
  }

  const query = buildOverpassQuery(origin.lat, origin.lng, category);
  try {
    const venues = (await Promise.any(
      OVERPASS_ENDPOINTS.map(async (endpoint) => {
        const json = await postOverpass(endpoint, query);
        const parsed = venuesFromOverpassJson(
          json,
          origin,
          fallbackLabel
        ) as LiveVenue[];
        if (parsed.length === 0) throw new Error("empty overpass result");
        return parsed;
      })
    )) as LiveVenue[];
    poolCache.set(cacheKey, { venues, fetchedAt: Date.now() });
    return venues;
  } catch (lastError) {
    if (cached?.venues?.length) return cached.venues;
    throw lastError;
  }
}

function curatedFallback(
  locationLabel: string,
  category: string,
  avoidNames: string[],
  recentBatchKeys: string[],
  count: number
): SynqSuggestion[] {
  const list =
    getCachedCitySuggestions(locationLabel, category, {
      avoidNames,
      recentBatchKeys,
      count,
    }) ?? [];
  return list.map((item, index) => ({
    ...item,
    why: index === 0 ? item.why : undefined,
    featured: index === 0,
  }));
}

export async function loadSynqPlaceSuggestions(options: {
  category: string;
  participantData: Record<string, unknown>[];
  senderData: Record<string, unknown> | undefined;
  avoidNames?: string[];
  recentBatchKeys?: string[];
  count?: number;
}): Promise<{ suggestions: SynqSuggestion[]; context: LiveSuggestionContext } | null> {
  const category = String(options.category || "").trim();
  const locationLabel = formatUserLocationLabel(options.senderData);
  if (!category || !locationLabel) return null;

  const count = options.count || 5;
  const avoidNames = options.avoidNames || [];
  const recentBatchKeys = options.recentBatchKeys || [];
  const interests = collectParticipantInterests(options.participantData);

  const senderCoords = await resolveProfileCoords(options.senderData);
  const origin = pickSuggestionOrigin(senderCoords, [], CHAT_AI_MAX_DISTANCE_KM);
  void Promise.all(
    options.participantData.map((data) => resolveProfileCoords(data))
  );

  if (origin) {
    try {
      const pool = await fetchOverpassPool(origin, category, locationLabel);
      const suggestions = pickRankedSuggestionBatch(pool, {
        count,
        avoidNames,
        recentBatchKeys,
        interests,
        hour: new Date().getHours(),
        category,
      }) as SynqSuggestion[];
      if (suggestions.length > 0) {
        return {
          suggestions,
          context: {
            locationLabel,
            origin,
            interests,
            category,
            source: "live",
          },
        };
      }
    } catch {
      // Fall through to the curated city list when Overpass is down.
    }
  }

  const fallback = curatedFallback(
    locationLabel,
    category,
    avoidNames,
    recentBatchKeys,
    count
  );
  if (fallback.length === 0) return null;

  return {
    suggestions: fallback,
    context: {
      locationLabel,
      origin: origin,
      interests,
      category,
      source: "cached-city",
    },
  };
}

export async function reshuffleSynqPlaceSuggestions(options: {
  context: LiveSuggestionContext;
  avoidNames?: string[];
  recentBatchKeys?: string[];
  count?: number;
}): Promise<SynqSuggestion[]> {
  const { context } = options;
  const count = options.count || 5;
  const avoidNames = options.avoidNames || [];
  const recentBatchKeys = options.recentBatchKeys || [];

  if (context.source === "live" && context.origin) {
    try {
      const pool = await fetchOverpassPool(
        context.origin,
        context.category,
        context.locationLabel
      );
      const suggestions = pickRankedSuggestionBatch(pool, {
        count,
        avoidNames,
        recentBatchKeys,
        interests: context.interests,
        hour: new Date().getHours(),
        category: context.category,
      }) as SynqSuggestion[];
      if (suggestions.length > 0) return suggestions;
    } catch {
      // Use curated fallback below.
    }
  }

  return curatedFallback(
    context.locationLabel,
    context.category,
    avoidNames,
    recentBatchKeys,
    count
  );
}

export function warmupLiveSuggestionOrigin(
  participantData: Record<string, unknown>[],
  senderData?: Record<string, unknown>
) {
  const targets = senderData ? [senderData, ...participantData] : participantData;
  void Promise.all(targets.map((data) => resolveProfileCoords(data)));
}

export function displayInterestsForChat(
  participantData: Record<string, unknown>[],
  limit = 3
): string[] {
  return collectDisplayInterests(participantData, limit);
}

export function clearLiveSuggestionCache() {
  poolCache.clear();
}
