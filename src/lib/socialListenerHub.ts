/**
 * Multiplexes Firestore listeners so tab screens share one subscription per collection/doc.
 */
import { Friend } from "@/constants/Variables";
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import type { FriendGroup } from "./friendGroups";
import { ignoreSnapshotPermissionDenied } from "./firestoreListeners";

type UserDocListener = (data: DocumentData | null) => void;
type FriendsListener = (friendIds: string[]) => void;
type FriendGroupsListener = (groups: FriendGroup[]) => void;
type CommunityGroupLike = {
  id: string;
  name: string;
  nameLower: string;
  creatorId: string;
  memberIds: string[];
  memberPreviews?: Record<string, { displayName?: string; imageurl?: string }>;
  category?: string;
  location?: string;
  about?: string;
  coverPhotoUrl?: string;
  coverPhotoThumbUrl?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};
type JoinedCommunityGroupsListener = (groups: CommunityGroupLike[]) => void;

const userDocHub = new Map<string, { unsub: Unsubscribe; listeners: Set<UserDocListener> }>();
const friendsHub = new Map<string, { unsub: Unsubscribe; listeners: Set<FriendsListener> }>();
const friendGroupsHub = new Map<
  string,
  { unsub: Unsubscribe; listeners: Set<FriendGroupsListener> }
>();
const joinedCommunityGroupsHub = new Map<
  string,
  { unsub: Unsubscribe; listeners: Set<JoinedCommunityGroupsListener> }
>();

function optionalTrimmed(value: unknown, maxLen: number): string | undefined {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLen);
}

function mapCommunityGroupLite(id: string, data: Record<string, unknown>): CommunityGroupLike {
  const category = optionalTrimmed(data.category, 40);
  const location = optionalTrimmed(data.location, 80);
  const about = optionalTrimmed(data.about, 500);
  const coverPhotoUrl = optionalTrimmed(data.coverPhotoUrl, 2048);
  const coverPhotoThumbUrl = optionalTrimmed(data.coverPhotoThumbUrl, 2048);
  const rawPreviews =
    data.memberPreviews && typeof data.memberPreviews === "object"
      ? (data.memberPreviews as Record<string, { displayName?: string; imageurl?: string }>)
      : undefined;
  const memberIds = [
    ...new Set(
      (Array.isArray(data.memberIds) ? data.memberIds : [])
        .map((x) => String(x || "").trim())
        .filter(Boolean)
    ),
  ].slice(0, 500);

  return {
    id,
    name: String(data.name || "").trim() || "Group",
    nameLower: String(data.nameLower || "").trim(),
    creatorId: String(data.creatorId || "").trim(),
    memberIds,
    ...(rawPreviews ? { memberPreviews: rawPreviews } : {}),
    ...(category ? { category } : {}),
    ...(location ? { location } : {}),
    ...(about ? { about } : {}),
    ...(coverPhotoUrl ? { coverPhotoUrl } : {}),
    ...(coverPhotoThumbUrl ? { coverPhotoThumbUrl } : {}),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export function subscribeUserDocMultiplexed(
  uid: string,
  listener: UserDocListener
): Unsubscribe {
  if (!uid) return () => {};

  let hub = userDocHub.get(uid);
  if (!hub) {
    const listeners = new Set<UserDocListener>();
    const unsub = onSnapshot(
      doc(db, "users", uid),
      (snap) => {
        const data = snap.exists() ? snap.data() : null;
        for (const fn of listeners) {
          try {
            fn(data);
          } catch {}
        }
      },
      (err) => {
        ignoreSnapshotPermissionDenied(err);
      }
    );
    hub = { unsub, listeners };
    userDocHub.set(uid, hub);
  }

  hub.listeners.add(listener);
  return () => {
    const current = userDocHub.get(uid);
    if (!current) return;
    current.listeners.delete(listener);
    if (current.listeners.size === 0) {
      current.unsub();
      userDocHub.delete(uid);
    }
  };
}

export function subscribeFriendsIdsMultiplexed(
  uid: string,
  listener: FriendsListener
): Unsubscribe {
  if (!uid) return () => {};

  let hub = friendsHub.get(uid);
  if (!hub) {
    const listeners = new Set<FriendsListener>();
    const unsub = onSnapshot(
      collection(db, "users", uid, "friends"),
      (snap) => {
        const ids = snap.docs.map((d) => d.id);
        for (const fn of listeners) {
          try {
            fn(ids);
          } catch {}
        }
      },
      (err) => {
        ignoreSnapshotPermissionDenied(err);
      }
    );
    hub = { unsub, listeners };
    friendsHub.set(uid, hub);
  }

  hub.listeners.add(listener);
  return () => {
    const current = friendsHub.get(uid);
    if (!current) return;
    current.listeners.delete(listener);
    if (current.listeners.size === 0) {
      current.unsub();
      friendsHub.delete(uid);
    }
  };
}

function normalizeFriendGroupMemberIds(memberIds: string[]): string[] {
  return [...new Set(memberIds.map((id) => String(id || "").trim()).filter(Boolean))].slice(
    0,
    50
  );
}

export function subscribeFriendGroupsMultiplexed(
  uid: string,
  listener: FriendGroupsListener
): Unsubscribe {
  if (!uid) return () => {};

  let hub = friendGroupsHub.get(uid);
  if (!hub) {
    const listeners = new Set<FriendGroupsListener>();
    const unsub = onSnapshot(
      collection(db, "users", uid, "friendGroups"),
      (snap) => {
        const groups = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              name: String(data.name || "").trim() || "Group",
              memberIds: normalizeFriendGroupMemberIds(
                Array.isArray(data.memberIds) ? (data.memberIds as string[]) : []
              ),
              sortOrder: typeof data.sortOrder === "number" ? data.sortOrder : 0,
              createdAt: data.createdAt,
              updatedAt: data.updatedAt,
            } satisfies FriendGroup;
          })
          .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
        for (const fn of listeners) {
          try {
            fn(groups);
          } catch {}
        }
      },
      (err) => {
        ignoreSnapshotPermissionDenied(err);
      }
    );
    hub = { unsub, listeners };
    friendGroupsHub.set(uid, hub);
  }

  hub.listeners.add(listener);
  return () => {
    const current = friendGroupsHub.get(uid);
    if (!current) return;
    current.listeners.delete(listener);
    if (current.listeners.size === 0) {
      current.unsub();
      friendGroupsHub.delete(uid);
    }
  };
}

export function subscribeJoinedCommunityGroupsMultiplexed(
  uid: string,
  listener: JoinedCommunityGroupsListener
): Unsubscribe {
  if (!uid) return () => {};

  let hub = joinedCommunityGroupsHub.get(uid);
  if (!hub) {
    const listeners = new Set<JoinedCommunityGroupsListener>();
    const unsub = onSnapshot(
      query(collection(db, "communityGroups"), where("memberIds", "array-contains", uid)),
      (snap) => {
        const groups = snap.docs
          .map((d) => mapCommunityGroupLite(d.id, d.data() as Record<string, unknown>))
          .sort((a, b) => a.name.localeCompare(b.name));
        for (const fn of listeners) {
          try {
            fn(groups);
          } catch {}
        }
      },
      (err) => {
        ignoreSnapshotPermissionDenied(err);
      }
    );
    hub = { unsub, listeners };
    joinedCommunityGroupsHub.set(uid, hub);
  }

  hub.listeners.add(listener);
  return () => {
    const current = joinedCommunityGroupsHub.get(uid);
    if (!current) return;
    current.listeners.delete(listener);
    if (current.listeners.size === 0) {
      current.unsub();
      joinedCommunityGroupsHub.delete(uid);
    }
  };
}

/** @deprecated type hint for consumers */
export type { Friend };
