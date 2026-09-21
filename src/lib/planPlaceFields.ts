/** Structured place fields stored on personal open-plan events. */
export type PlanPlaceFields = {
  location: string;
  locationLat?: number;
  locationLng?: number;
  placeId?: string;
};

export function readPlanPlaceFields(
  source: Record<string, unknown> | null | undefined
): PlanPlaceFields {
  const location = String(source?.location || "").trim();
  const lat = Number(source?.locationLat);
  const lng = Number(source?.locationLng);
  const placeId = String(source?.placeId || "").trim();
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
  return {
    location,
    ...(hasCoords ? { locationLat: lat, locationLng: lng } : {}),
    ...(placeId ? { placeId } : {}),
  };
}

/** Apply location (+ optional coords) onto an event object; strips stale coords. */
export function applyPlanPlaceFields<T extends Record<string, unknown>>(
  base: T,
  fields: PlanPlaceFields
): T & PlanPlaceFields {
  const location = String(fields.location || "").trim();
  const next: Record<string, unknown> = { ...base, location };
  delete next.locationLat;
  delete next.locationLng;
  delete next.placeId;

  const lat = Number(fields.locationLat);
  const lng = Number(fields.locationLng);
  if (location && Number.isFinite(lat) && Number.isFinite(lng)) {
    next.locationLat = lat;
    next.locationLng = lng;
    const placeId = String(fields.placeId || "").trim();
    if (placeId) next.placeId = placeId;
  }

  return next as T & PlanPlaceFields;
}

/**
 * Firestore rejects `undefined` (and NaN) anywhere in a document.
 * Plan edits often spread form state that includes cleared `locationLat` etc.
 */
export function stripUndefinedDeep<T>(value: T): T {
  if (value === undefined) return value;
  if (value === null || typeof value !== "object") {
    if (typeof value === "number" && !Number.isFinite(value)) {
      return undefined as T;
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)) as T;
  }
  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (nested === undefined) continue;
    if (typeof nested === "number" && !Number.isFinite(nested)) continue;
    const cleaned = stripUndefinedDeep(nested);
    if (cleaned === undefined) continue;
    out[key] = cleaned;
  }
  return out as T;
}

/** Build plan form location fields without writing `undefined` keys.
 * Does not trim location text — that would eat spaces while typing.
 */
export function formPlaceFieldsFromValue(fields: PlanPlaceFields): PlanPlaceFields {
  const location = String(fields.location ?? "");
  const lat = Number(fields.locationLat);
  const lng = Number(fields.locationLng);
  const placeId = String(fields.placeId || "").trim();
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
  return {
    location,
    ...(hasCoords ? { locationLat: lat, locationLng: lng } : {}),
    ...(placeId ? { placeId } : {}),
  };
}
