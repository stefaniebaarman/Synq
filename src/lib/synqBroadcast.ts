import AsyncStorage from "@react-native-async-storage/async-storage";

import type { FriendGroup } from "./friendGroups";
import {
  buildSynqBroadcastFirestorePayload as buildPayloadCore,
  filterActiveFriendsForInbound as filterInboundCore,
  getMyAudienceSet as getMyAudienceSetCore,
  isRecipientInSynqVisibleTo,
  resolveSynqVisibleTo as resolveVisibleToCore,
  SYNQ_RECIPROCAL_INBOUND,
  viewerInFriendAudience,
} from "./synqBroadcastCore.js";
import { computeSynqActiveFromUserData } from "./synqSession";

export type SynqBroadcastMode = "all" | "groups";

export type SynqAudienceSelection = {
  mode: SynqBroadcastMode;
  groupIds: string[];
};

export const SYNQ_AUDIENCE_STORAGE_PREFIX = "synq-audience:";

export { SYNQ_RECIPROCAL_INBOUND, isRecipientInSynqVisibleTo, viewerInFriendAudience };

const defaultSelection = (): SynqAudienceSelection => ({
  mode: "all",
  groupIds: [],
});

export async function loadSynqAudiencePreference(
  uid: string
): Promise<SynqAudienceSelection> {
  if (!uid) return defaultSelection();
  try {
    const raw = await AsyncStorage.getItem(`${SYNQ_AUDIENCE_STORAGE_PREFIX}${uid}`);
    if (!raw) return defaultSelection();
    const parsed = JSON.parse(raw) as Partial<SynqAudienceSelection>;
    if (parsed.mode === "all") return { mode: "all", groupIds: [] };
    if (parsed.mode === "groups" && Array.isArray(parsed.groupIds)) {
      return {
        mode: "groups",
        groupIds: [...new Set(parsed.groupIds.map((id) => String(id || "").trim()).filter(Boolean))],
      };
    }
    return defaultSelection();
  } catch {
    return defaultSelection();
  }
}

export async function saveSynqAudiencePreference(
  uid: string,
  selection: SynqAudienceSelection
): Promise<void> {
  if (!uid) return;
  const payload: SynqAudienceSelection =
    selection.mode === "all"
      ? { mode: "all", groupIds: [] }
      : {
          mode: "groups",
          groupIds: [...new Set(selection.groupIds.filter(Boolean))],
        };
  await AsyncStorage.setItem(
    `${SYNQ_AUDIENCE_STORAGE_PREFIX}${uid}`,
    JSON.stringify(payload)
  );
}

export function resolveSynqVisibleTo(
  selection: SynqAudienceSelection,
  groups: FriendGroup[],
  allFriendIds: string[]
): string[] {
  return resolveVisibleToCore(selection, groups, allFriendIds);
}

export function buildSynqBroadcastFirestorePayload(
  selection: SynqAudienceSelection,
  groups: FriendGroup[],
  allFriendIds: string[]
): {
  synqBroadcastMode: SynqBroadcastMode;
  synqBroadcastGroupIds: string[];
  synqVisibleTo: string[];
} {
  return buildPayloadCore(selection, groups, allFriendIds) as {
    synqBroadcastMode: SynqBroadcastMode;
    synqBroadcastGroupIds: string[];
    synqVisibleTo: string[];
  };
}

export function selectionFromUserBroadcastFields(
  userData: Record<string, unknown> | null | undefined
): SynqAudienceSelection {
  const mode = String(userData?.synqBroadcastMode ?? "all");
  if (mode !== "groups") return { mode: "all", groupIds: [] };
  const ids = userData?.synqBroadcastGroupIds;
  const groupIds = Array.isArray(ids)
    ? ids.map((id) => String(id || "").trim()).filter(Boolean)
    : [];
  return { mode: "groups", groupIds };
}

export function getMyAudienceSet(
  userData: Record<string, unknown> | null | undefined,
  allFriendIds: string[]
): Set<string> {
  return getMyAudienceSetCore(userData, allFriendIds);
}

export function filterActiveFriendsForInbound(
  activeFriends: { id: string; [key: string]: unknown }[],
  options: {
    myAudience: Set<string>;
    viewerId: string;
    reciprocal?: boolean;
  }
): typeof activeFriends {
  return filterInboundCore(activeFriends, options) as typeof activeFriends;
}

export function formatAudienceSelectionLabel(
  selection: SynqAudienceSelection,
  groups: FriendGroup[]
): string {
  if (selection.mode === "all" || selection.groupIds.length === 0) {
    return "All friends";
  }
  const names = selection.groupIds
    .map((id) => groups.find((g) => g.id === id)?.name)
    .filter((n): n is string => Boolean(n));
  if (names.length === 0) return "Groups";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} · ${names[1]}`;
  return `${names.length} groups`;
}

export function formatSynqAudienceLabel(
  userData: Record<string, unknown> | null | undefined,
  groups: FriendGroup[]
): string | null {
  if (!userData || !computeSynqActiveFromUserData(userData)) return null;
  return formatAudienceSelectionLabel(selectionFromUserBroadcastFields(userData), groups);
}
