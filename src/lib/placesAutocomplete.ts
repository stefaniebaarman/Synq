import { ENV_VARS } from "@/src/lib/config";

export type PlaceSuggestion = {
  placeId: string;
  primaryText: string;
  secondaryText: string;
};

export type ResolvedPlace = {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
};

export type PlacesLocationBias = {
  lat: number;
  lng: number;
  radiusMeters?: number;
};

const AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";
const DEFAULT_BIAS_RADIUS_M = 50_000;

function mapsApiKey(): string {
  return String(
    ENV_VARS.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || ENV_VARS.GOOGLE_MAPS_API_KEY || ""
  ).trim();
}

export function newPlacesSessionToken(): string {
  try {
    const c = globalThis.crypto;
    if (c && typeof c.randomUUID === "function") return c.randomUUID();
  } catch {
    /* fall through */
  }
  return `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizePlaceId(raw: string): string {
  const id = String(raw || "").trim();
  if (!id) return "";
  return id.startsWith("places/") ? id.slice("places/".length) : id;
}

function placeResourceName(placeId: string): string {
  const id = normalizePlaceId(placeId);
  return id ? `places/${id}` : "";
}

type AutocompleteSuggestion = {
  placePrediction?: {
    placeId?: string;
    place?: string;
    text?: { text?: string };
    structuredFormat?: {
      mainText?: { text?: string };
      secondaryText?: { text?: string };
    };
  };
};

export async function fetchPlaceSuggestions(
  input: string,
  sessionToken: string,
  bias?: PlacesLocationBias | null,
  signal?: AbortSignal
): Promise<PlaceSuggestion[]> {
  const key = mapsApiKey();
  const q = String(input || "").trim();
  if (!key || q.length < 2) return [];

  const body: Record<string, unknown> = {
    input: q,
    sessionToken: String(sessionToken || "").trim() || undefined,
  };

  if (
    bias &&
    Number.isFinite(bias.lat) &&
    Number.isFinite(bias.lng)
  ) {
    body.locationBias = {
      circle: {
        center: { latitude: bias.lat, longitude: bias.lng },
        radius: bias.radiusMeters ?? DEFAULT_BIAS_RADIUS_M,
      },
    };
  }

  const res = await fetch(AUTOCOMPLETE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    throw new Error(`Places autocomplete failed (${res.status})`);
  }

  const data = (await res.json()) as { suggestions?: AutocompleteSuggestion[] };
  const out: PlaceSuggestion[] = [];

  for (const row of data.suggestions || []) {
    const pred = row.placePrediction;
    if (!pred) continue;
    const placeId = normalizePlaceId(pred.placeId || pred.place || "");
    if (!placeId) continue;
    const primaryText =
      String(pred.structuredFormat?.mainText?.text || "").trim() ||
      String(pred.text?.text || "").trim();
    if (!primaryText) continue;
    const secondaryText = String(
      pred.structuredFormat?.secondaryText?.text || ""
    ).trim();
    out.push({ placeId, primaryText, secondaryText });
  }

  return out;
}

type PlaceDetailsResponse = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
};

export async function fetchPlaceDetails(
  placeId: string,
  sessionToken: string,
  signal?: AbortSignal
): Promise<ResolvedPlace | null> {
  const key = mapsApiKey();
  const resource = placeResourceName(placeId);
  if (!key || !resource) return null;

  const params = new URLSearchParams();
  const token = String(sessionToken || "").trim();
  if (token) params.set("sessionToken", token);
  const qs = params.toString();
  const url = `https://places.googleapis.com/v1/${resource}${qs ? `?${qs}` : ""}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "id,displayName,formattedAddress,location",
    },
    signal,
  });

  if (!res.ok) {
    throw new Error(`Place details failed (${res.status})`);
  }

  const data = (await res.json()) as PlaceDetailsResponse;
  const lat = Number(data.location?.latitude);
  const lng = Number(data.location?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const name = String(data.displayName?.text || "").trim();
  const address = String(data.formattedAddress || "").trim();
  const resolvedId = normalizePlaceId(data.id || placeId);

  return {
    placeId: resolvedId,
    name: name || address || "Selected place",
    address,
    lat,
    lng,
  };
}

export function placesApiConfigured(): boolean {
  return mapsApiKey().length > 0;
}
