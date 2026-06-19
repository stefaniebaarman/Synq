import type { Friend } from "@/constants/Variables";
import * as Location from "expo-location";

const EARTH_RADIUS_KM = 6371;

const geocodeCache = new Map<string, { lat: number; lng: number } | null>();

export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function friendGeocodeQuery(friend: Friend): string | null {
  const data = friend as Friend & {
    city?: string;
    state?: string;
    locationDisplay?: string;
    location?: string;
  };

  if (typeof data.locationDisplay === "string" && data.locationDisplay.trim()) {
    return data.locationDisplay.trim();
  }

  const city = typeof data.city === "string" ? data.city.trim() : "";
  const state = typeof data.state === "string" ? data.state.trim() : "";
  if (city) return state ? `${city}, ${state}` : city;

  if (typeof data.location === "string" && data.location.trim()) {
    return data.location.trim();
  }

  return null;
}

/** True when we can estimate distance (coords or a city/location label). */
export function friendHasLocation(friend: Friend): boolean {
  const lat = (friend as { lat?: unknown }).lat;
  const lng = (friend as { lng?: unknown }).lng;
  if (typeof lat === "number" && typeof lng === "number") return true;
  return friendGeocodeQuery(friend) != null;
}

export async function geocodePlace(query: string): Promise<{ lat: number; lng: number } | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const cacheKey = trimmed.toLowerCase();
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey) ?? null;
  }

  try {
    const results = await Location.geocodeAsync(trimmed);
    const hit = results?.[0];
    if (typeof hit?.latitude === "number" && typeof hit?.longitude === "number") {
      const coords = { lat: hit.latitude, lng: hit.longitude };
      geocodeCache.set(cacheKey, coords);
      return coords;
    }
  } catch {
    // Geocoding unavailable or address not found — cache miss below.
  }

  geocodeCache.set(cacheKey, null);
  return null;
}

function formatCityStateLabel(city: string, state: string): string {
  if (!city.trim()) return "";
  const c = city.trim();
  const s = state.trim();
  return s ? `${c}, ${s}` : c;
}

export function userOriginFromProfile(
  data: Record<string, unknown> | null | undefined
): {
  myCoords: { lat: number; lng: number } | null;
  myCityLabel: string;
} {
  if (!data) {
    return { myCoords: null, myCityLabel: "" };
  }
  const lat = typeof data.lat === "number" ? data.lat : null;
  const lng = typeof data.lng === "number" ? data.lng : null;
  const myCoords =
    lat != null && lng != null ? { lat, lng } : null;
  const city = typeof data.city === "string" ? data.city : "";
  const state = typeof data.state === "string" ? data.state : "";
  const myCityLabel =
    typeof data.locationDisplay === "string" && data.locationDisplay.trim()
      ? data.locationDisplay.trim()
      : formatCityStateLabel(city, state);
  return { myCoords, myCityLabel };
}

export async function resolveOriginCoords(
  myCoords: { lat: number; lng: number } | null,
  myCityLabel: string
): Promise<{ lat: number; lng: number } | null> {
  if (myCoords) return myCoords;
  if (!myCityLabel.trim()) return null;
  return geocodePlace(myCityLabel);
}

export async function resolveFriendCoords(
  friend: Friend
): Promise<{ lat: number; lng: number } | null> {
  const lat = (friend as { lat?: unknown }).lat;
  const lng = (friend as { lng?: unknown }).lng;
  if (typeof lat === "number" && typeof lng === "number") {
    return { lat, lng };
  }

  const query = friendGeocodeQuery(friend);
  if (!query) return null;
  return geocodePlace(query);
}

/** Distance in km from origin to each friend (Infinity when unknown). */
export async function buildFriendDistanceMap(
  friends: Friend[],
  origin: { lat: number; lng: number }
): Promise<Record<string, number>> {
  const entries = await Promise.all(
    friends.map(async (friend) => {
      const coords = await resolveFriendCoords(friend);
      const km = coords
        ? haversineKm(origin.lat, origin.lng, coords.lat, coords.lng)
        : Number.POSITIVE_INFINITY;
      return [friend.id, km] as const;
    })
  );

  return Object.fromEntries(entries);
}

export function sortFriendsByName(list: Friend[]): Friend[] {
  return [...list].sort((a, b) =>
    (a.displayName || "").localeCompare(b.displayName || "")
  );
}

export function sortFriendsByDistanceKm(
  list: Friend[],
  distanceKmByFriendId: Record<string, number>
): Friend[] {
  return [...list].sort((a, b) => {
    const aHas = friendHasLocation(a);
    const bHas = friendHasLocation(b);
    if (aHas !== bHas) return aHas ? -1 : 1;

    const da = distanceKmByFriendId[a.id] ?? Number.POSITIVE_INFINITY;
    const db = distanceKmByFriendId[b.id] ?? Number.POSITIVE_INFINITY;
    if (da !== db) return da - db;
    return (a.displayName || "").localeCompare(b.displayName || "");
  });
}
