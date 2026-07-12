import AsyncStorage from "@react-native-async-storage/async-storage";
import type { DocumentData } from "firebase/firestore";

import { EXPIRATION_HOURS } from "../../constants/Variables";

export function synqStatusStorageKey(uid: string) {
  return `synq-status:${uid}`;
}

const synqActiveMemoryCache: Record<string, boolean | undefined> = {};

export function synqStartedAtMillis(data: DocumentData | undefined): number | null {
  const raw = data?.synqStartedAt;
  if (!raw || typeof raw !== "object") return null;
  if (typeof (raw as { toDate?: unknown }).toDate !== "function") return null;
  try {
    return (raw as { toDate: () => Date }).toDate().getTime();
  } catch {
    return null;
  }
}

export function computeSynqActiveFromUserData(data: DocumentData | undefined): boolean {
  if (!data || data.status !== "available") return false;
  const startMs = synqStartedAtMillis(data);
  if (startMs == null) return false;
  const hoursElapsed = (Date.now() - startMs) / (1000 * 60 * 60);
  return hoursElapsed <= EXPIRATION_HOURS;
}

/** Milliseconds until the current Synq window ends, or 0 if already expired. */
export function millisUntilSynqExpires(data: DocumentData | undefined): number {
  const startMs = synqStartedAtMillis(data);
  if (startMs == null) return 0;
  const expireMs = startMs + EXPIRATION_HOURS * 60 * 60 * 1000;
  return Math.max(0, expireMs - Date.now());
}

export async function readCachedSynqActive(uid: string): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(synqStatusStorageKey(uid));
    return v === "active";
  } catch {
    return false;
  }
}

/** In-memory snapshot after disk hydrate — safe for first paint on the Synq tab. */
export function getCachedSynqActiveSync(uid: string): boolean {
  return synqActiveMemoryCache[uid] === true;
}

export async function hydrateSynqStatusFromDisk(uid: string): Promise<void> {
  if (!uid) return;
  synqActiveMemoryCache[uid] = await readCachedSynqActive(uid);
}

export function writeCachedSynqActive(uid: string, active: boolean): void {
  synqActiveMemoryCache[uid] = active;
  void AsyncStorage.setItem(
    synqStatusStorageKey(uid),
    active ? "active" : "idle"
  ).catch(() => {});
}
