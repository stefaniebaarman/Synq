import * as Location from "expo-location";

export type ResolvedCityState = {
  lat: number;
  lng: number;
  city: string;
  stateAbbrev: string;
};

export type FetchCurrentCityStateResult =
  | { ok: true; data: ResolvedCityState }
  | { ok: false; reason: "denied" | "undetected" | "error" };

/** Read foreground location permission without accessing GPS. */
export async function getForegroundLocationPermission() {
  return Location.getForegroundPermissionsAsync();
}

export function foregroundLocationAccessGranted(
  permission: Location.PermissionResponse
): boolean {
  return permission.granted;
}

/**
 * Request foreground location access. Call only after the user opts in.
 * Never reads GPS coordinates.
 */
export async function requestForegroundLocationAccess(): Promise<boolean> {
  const current = await Location.getForegroundPermissionsAsync();
  if (foregroundLocationAccessGranted(current)) return true;

  const requested = await Location.requestForegroundPermissionsAsync();
  return foregroundLocationAccessGranted(requested);
}

/**
 * Reads GPS and reverse-geocodes to city/state. Requires permission already granted.
 */
export type LocationResolvePhase = "gps" | "geocode";

export async function fetchCurrentCityState(
  stateAbbrevByRegion: Record<string, string>,
  onPhase?: (phase: LocationResolvePhase) => void
): Promise<FetchCurrentCityStateResult> {
  const permission = await Location.getForegroundPermissionsAsync();
  if (!foregroundLocationAccessGranted(permission)) {
    return { ok: false, reason: "denied" };
  }

  try {
    onPhase?.("gps");
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;

    onPhase?.("geocode");
    const results = await Location.reverseGeocodeAsync({
      latitude: lat,
      longitude: lng,
    });

    const best = results?.[0];
    const detectedCity = (
      best?.city ||
      best?.subregion ||
      best?.district ||
      ""
    ).trim();
    const detectedRegion = (best?.region || "").trim();

    if (!detectedCity || !detectedRegion) {
      return { ok: false, reason: "undetected" };
    }

    const stateAbbrev =
      stateAbbrevByRegion[detectedRegion] ??
      detectedRegion.toUpperCase().slice(0, 2);

    return {
      ok: true,
      data: { lat, lng, city: detectedCity, stateAbbrev },
    };
  } catch {
    return { ok: false, reason: "error" };
  }
}
