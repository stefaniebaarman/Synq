import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";

import { db, auth } from "./firebase";
import {
  MAX_COMMUNITY_GROUP_MEMBERS as MAX_MEMBERS,
} from "./communityGroupsCore.js";
import { uploadCommunityCoverPhoto, deleteCommunityCoverPhotos } from "./uploadCommunityCoverPhoto";
import { getFunctions, httpsCallable } from "firebase/functions";

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
  /** Lightweight member cards to avoid N getDoc(user) on group open. */
  memberPreviews?: Record<string, { displayName?: string; imageurl?: string }>;
  category?: string;
  location?: string;
  about?: string;
  coverPhotoUrl?: string;
  coverPhotoThumbUrl?: string;
  shareCode?: string;
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

/**
 * Keep this group first in the viewer's communityGroupIds so rules
 * sharesCommunityWithTarget (first 10 only) can resolve co-member profile reads.
 */
export async function ensureCommunityGroupIdOnUser(
  uid: string,
  groupId: string
): Promise<void> {
  const id = String(groupId || "").trim();
  if (!uid || !id) return;

  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);
  const raw = snap.exists()
    ? (snap.data() as { communityGroupIds?: unknown }).communityGroupIds
    : [];
  const existing = Array.isArray(raw)
    ? [
        ...new Set(
          raw.map((x) => String(x || "").trim()).filter(Boolean)
        ),
      ]
    : [];
  const rest = existing.filter((x) => x !== id);
  const next = [id, ...rest].slice(0, 50);
  const unchanged =
    existing.length === next.length &&
    existing.every((value, index) => value === next[index]);
  if (unchanged) return;

  await updateDoc(userRef, { communityGroupIds: next });
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

async function viewerMemberPreview(
  uid: string
): Promise<{ displayName: string; imageurl?: string }> {
  let displayName =
    auth.currentUser?.uid === uid
      ? String(auth.currentUser.displayName || "").trim()
      : "";
  let imageurl: string | undefined;

  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (snap.exists()) {
      const data = snap.data() as { displayName?: string; imageurl?: string };
      displayName = String(data.displayName || "").trim() || displayName;
      const photo = String(data.imageurl || "").trim();
      if (photo) imageurl = photo;
    }
  } catch {
    // Fall back to auth display name.
  }

  return {
    displayName: displayName || "Member",
    ...(imageurl ? { imageurl } : {}),
  };
}

export function mapCommunityGroupDoc(id: string, data: Record<string, unknown>): CommunityGroup {
  const category = optionalTrimmed(data.category, 40);
  const location = optionalTrimmed(data.location, 80);
  const about = optionalTrimmed(data.about, 500);
  const coverPhotoUrl = optionalTrimmed(data.coverPhotoUrl, 2048);
  const coverPhotoThumbUrl = optionalTrimmed(data.coverPhotoThumbUrl, 2048);
  const shareCode = optionalTrimmed(data.shareCode, 32)?.toUpperCase();
  const rawPreviews =
    data.memberPreviews && typeof data.memberPreviews === "object"
      ? (data.memberPreviews as Record<string, { displayName?: string; imageurl?: string }>)
      : undefined;

  return {
    id,
    name: String(data.name || "").trim() || "Group",
    nameLower: String(data.nameLower || "").trim(),
    creatorId: String(data.creatorId || "").trim(),
    memberIds: normalizeMemberIds(
      Array.isArray(data.memberIds) ? (data.memberIds as string[]) : []
    ),
    ...(rawPreviews ? { memberPreviews: rawPreviews } : {}),
    ...(category ? { category } : {}),
    ...(location ? { location } : {}),
    ...(about ? { about } : {}),
    ...(coverPhotoUrl ? { coverPhotoUrl } : {}),
    ...(coverPhotoThumbUrl ? { coverPhotoThumbUrl } : {}),
    ...(shareCode ? { shareCode } : {}),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export function subscribeJoinedCommunityGroups(
  uid: string,
  onData: (groups: CommunityGroup[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  // Lazy require avoids a circular import with socialListenerHub.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { subscribeJoinedCommunityGroupsMultiplexed } =
    require("./socialListenerHub") as typeof import("./socialListenerHub");
  return subscribeJoinedCommunityGroupsMultiplexed(
    uid,
    (groups) => {
      onData(groups as CommunityGroup[]);
    },
    onError
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
  const preview = await viewerMemberPreview(uid);

  await setDoc(ref, {
    name: trimmed,
    nameLower: normalizeNameLower(trimmed),
    creatorId: uid,
    memberIds: [uid],
    memberPreviews: {
      [uid]: preview,
    },
    ...(category ? { category } : {}),
    ...(location ? { location } : {}),
    ...(about ? { about } : {}),
    ...(coverPhotoUrl ? { coverPhotoUrl } : {}),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Denormalized for scoped profile reads among community co-members.
  await ensureCommunityGroupIdOnUser(uid, ref.id).catch(() => {
    void ensureCommunityGroupIdOnUser(uid, ref.id);
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

  const preview = await viewerMemberPreview(uid);

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
    const existingPreviews =
      data.memberPreviews && typeof data.memberPreviews === "object"
        ? { ...(data.memberPreviews as Record<string, unknown>) }
        : {};
    existingPreviews[uid] = preview;
    transaction.update(ref, {
      memberIds: next,
      memberPreviews: existingPreviews,
      updatedAt: serverTimestamp(),
    });
    return next;
  }).then(async (next) => {
    await ensureCommunityGroupIdOnUser(uid, groupId).catch(() => {
      void ensureCommunityGroupIdOnUser(uid, groupId);
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
    const existingPreviews =
      data.memberPreviews && typeof data.memberPreviews === "object"
        ? { ...(data.memberPreviews as Record<string, unknown>) }
        : {};
    delete existingPreviews[uid];
    transaction.update(ref, {
      memberIds: next,
      memberPreviews: existingPreviews,
      updatedAt: serverTimestamp(),
    });
  });
  await updateDoc(doc(db, "users", uid), {
    communityGroupIds: arrayRemove(groupId),
  }).catch(() => {});
}

export async function deleteCommunityGroup(groupId: string): Promise<void> {
  const id = String(groupId || "").trim();
  if (!id) {
    throw new Error("Community not found.");
  }
  await deleteCommunityCoverPhotos(id).catch(() => {});
  const functions = getFunctions(undefined, "us-central1");
  const deleteGroup = httpsCallable(functions, "deleteCommunityGroup");
  await deleteGroup({ groupId: id });
}

export async function removeMemberFromCommunityGroup(
  groupId: string,
  _currentMemberIds: string[],
  memberId: string
): Promise<void> {
  const id = String(groupId || "").trim();
  const targetId = String(memberId || "").trim();
  if (!id || !targetId) {
    throw new Error("Missing community or member.");
  }

  const functions = getFunctions(undefined, "us-central1");
  const removeMember = httpsCallable(functions, "removeCommunityGroupMember");
  await removeMember({ groupId: id, memberId: targetId });
}
