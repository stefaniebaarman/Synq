import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";

import {
  communityGroupRef,
  joinCommunityGroup,
  type CommunityGroup,
} from "./communityGroups";
import { db } from "./firebase";

export type CommunityGroupInvite = {
  id: string;
  groupId: string;
  groupName: string;
  fromUserId: string;
  fromUserName: string;
  fromUserImageUrl?: string;
  createdAt?: unknown;
};

export function communityGroupInviteRef(targetUserId: string, groupId: string) {
  return doc(db, "users", targetUserId, "communityGroupInvites", groupId);
}

export function communityGroupPendingInviteRef(groupId: string, targetUserId: string) {
  return doc(db, "communityGroups", groupId, "invites", targetUserId);
}

export function subscribeReceivedCommunityGroupInvites(
  uid: string,
  onData: (invites: CommunityGroupInvite[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const q = query(collection(db, "users", uid, "communityGroupInvites"));
  return onSnapshot(
    q,
    (snap) => {
      const invites = snap.docs
        .map((d) => mapInviteDoc(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => timestampMillis(b.createdAt) - timestampMillis(a.createdAt));
      onData(invites);
    },
    (err) => onError?.(err)
  );
}

export function subscribePendingCommunityGroupInvites(
  groupId: string,
  onData: (targetUserIds: string[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const q = query(collection(db, "communityGroups", groupId, "invites"));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => d.id));
    },
    (err) => onError?.(err)
  );
}

function mapInviteDoc(id: string, data: Record<string, unknown>): CommunityGroupInvite {
  return {
    id,
    groupId: String(data.groupId || id).trim(),
    groupName: String(data.groupName || "").trim() || "Group",
    fromUserId: String(data.fromUserId || "").trim(),
    fromUserName: String(data.fromUserName || "").trim() || "Friend",
    fromUserImageUrl: data.fromUserImageUrl ? String(data.fromUserImageUrl) : undefined,
    createdAt: data.createdAt,
  };
}

function timestampMillis(v: unknown): number {
  if (!v) return 0;
  const t = v as { toMillis?: () => number; seconds?: number };
  if (typeof t.toMillis === "function") return t.toMillis();
  if (typeof t.seconds === "number") return t.seconds * 1000;
  return 0;
}

export async function sendCommunityGroupInvites(
  inviterId: string,
  inviterName: string,
  inviterImageUrl: string | null | undefined,
  group: CommunityGroup,
  friendIds: string[]
): Promise<string[]> {
  if (!inviterId || !group.id) {
    throw new Error("Missing group.");
  }
  if (!group.memberIds.includes(inviterId)) {
    throw new Error("Only members can invite friends.");
  }

  const uniqueIds = [
    ...new Set(friendIds.map((id) => String(id || "").trim()).filter(Boolean)),
  ].filter((id) => id !== inviterId && !group.memberIds.includes(id));

  if (uniqueIds.length === 0) {
    return [];
  }

  const batch = writeBatch(db);
  const sent: string[] = [];

  for (const targetUserId of uniqueIds) {
    const userInviteRef = communityGroupInviteRef(targetUserId, group.id);
    const groupInviteRef = communityGroupPendingInviteRef(group.id, targetUserId);

    const existingUserInvite = await getDoc(userInviteRef);
    const existingGroupInvite = await getDoc(groupInviteRef);
    if (existingUserInvite.exists() || existingGroupInvite.exists()) {
      continue;
    }

    const payload = {
      groupId: group.id,
      groupName: group.name,
      fromUserId: inviterId,
      fromUserName: inviterName.trim() || "Friend",
      fromUserImageUrl: inviterImageUrl || null,
      createdAt: serverTimestamp(),
    };

    batch.set(userInviteRef, payload);
    batch.set(groupInviteRef, {
      targetUserId,
      fromUserId: inviterId,
      createdAt: serverTimestamp(),
    });
    sent.push(targetUserId);
  }

  if (sent.length === 0) {
    return [];
  }

  await batch.commit();
  return sent;
}

export async function acceptCommunityGroupInvite(
  uid: string,
  invite: CommunityGroupInvite
): Promise<void> {
  const groupSnap = await getDoc(communityGroupRef(invite.groupId));
  if (!groupSnap.exists()) {
    await deleteCommunityGroupInvite(uid, invite.groupId);
    throw new Error("This group no longer exists.");
  }

  const data = groupSnap.data() as Record<string, unknown>;
  const memberIds = Array.isArray(data.memberIds) ? (data.memberIds as string[]) : [];

  if (memberIds.includes(uid)) {
    await deleteCommunityGroupInvite(uid, invite.groupId);
    return;
  }

  await joinCommunityGroup(uid, invite.groupId, memberIds);
  await deleteCommunityGroupInvite(uid, invite.groupId);
}

export async function declineCommunityGroupInvite(uid: string, groupId: string): Promise<void> {
  await deleteCommunityGroupInvite(uid, groupId);
}

async function deleteCommunityGroupInvite(uid: string, groupId: string): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(communityGroupInviteRef(uid, groupId));
  batch.delete(communityGroupPendingInviteRef(groupId, uid));
  await batch.commit();
}
