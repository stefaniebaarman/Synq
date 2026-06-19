import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";

import { db } from "./firebase";
import {
  MAX_COMMUNITY_GROUP_MEMBERS as MAX_MEMBERS,
  mergeCommunityGroupMemberIds as mergeMemberIdsCore,
} from "./communityGroupsCore.js";
import { uploadCommunityCoverPhoto } from "./uploadCommunityCoverPhoto";

export const MAX_COMMUNITY_GROUP_MEMBERS = MAX_MEMBERS;
export const MAX_COMMUNITY_GROUPS_JOINED = 50;
export const MAX_COMMUNITY_GROUPS_CREATED = 10;
export const COMMUNITY_GROUP_SEARCH_LIMIT = 25;
export const ALL_COMMUNITY_GROUPS_LIMIT = 200;

export type CommunityGroup = {
  id: string;
  name: string;
  nameLower: string;
  creatorId: string;
  memberIds: string[];
  category?: string;
  location?: string;
  about?: string;
  coverPhotoUrl?: string;
  coverPhotoThumbUrl?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type CreateCommunityGroupInput = {
  name: string;
  category?: string;
  location?: string;
  about?: string;
  coverPhotoUrl?: string;
};

export function communityGroupsCollection() {
  return collection(db, "communityGroups");
}

export function communityGroupRef(groupId: string) {
  return doc(db, "communityGroups", groupId);
}

export async function getCommunityGroup(groupId: string): Promise<CommunityGroup | null> {
  const snap = await getDoc(communityGroupRef(groupId));
  if (!snap.exists()) return null;
  return mapCommunityGroupDoc(snap.id, snap.data() as Record<string, unknown>);
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function normalizeNameLower(name: string): string {
  return normalizeName(name).toLowerCase();
}

function normalizeMemberIds(memberIds: string[]): string[] {
  return [...new Set(memberIds.map((id) => String(id || "").trim()).filter(Boolean))].slice(
    0,
    MAX_COMMUNITY_GROUP_MEMBERS
  );
}

function optionalTrimmed(value: unknown, maxLen: number): string | undefined {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLen);
}

export function mapCommunityGroupDoc(id: string, data: Record<string, unknown>): CommunityGroup {
  const category = optionalTrimmed(data.category, 40);
  const location = optionalTrimmed(data.location, 80);
  const about = optionalTrimmed(data.about, 500);
  const coverPhotoUrl = optionalTrimmed(data.coverPhotoUrl, 2048);
  const coverPhotoThumbUrl = optionalTrimmed(data.coverPhotoThumbUrl, 2048);

  return {
    id,
    name: String(data.name || "").trim() || "Group",
    nameLower: String(data.nameLower || "").trim(),
    creatorId: String(data.creatorId || "").trim(),
    memberIds: normalizeMemberIds(
      Array.isArray(data.memberIds) ? (data.memberIds as string[]) : []
    ),
    ...(category ? { category } : {}),
    ...(location ? { location } : {}),
    ...(about ? { about } : {}),
    ...(coverPhotoUrl ? { coverPhotoUrl } : {}),
    ...(coverPhotoThumbUrl ? { coverPhotoThumbUrl } : {}),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export function subscribeJoinedCommunityGroups(
  uid: string,
  onData: (groups: CommunityGroup[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const q = query(communityGroupsCollection(), where("memberIds", "array-contains", uid));
  return onSnapshot(
    q,
    (snap) => {
      const groups = snap.docs
        .map((d) => mapCommunityGroupDoc(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => a.name.localeCompare(b.name));
      onData(groups);
    },
    (err) => onError?.(err)
  );
}

export async function searchCommunityGroups(searchText: string): Promise<CommunityGroup[]> {
  const q = normalizeNameLower(searchText);
  if (!q) return [];

  const snap = await getDocs(
    query(
      communityGroupsCollection(),
      where("nameLower", ">=", q),
      where("nameLower", "<=", `${q}\uf8ff`),
      orderBy("nameLower"),
      limit(COMMUNITY_GROUP_SEARCH_LIMIT)
    )
  );

  return snap.docs.map((d) => mapCommunityGroupDoc(d.id, d.data() as Record<string, unknown>));
}

export async function fetchAllCommunityGroups(
  limitCount = ALL_COMMUNITY_GROUPS_LIMIT
): Promise<CommunityGroup[]> {
  const snap = await getDocs(
    query(communityGroupsCollection(), orderBy("nameLower"), limit(limitCount))
  );

  return snap.docs
    .map((d) => mapCommunityGroupDoc(d.id, d.data() as Record<string, unknown>))
    .filter((g) => g.memberIds.length > 0);
}

export async function fetchCommunityGroupsByCategory(
  category: string,
  limitCount = COMMUNITY_GROUP_SEARCH_LIMIT
): Promise<CommunityGroup[]> {
  const trimmed = category.trim();
  if (!trimmed) return [];

  const snap = await getDocs(
    query(
      communityGroupsCollection(),
      where("category", "==", trimmed),
      limit(limitCount)
    )
  );

  return snap.docs
    .map((d) => mapCommunityGroupDoc(d.id, d.data() as Record<string, unknown>))
    .filter((g) => g.memberIds.length > 0)
    .sort((a, b) => b.memberIds.length - a.memberIds.length || a.name.localeCompare(b.name));
}

/** Groups the user has not joined, returned in random order for suggested UI. */
export async function fetchSuggestedCommunityGroups(
  excludeIds: Set<string>,
  limitCount = 3
): Promise<CommunityGroup[]> {
  const snap = await getDocs(query(communityGroupsCollection(), limit(50)));
  const eligible = snap.docs
    .map((d) => mapCommunityGroupDoc(d.id, d.data() as Record<string, unknown>))
    .filter((g) => !excludeIds.has(g.id) && g.memberIds.length > 0);

  for (let i = eligible.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
  }

  return eligible.slice(0, limitCount);
}

/** @deprecated Use fetchSuggestedCommunityGroups */
export async function fetchDiscoverCommunityGroups(
  excludeIds: Set<string>,
  limitCount = 8
): Promise<CommunityGroup[]> {
  const snap = await getDocs(query(communityGroupsCollection(), limit(50)));
  return snap.docs
    .map((d) => mapCommunityGroupDoc(d.id, d.data() as Record<string, unknown>))
    .filter((g) => !excludeIds.has(g.id) && g.memberIds.length > 0)
    .sort((a, b) => b.memberIds.length - a.memberIds.length)
    .slice(0, limitCount);
}

export async function createCommunityGroup(
  uid: string,
  input: CreateCommunityGroupInput | string,
  coverLocalUri?: string
): Promise<string> {
  const payload = typeof input === "string" ? { name: input } : input;
  const trimmed = normalizeName(payload.name);
  if (!trimmed) {
    throw new Error("Group name is required.");
  }

  const category = optionalTrimmed(payload.category, 40);
  const location = optionalTrimmed(payload.location, 80);
  const about = optionalTrimmed(payload.about, 500);
  let coverPhotoUrl = optionalTrimmed(payload.coverPhotoUrl, 2048);

  const createdSnap = await getDocs(
    query(communityGroupsCollection(), where("creatorId", "==", uid))
  );
  if (createdSnap.size >= MAX_COMMUNITY_GROUPS_CREATED) {
    throw new Error(`You can create at most ${MAX_COMMUNITY_GROUPS_CREATED} community groups.`);
  }

  const joinedSnap = await getDocs(
    query(communityGroupsCollection(), where("memberIds", "array-contains", uid))
  );
  if (joinedSnap.size >= MAX_COMMUNITY_GROUPS_JOINED) {
    throw new Error(`You can join at most ${MAX_COMMUNITY_GROUPS_JOINED} community groups.`);
  }

  const ref = doc(communityGroupsCollection());

  await setDoc(ref, {
    name: trimmed,
    nameLower: normalizeNameLower(trimmed),
    creatorId: uid,
    memberIds: [uid],
    ...(category ? { category } : {}),
    ...(location ? { location } : {}),
    ...(about ? { about } : {}),
    ...(coverPhotoUrl ? { coverPhotoUrl } : {}),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  if (coverLocalUri) {
    const uploaded = await uploadCommunityCoverPhoto(ref.id, coverLocalUri);
    coverPhotoUrl = uploaded.coverPhotoUrl;
    await updateDoc(ref, {
      coverPhotoUrl: uploaded.coverPhotoUrl,
      coverPhotoThumbUrl: uploaded.coverPhotoThumbUrl,
      updatedAt: serverTimestamp(),
    });
  }

  return ref.id;
}

export async function updateCommunityGroupDetails(
  groupId: string,
  input: Partial<CreateCommunityGroupInput> & { coverPhotoThumbUrl?: string }
): Promise<void> {
  const updates: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (input.name !== undefined) {
    const trimmed = normalizeName(input.name);
    if (!trimmed) {
      throw new Error("Group name is required.");
    }
    updates.name = trimmed;
    updates.nameLower = normalizeNameLower(trimmed);
  }
  if (input.category !== undefined) {
    const category = optionalTrimmed(input.category, 40);
    updates.category = category ?? "";
  }
  if (input.location !== undefined) {
    const location = optionalTrimmed(input.location, 80);
    updates.location = location ?? "";
  }
  if (input.about !== undefined) {
    const about = optionalTrimmed(input.about, 500);
    updates.about = about ?? "";
  }
  if (input.coverPhotoUrl !== undefined) {
    const coverPhotoUrl = optionalTrimmed(input.coverPhotoUrl, 2048);
    updates.coverPhotoUrl = coverPhotoUrl ?? "";
  }
  if (input.coverPhotoThumbUrl !== undefined) {
    const coverPhotoThumbUrl = optionalTrimmed(input.coverPhotoThumbUrl, 2048);
    updates.coverPhotoThumbUrl = coverPhotoThumbUrl ?? "";
  }

  await updateDoc(communityGroupRef(groupId), updates);
}

export async function joinCommunityGroup(
  uid: string,
  groupId: string,
  _currentMemberIds?: string[]
): Promise<string[]> {
  const joinedSnap = await getDocs(
    query(communityGroupsCollection(), where("memberIds", "array-contains", uid))
  );
  if (joinedSnap.size >= MAX_COMMUNITY_GROUPS_JOINED) {
    throw new Error(`You can join at most ${MAX_COMMUNITY_GROUPS_JOINED} community groups.`);
  }

  return runTransaction(db, async (transaction) => {
    const ref = communityGroupRef(groupId);
    const snap = await transaction.get(ref);
    if (!snap.exists()) {
      throw new Error("This group no longer exists.");
    }
    const data = snap.data() as Record<string, unknown>;
    const currentMemberIds = normalizeMemberIds(
      Array.isArray(data.memberIds) ? (data.memberIds as string[]) : []
    );
    if (currentMemberIds.includes(uid)) {
      return currentMemberIds;
    }
    if (currentMemberIds.length >= MAX_COMMUNITY_GROUP_MEMBERS) {
      throw new Error("This group is full.");
    }
    const next = normalizeMemberIds([...currentMemberIds, uid]);
    transaction.update(ref, {
      memberIds: next,
      updatedAt: serverTimestamp(),
    });
    return next;
  });
}

export async function leaveCommunityGroup(
  uid: string,
  groupId: string,
  _currentMemberIds?: string[]
): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const ref = communityGroupRef(groupId);
    const snap = await transaction.get(ref);
    if (!snap.exists()) return;
    const data = snap.data() as Record<string, unknown>;
    const currentMemberIds = normalizeMemberIds(
      Array.isArray(data.memberIds) ? (data.memberIds as string[]) : []
    );
    const next = currentMemberIds.filter((id) => id !== uid);
    if (next.length === 0) {
      transaction.delete(ref);
      return;
    }
    transaction.update(ref, {
      memberIds: next,
      updatedAt: serverTimestamp(),
    });
  });
}

export async function renameCommunityGroup(groupId: string, name: string): Promise<void> {
  const trimmed = normalizeName(name);
  if (!trimmed) {
    throw new Error("Group name is required.");
  }
  await updateDoc(communityGroupRef(groupId), {
    name: trimmed,
    nameLower: normalizeNameLower(trimmed),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteCommunityGroup(groupId: string): Promise<void> {
  await deleteDoc(communityGroupRef(groupId));
}

export function mergeCommunityGroupMemberIds(
  currentMemberIds: string[],
  newMemberIds: string[]
): string[] {
  return mergeMemberIdsCore(currentMemberIds, newMemberIds);
}

export async function addMembersToCommunityGroup(
  groupId: string,
  _currentMemberIds: string[],
  newMemberIds: string[]
): Promise<string[]> {
  return runTransaction(db, async (transaction) => {
    const ref = communityGroupRef(groupId);
    const snap = await transaction.get(ref);
    if (!snap.exists()) {
      throw new Error("This group no longer exists.");
    }
    const data = snap.data() as Record<string, unknown>;
    const currentMemberIds = normalizeMemberIds(
      Array.isArray(data.memberIds) ? (data.memberIds as string[]) : []
    );
    const merged = mergeCommunityGroupMemberIds(currentMemberIds, newMemberIds);
    if (merged.length === currentMemberIds.length) {
      return merged;
    }
    transaction.update(ref, {
      memberIds: merged,
      updatedAt: serverTimestamp(),
    });
    return merged;
  });
}

export async function removeMemberFromCommunityGroup(
  groupId: string,
  _currentMemberIds: string[],
  memberId: string
): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const ref = communityGroupRef(groupId);
    const snap = await transaction.get(ref);
    if (!snap.exists()) return;
    const data = snap.data() as Record<string, unknown>;
    const currentMemberIds = normalizeMemberIds(
      Array.isArray(data.memberIds) ? (data.memberIds as string[]) : []
    );
    const next = currentMemberIds.filter((id) => id !== memberId);
    if (next.length === 0) {
      transaction.delete(ref);
      return;
    }
    transaction.update(ref, {
      memberIds: next,
      updatedAt: serverTimestamp(),
    });
  });
}
