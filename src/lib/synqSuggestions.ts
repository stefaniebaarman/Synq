import { FirebaseError } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";

import { ENV_VARS } from "./config";
import { app } from "./firebase";

const functions = getFunctions(app, "us-central1");

const PLACES_FIELD_MASK =
  "places.displayName,places.rating,places.photos,places.shortFormattedAddress,places.formattedAddress";

export type SynqSuggestion = {
  name: string;
  rating?: string;
  imageUrl?: string | null;
  location?: string;
  address?: string;
};

function googleMapsApiKey(): string {
  return (
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
    ENV_VARS.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
    ENV_VARS.GOOGLE_MAPS_API_KEY ||
    ""
  );
}

function normalizeLocationToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s+/g, " ");
}

export function suggestionNeedsEnrichment(
  suggestion: SynqSuggestion,
  searchLocation: string
): boolean {
  const address = (suggestion.address || suggestion.location || "").trim();
  const searchNorm = normalizeLocationToken(searchLocation);
  const addressNorm = normalizeLocationToken(address);
  const hasStreet =
    !!address && addressNorm !== searchNorm && address.includes(",");
  const hasImage =
    typeof suggestion.imageUrl === "string" &&
    suggestion.imageUrl.startsWith("http");
  return !hasStreet || !hasImage;
}

export function locationLabelFromUser(
  data: Record<string, unknown> | undefined
): string {
  if (!data) return "";
  const city = typeof data.city === "string" ? data.city.trim() : "";
  const state = typeof data.state === "string" ? data.state.trim() : "";
  return [city, state].filter(Boolean).join(" ").trim();
}

export function callableErrorMessage(err: unknown): string {
  if (err instanceof FirebaseError) {
    const msg = err.message?.trim();
    if (msg && !/^internal$/i.test(msg)) return msg;
    return "Could not load suggestions. Please try again.";
  }
  if (err instanceof Error && err.message) return err.message;
  return "Could not load suggestions. Please try again.";
}

function normalizeSuggestion(raw: unknown): SynqSuggestion | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const name = String(row.name || row.title || "").trim();
  if (!name) return null;
  const location =
    typeof row.location === "string" ? row.location.trim() : "";
  const address = typeof row.address === "string" ? row.address.trim() : "";
  const imageUrl =
    typeof row.imageUrl === "string"
      ? row.imageUrl
      : typeof row.imageurl === "string"
        ? row.imageurl
        : null;
  return {
    name,
    rating: row.rating != null ? String(row.rating) : "4.0",
    imageUrl,
    location: location || address,
    address: address || location,
  };
}

async function resolvePlacePhotoUrl(
  photoName: string | undefined,
  key: string
): Promise<string | null> {
  if (!photoName) return null;
  const mediaUrl = `https://places.googleapis.com/v1/${photoName}/media`;
  try {
    const res = await fetch(
      `${mediaUrl}?maxWidthPx=400&maxHeightPx=400&skipHttpRedirect=true`,
      { headers: { "X-Goog-Api-Key": key } }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { photoUri?: string };
    return typeof data.photoUri === "string" ? data.photoUri : null;
  } catch {
    return null;
  }
}

async function enrichOneSuggestion(
  suggestion: SynqSuggestion,
  location: string,
  key: string
): Promise<SynqSuggestion> {
  if (!suggestionNeedsEnrichment(suggestion, location)) return suggestion;

  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": PLACES_FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery: `${suggestion.name}, ${location}`,
        regionCode: "US",
      }),
    });
    if (!res.ok) return suggestion;

    const data = (await res.json()) as {
      places?: Array<{
        displayName?: { text?: string };
        rating?: number;
        shortFormattedAddress?: string;
        formattedAddress?: string;
        photos?: Array<{ name?: string }>;
      }>;
    };
    const place = data.places?.[0];
    if (!place) return suggestion;

    const imageUrl = await resolvePlacePhotoUrl(place.photos?.[0]?.name, key);
    const shortAddress =
      place.shortFormattedAddress || place.formattedAddress || suggestion.location;
    const fullAddress =
      place.formattedAddress || place.shortFormattedAddress || suggestion.address;

    return {
      name: place.displayName?.text || suggestion.name,
      rating: place.rating ? Number(place.rating).toFixed(1) : suggestion.rating,
      imageUrl: imageUrl || suggestion.imageUrl || null,
      location: shortAddress || suggestion.location,
      address: fullAddress || suggestion.address,
    };
  } catch {
    return suggestion;
  }
}

export async function enrichSynqSuggestions(
  suggestions: SynqSuggestion[],
  location: string
): Promise<SynqSuggestion[]> {
  const key = googleMapsApiKey();
  if (!key || suggestions.length === 0) return suggestions;

  return Promise.all(
    suggestions.map((suggestion) => enrichOneSuggestion(suggestion, location, key))
  );
}

export async function fetchSynqSuggestions(payload: {
  category: string;
  shared: string[];
  location: string;
}): Promise<SynqSuggestion[]> {
  const fn = httpsCallable(functions, "getSynqSuggestions", {
    timeout: 120000,
  });
  const result = await fn(payload);
  const data = result.data as {
    suggestions?: unknown[];
    suggestion?: string;
  } | null;

  if (Array.isArray(data?.suggestions)) {
    return data.suggestions
      .map(normalizeSuggestion)
      .filter((item): item is SynqSuggestion => item != null);
  }

  if (typeof data?.suggestion === "string" && data.suggestion.trim()) {
    return [];
  }

  return [];
}
