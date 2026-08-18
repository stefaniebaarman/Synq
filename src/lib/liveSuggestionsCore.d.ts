export function collectParticipantInterests(
  participantData: Record<string, unknown>[]
): { key: string; count: number }[];

export function collectDisplayInterests(
  participantData: Record<string, unknown>[],
  limit?: number
): string[];

export function suggestionWhy(
  venue: {
    tags?: Record<string, string>;
    distanceKm?: number;
  },
  options?: {
    interests?: { key: string; count: number }[];
    hour?: number;
    category?: string;
  }
): string;

export function pickSuggestionOrigin(
  sender: { lat: number; lng: number } | null | undefined,
  others: Array<{ lat: number; lng: number } | null | undefined>,
  maxDistanceKm: number
): { lat: number; lng: number } | null;

export function cacheCellKey(lat: number, lng: number, category: string): string;

export function buildOverpassQuery(
  lat: number,
  lng: number,
  category: string,
  radiusMeters?: number,
  maxOut?: number
): string;

export function venuesFromOverpassJson(
  data: unknown,
  origin: { lat: number; lng: number },
  fallbackLabel?: string
): Array<{
  name: string;
  address: string;
  location: string;
  lat: number;
  lng: number;
  tags: Record<string, string>;
  distanceKm: number;
}>;

export function pickRankedSuggestionBatch(
  venues: unknown[],
  options?: {
    count?: number;
    avoidNames?: string[];
    recentBatchKeys?: string[];
    interests?: { key: string; count: number }[];
    hour?: number;
    category?: string;
    random?: () => number;
  }
): Array<{
  name: string;
  address: string;
  location: string;
  lat?: number;
  lng?: number;
  rating?: string;
  imageUrl?: string | null;
  why?: string;
  featured?: boolean;
}>;
