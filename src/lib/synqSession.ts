import AsyncStorage from "@react-native-async-storage/async-storage";
import type { DocumentData } from "firebase/firestore";

import { EXPIRATION_HOURS } from "../../constants/Variables";

export function synqStatusStorageKey(uid: string) {
  return `synq-status:${uid}`;
}

const synqActiveMemoryCache: Record<string, boolean | undefined> = {};

export function computeSynqActiveFromUserData(data: DocumentData | undefined): boolean {
  if (!data || data.status !== "available" || !data.synqStartedAt) return false;
  const startTime = data.synqStartedAt.toDate().getTime();
  const hoursElapsed = (Date.now() - startTime) / (1000 * 60 * 60);
  return hoursElapsed <= EXPIRATION_HOURS;
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
