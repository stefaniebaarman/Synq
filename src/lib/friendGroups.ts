import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";

import { db } from "./firebase";

export const MAX_GROUP_MEMBERS = 50;
export const MAX_FRIEND_GROUPS = 20;

export type FriendGroup = {
  id: string;
  name: string;
  memberIds: string[];
  sortOrder: number;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export function friendGroupsCollection(uid: string) {
  return collection(db, "users", uid, "friendGroups");
}

export function friendGroupRef(uid: string, groupId: string) {
  return doc(db, "users", uid, "friendGroups", groupId);
}

function normalizeMemberIds(memberIds: string[]): string[] {
  return [...new Set(memberIds.map((id) => String(id || "").trim()).filter(Boolean))].slice(
    0,
    MAX_GROUP_MEMBERS
  );
}

export function subscribeFriendGroups(
  uid: string,
  onData: (groups: FriendGroup[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const q = query(friendGroupsCollection(uid));
  return onSnapshot(
    q,
    (snap) => {
      const groups = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: String(data.name || "").trim() || "Group",
            memberIds: normalizeMemberIds(
              Array.isArray(data.memberIds) ? (data.memberIds as string[]) : []
            ),
            sortOrder: typeof data.sortOrder === "number" ? data.sortOrder : 0,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          } satisfies FriendGroup;
        })
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
      onData(groups);
    },
    (err) => onError?.(err)
  );
}

export async function createFriendGroup(
  uid: string,
  name: string,
  memberIds: string[] = []
): Promise<string> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Group name is required.");
  }
  const existing = await getDocs(friendGroupsCollection(uid));
  if (existing.size >= MAX_FRIEND_GROUPS) {
    throw new Error(`You can have at most ${MAX_FRIEND_GROUPS} groups.`);
  }
  const ref = doc(friendGroupsCollection(uid));
  const sortOrder = Date.now();
  await setDoc(ref, {
    name: trimmed,
    memberIds: normalizeMemberIds(memberIds),
    sortOrder,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function renameFriendGroup(
  uid: string,
  groupId: string,
  name: string
): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Group name is required.");
  }
  await updateDoc(friendGroupRef(uid, groupId), {
    name: trimmed,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteFriendGroup(uid: string, groupId: string): Promise<void> {
  await deleteDoc(friendGroupRef(uid, groupId));
}

export async function setFriendGroupMembers(
  uid: string,
  groupId: string,
  memberIds: string[]
): Promise<void> {
  await updateDoc(friendGroupRef(uid, groupId), {
    memberIds: normalizeMemberIds(memberIds),
    updatedAt: serverTimestamp(),
  });
}

export function mergeFriendGroupMemberIds(
  currentMemberIds: string[],
  newMemberIds: string[]
): string[] {
  return normalizeMemberIds([...currentMemberIds, ...newMemberIds]);
}

export async function addMembersToFriendGroup(
  uid: string,
  groupId: string,
  currentMemberIds: string[],
  newMemberIds: string[]
): Promise<string[]> {
  const merged = mergeFriendGroupMemberIds(currentMemberIds, newMemberIds);
  await setFriendGroupMembers(uid, groupId, merged);
  return merged;
}

export async function removeMemberFromFriendGroup(
  uid: string,
  groupId: string,
  currentMemberIds: string[],
  memberId: string
): Promise<void> {
  const next = currentMemberIds.filter((id) => id !== memberId);
  await setFriendGroupMembers(uid, groupId, next);
}

/** Remove a friend from every group owned by uid (after unfriend). */
export async function pruneFriendFromAllGroups(
  uid: string,
  friendId: string
): Promise<void> {
  const snap = await getDocs(friendGroupsCollection(uid));
  if (snap.empty) return;

  const batch = writeBatch(db);
  let writes = 0;

  snap.docs.forEach((d) => {
    const data = d.data();
    const memberIds = Array.isArray(data.memberIds) ? (data.memberIds as string[]) : [];
    if (!memberIds.includes(friendId)) return;
    batch.update(d.ref, {
      memberIds: memberIds.filter((id) => id !== friendId),
      updatedAt: serverTimestamp(),
    });
    writes += 1;
  });

  if (writes > 0) {
    await batch.commit();
  }
}

export function groupsContainingMember(groups: FriendGroup[], memberId: string): FriendGroup[] {
  return groups.filter((g) => g.memberIds.includes(memberId));
}
