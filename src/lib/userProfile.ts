import { getCachedOwnProfile } from "./ownProfileCache";

export type UserProfileGate = {
  hasDisplayName: boolean;
  hasLocation: boolean;
};

/** Synchronous gate from disk cache (set after hydrateOwnProfileFromDisk). */
export function profileGateFromCache(uid: string): UserProfileGate | null {
  const cached = getCachedOwnProfile(uid);
  if (!cached) return null;
  const city = cached.city?.trim() ?? "";
  const state = cached.state?.trim() ?? "";
  return {
    hasDisplayName: true,
    hasLocation: city.length > 0 && state.length > 0,
  };
}

/** True when the Firestore user doc has a usable display name. */
export function userHasDisplayName(
  data: Record<string, unknown> | undefined
): boolean {
  if (!data) return false;
  if (typeof data.displayName === "string" && data.displayName.trim().length > 0) {
    return true;
  }
  const first =
    typeof data.firstName === "string" ? data.firstName.trim() : "";
  const last = typeof data.lastName === "string" ? data.lastName.trim() : "";
  return first.length > 0 && last.length > 0;
}

export function displayNameFromUserDoc(
  data: Record<string, unknown> | undefined
): string | null {
  if (!data) return null;
  if (typeof data.displayName === "string" && data.displayName.trim()) {
    return data.displayName.trim();
  }
  const first =
    typeof data.firstName === "string" ? data.firstName.trim() : "";
  const last = typeof data.lastName === "string" ? data.lastName.trim() : "";
  if (first && last) return `${first} ${last}`;
  return null;
}

export function userHasLocation(
  data: Record<string, unknown> | undefined
): boolean {
  if (!data) return false;
  const city = typeof data.city === "string" ? data.city.trim() : "";
  const state = typeof data.state === "string" ? data.state.trim() : "";
  return city.length > 0 && state.length > 0;
}
