import { FirebaseError } from "firebase/app";
import {
  Timestamp,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";

import type { Friend } from "../../constants/Variables";
import {
  DROP_IN_COOLDOWN_MS,
  DROP_IN_EXPIRATION_MS,
  DROP_IN_TEXT_MAX,
  computeDropInActiveFromUserData,
  normalizeDropInPlace,
  normalizeDropInText,
  timestampMillis,
  viewerInDropInAudience,
} from "./dropInCore.js";
import { app, auth, db } from "./firebase";
import type { FriendGroup } from "./friendGroups";
import type { SynqAudienceSelection } from "./synqBroadcast";
import { resolveSynqVisibleTo } from "./synqBroadcast";
import {
  friendProfileCacheByUser,
  friendProfileFetchedAtByUser,
} from "./socialCache";

export {
  DROP_IN_COOLDOWN_MS,
  DROP_IN_EXPIRATION_MS,
  DROP_IN_TEXT_MAX,
  computeDropInActiveFromUserData,
  viewerInDropInAudience,
};

export type DropInPlace = {
  name: string;
  placeId?: string;
  lat?: number;
  lng?: number;
  address?: string;
};

export type DropInState = {
  active: boolean;
  text: string;
  place: DropInPlace | null;
  startedAtMs: number | null;
  expiresAtMs: number | null;
  audienceMode: "all" | "groups";
  visibleTo: string[];
};

export type FriendDropIn = {
  friendId: string;
  displayName: string;
  imageurl?: string;
  text: string;
  place: DropInPlace | null;
  expiresAtMs: number;
};

const functions = getFunctions(app, "us-central1");

const createDropInFn = httpsCallable<
  {
    text: string;
    place?: DropInPlace | null;
    audienceMode: "all" | "groups";
    audienceGroupIds?: string[];
  },
  {
    ok: boolean;
    expiresAtMs?: number;
    alreadyActive?: boolean;
    notifiedCount?: number;
  }
>(functions, "createDropIn");

const cancelDropInFn = httpsCallable<Record<string, never>, { ok: boolean }>(
  functions,
  "cancelDropIn"
);

export function parseDropInState(
  userData: Record<string, unknown> | null | undefined
): DropInState {
  const active = computeDropInActiveFromUserData(userData);
  const place = normalizeDropInPlace(userData?.dropInPlace);
  const mode =
    String(userData?.dropInAudienceMode || "all") === "groups" ? "groups" : "all";
  const visibleTo = Array.isArray(userData?.dropInVisibleTo)
    ? userData.dropInVisibleTo.map((id) => String(id || "").trim()).filter(Boolean)
    : [];
  const expiresParsed = active ? timestampMillis(userData?.dropInExpiresAt) : null;
  const startedParsed = active ? timestampMillis(userData?.dropInStartedAt) : null;
  return {
    active,
    text: active ? normalizeDropInText(String(userData?.dropInText || "")) : "",
    place: active ? place : null,
    startedAtMs: active ? startedParsed ?? Date.now() : null,
    expiresAtMs: active
      ? expiresParsed ?? Date.now() + DROP_IN_EXPIRATION_MS
      : null,
    audienceMode: mode,
    visibleTo,
  };
}

export function dropInRemainingMs(expiresAtMs: number | null): number {
  if (expiresAtMs == null) return 0;
  return Math.max(0, expiresAtMs - Date.now());
}

export function formatDropInRemaining(expiresAtMs: number | null): string {
  const ms = dropInRemainingMs(expiresAtMs);
  if (ms <= 0) return "ended";
  const mins = Math.ceil(ms / 60000);
  if (mins < 60) return `${mins}m left`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hours}h ${rem}m left` : `${hours}h left`;
}

export function dropInErrorMessage(err: unknown): string {
  if (err instanceof FirebaseError) {
    switch (err.code) {
      case "functions/resource-exhausted":
        return err.message || "You can share again in a bit.";
      case "functions/failed-precondition":
        return err.message || "Couldn't share live status right now.";
      case "functions/invalid-argument":
        return err.message || "Add where you are.";
      case "functions/unauthenticated":
        return "Sign in to share live status.";
      case "functions/permission-denied":
        return "Live status sharing isn't available yet. Try again in a moment.";
      case "functions/not-found":
        return "Live status isn't available yet. Try again after an update.";
      default:
        return err.message || "Could not share live status.";
    }
  }
  if (err instanceof Error && err.message) return err.message;
  return "Could not share live status.";
}

function isCallableTransportError(err: unknown): boolean {
  if (!(err instanceof FirebaseError)) return false;
  return (
    err.code === "functions/permission-denied" ||
    err.code === "functions/unavailable" ||
    err.code === "functions/internal" ||
    err.code === "functions/unknown" ||
    /not authorized|401|UNAUTHENTICATED/i.test(err.message || "")
  );
}

async function loadFriendGroupsForUid(uid: string): Promise<FriendGroup[]> {
  const snap = await getDocs(collection(db, "users", uid, "friendGroups"));
  return snap.docs.map((d) => {
    const data = d.data() || {};
    return {
      id: d.id,
      name: String(data.name || "").trim() || "Circle",
      memberIds: Array.isArray(data.memberIds)
        ? data.memberIds
            .map((id: unknown) => String(id || "").trim())
            .filter(Boolean)
        : [],
      sortOrder:
        typeof data.sortOrder === "number" && Number.isFinite(data.sortOrder)
          ? data.sortOrder
          : 0,
    };
  });
}

/** Direct Firestore write — used when the callable is blocked by Cloud Run IAM. */
async function createDropInViaFirestore(input: {
  text: string;
  place?: DropInPlace | null;
  audience: SynqAudienceSelection;
}): Promise<{ expiresAtMs: number; alreadyActive?: boolean }> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Sign in to share live status.");

  const userRef = doc(db, "users", uid);
  const existing = await getDoc(userRef);
  const existingData = existing.exists()
    ? (existing.data() as Record<string, unknown>)
    : null;
  if (computeDropInActiveFromUserData(existingData)) {
    const expiresAtMs =
      timestampMillis(existingData?.dropInExpiresAt) ||
      Date.now() + DROP_IN_EXPIRATION_MS;
    return { expiresAtMs, alreadyActive: true };
  }

  const friendsSnap = await getDocs(collection(db, "users", uid, "friends"));
  const allFriendIds = friendsSnap.docs.map((d) => d.id);
  if (allFriendIds.length === 0) {
    throw new Error("Add friends before sharing live status.");
  }

  const groups =
    input.audience.mode === "groups" ? await loadFriendGroupsForUid(uid) : [];
  const visibleTo = resolveSynqVisibleTo(
    input.audience,
    groups,
    allFriendIds
  ).filter((id) => id !== uid);
  if (visibleTo.length === 0) {
    throw new Error("No friends in that audience to notify.");
  }

  const text = normalizeDropInText(input.text);
  const place = normalizeDropInPlace(input.place) || {
    name: String(input.place?.name || text || "").trim(),
  };
  const atLabel = String(place?.name || text || "").trim();
  if (!atLabel) throw new Error("Add where you are.");
  const storedText = text && text !== atLabel ? text : atLabel;

  const nowMs = Date.now();
  const expiresAtMs = nowMs + DROP_IN_EXPIRATION_MS;
  await updateDoc(userRef, {
    dropInActive: true,
    dropInText: storedText,
    dropInPlace: place,
    dropInStartedAt: Timestamp.fromMillis(nowMs),
    dropInExpiresAt: Timestamp.fromMillis(expiresAtMs),
    dropInAudienceMode: input.audience.mode,
    dropInAudienceGroupIds:
      input.audience.mode === "groups" ? input.audience.groupIds : [],
    dropInVisibleTo: visibleTo,
  });

  return { expiresAtMs };
}

async function cancelDropInViaFirestore(): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Sign in to end live status.");
  await updateDoc(doc(db, "users", uid), {
    dropInActive: false,
    dropInText: deleteField(),
    dropInPlace: deleteField(),
    dropInStartedAt: deleteField(),
    dropInExpiresAt: deleteField(),
    dropInAudienceMode: deleteField(),
    dropInAudienceGroupIds: deleteField(),
    dropInVisibleTo: deleteField(),
  });
}

export async function createDropIn(input: {
  text: string;
  place?: DropInPlace | null;
  audience: SynqAudienceSelection;
}): Promise<{ expiresAtMs: number; alreadyActive?: boolean }> {
  const text = normalizeDropInText(input.text);
  const placeName = String(input.place?.name || "").trim();
  if (!placeName && !text) {
    throw new Error("Add where you are.");
  }
  // Prefer direct Firestore write (triggers onDropInActivated fan-out). The
  // callable is optional — Cloud Run IAM has blocked it before.
  try {
    return await createDropInViaFirestore({
      text,
      place: input.place ?? null,
      audience: input.audience,
    });
  } catch (firestoreErr) {
    try {
      const result = await createDropInFn({
        text,
        place: input.place ?? null,
        audienceMode: input.audience.mode,
        audienceGroupIds:
          input.audience.mode === "groups" ? input.audience.groupIds : [],
      });
      const expiresAtMs = Number(result?.data?.expiresAtMs);
      return {
        expiresAtMs:
          Number.isFinite(expiresAtMs) && expiresAtMs > 0
            ? expiresAtMs
            : Date.now() + DROP_IN_EXPIRATION_MS,
        alreadyActive: !!result?.data?.alreadyActive,
      };
    } catch (callableErr) {
      if (isCallableTransportError(callableErr)) throw firestoreErr;
      throw callableErr;
    }
  }
}

export async function cancelDropIn(): Promise<void> {
  try {
    await cancelDropInViaFirestore();
  } catch (firestoreErr) {
    try {
      await cancelDropInFn({});
    } catch (callableErr) {
      if (isCallableTransportError(callableErr)) throw firestoreErr;
      throw callableErr;
    }
  }
}

/** Server-truth live drop-in for the signed-in user (bypasses cache). */
export async function fetchMyDropInFromServer(): Promise<DropInState | null> {
  const uid = auth.currentUser?.uid;
  if (!uid) return null;
  const snap = await getDocFromServer(doc(db, "users", uid));
  if (!snap.exists()) return null;
  return parseDropInState(snap.data() as Record<string, unknown>);
}

export function warmDropInClient(): void {
  void auth.currentUser?.getIdToken().catch(() => {});
}

const DROP_IN_POLL_TTL_MS = 45_000;

function friendDropInFromData(
  friendId: string,
  data: Record<string, unknown>,
  viewerId: string
): FriendDropIn | null {
  if (!viewerInDropInAudience(data, viewerId)) return null;
  const text = normalizeDropInText(String(data.dropInText || ""));
  if (!text) return null;
  const expiresAtMs = timestampMillis(data.dropInExpiresAt);
  if (expiresAtMs == null || expiresAtMs <= Date.now()) return null;
  const place = normalizeDropInPlace(data.dropInPlace);
  return {
    friendId,
    displayName: String(data.displayName || "").trim() || "Friend",
    imageurl: data.imageurl ? String(data.imageurl) : undefined,
    text,
    place,
    expiresAtMs,
  };
}

/** Poll friends for live Drop-ins (viewer must be in their audience). */
export async function pollActiveFriendDropIns(
  viewerId: string,
  friendIds: string[],
  options: { force?: boolean } = {}
): Promise<FriendDropIn[]> {
  const viewer = String(viewerId || "").trim();
  const ids = Array.isArray(friendIds)
    ? [...new Set(friendIds.map((id) => String(id || "").trim()).filter(Boolean))]
    : [];
  if (!viewer || ids.length === 0) return [];

  const force = !!options?.force;
  const now = Date.now();
  if (!friendProfileCacheByUser[viewer]) {
    friendProfileCacheByUser[viewer] = {};
  }
  if (!friendProfileFetchedAtByUser[viewer]) {
    friendProfileFetchedAtByUser[viewer] = {};
  }
  const profileCache = friendProfileCacheByUser[viewer];
  const fetchedAtMap = friendProfileFetchedAtByUser[viewer];
  const results: FriendDropIn[] = [];

  await Promise.all(
    ids.map(async (fid) => {
      try {
        const cachedProfile = profileCache[fid] as
          | (Friend & Record<string, unknown>)
          | undefined;
        const profileAge = fetchedAtMap[fid] ?? 0;
        const cachedActive =
          !!cachedProfile &&
          viewerInDropInAudience(
            cachedProfile as Record<string, unknown>,
            viewer
          );
        const mustRefresh = force || cachedActive;
        const profileFresh =
          !mustRefresh &&
          !!cachedProfile &&
          now - profileAge < DROP_IN_POLL_TTL_MS;

        let data: Record<string, unknown> | null = null;
        if (profileFresh && cachedProfile) {
          data = cachedProfile as unknown as Record<string, unknown>;
        } else {
          const snap = mustRefresh
            ? await getDocFromServer(doc(db, "users", fid))
            : await getDoc(doc(db, "users", fid));
          if (!snap.exists()) return;
          const raw = snap.data();
          if (!raw || typeof raw !== "object") return;
          data = raw as Record<string, unknown>;
          profileCache[fid] = { id: fid, ...data } as Friend;
          fetchedAtMap[fid] = now;
        }

        if (!data) return;
        const dropIn = friendDropInFromData(fid, data, viewer);
        if (dropIn) results.push(dropIn);
      } catch {
        // Skip friends we can't read.
      }
    })
  );

  return results.sort((a, b) => a.displayName.localeCompare(b.displayName));
}
