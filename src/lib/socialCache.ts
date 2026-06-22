import { Friend } from "@/constants/Variables";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";

import { db } from "./firebase";
import type { FriendGroup } from "./friendGroups";
import type { CommunityGroup } from "./communityGroups";
import { computeSynqActiveFromUserData } from "./synqSession";

export type Connection = {
  id: string;
  name: string;
  imageUrl: string | null;
  synqCount: number;
};

export const friendsListCacheByUser: Record<string, Friend[]> = {};
export const friendProfileCacheByUser: Record<string, Record<string, Friend>> = {};
export const friendRelationCacheByUser: Record<string, Record<string, { synqCount: number; lastSynqAt?: any }>> = {};
export const connectionsCacheByUser: Record<string, Connection[]> = {};
export const connectionProfileCacheByUser: Record<string, Record<string, Omit<Connection, "synqCount">>> = {};
export const suggestedCacheByUser: Record<string, any[]> = {};
/** viewerId -> profileId -> mutual friend profiles (for instant Mutual Friends UI). */
export const mutualFriendsCacheByUser: Record<string, Record<string, Friend[]>> = {};
/** viewerId -> target user ids with an outgoing friend request. */
export const outgoingFriendRequestIdsCacheByUser: Record<string, Set<string>> = {};
export const friendGroupsCacheByUser: Record<string, FriendGroup[]> = {};
export const communityGroupsCacheByUser: Record<string, CommunityGroup[]> = {};

const warmFriendsInFlight: Record<string, Promise<void> | undefined> = {};
const warmOutgoingInFlight: Record<string, Promise<void> | undefined> = {};
const warmSuggestedInFlight: Record<string, Promise<void> | undefined> = {};
const hydrateInFlight: Record<string, Promise<void> | undefined> = {};
const CACHE_VERSION = 2;
const socialCacheKey = (userId: string) => `social-cache:${CACHE_VERSION}:${userId}`;

/** How long before re-fetching a friend's full profile during warm. */
export const FRIEND_PROFILE_TTL_MS = 30 * 60 * 1000;
/** How long before rebuilding the mutual-friends index. */
export const MUTUAL_INDEX_TTL_MS = 60 * 60 * 1000;
/** How long before repeating a full friends warm when friend ids are unchanged. */
export const FRIENDS_WARM_TTL_MS = 20 * 60 * 1000;
/** How long before refreshing suggested friends. */
export const SUGGESTED_CACHE_TTL_MS = 30 * 60 * 1000;
/** How long before re-reading a friend's friends subcollection. */
export const FRIENDS_OF_FRIEND_TTL_MS = 60 * 60 * 1000;
/** Poll interval for Synq-active friend availability (replaces per-friend listeners). */
export const SYNQ_FRIEND_POLL_TTL_MS = 90 * 1000;

type SocialWarmMeta = {
  friendIdsKey: string;
  warmedAt: number;
  mutualIndexKey: string;
  mutualIndexAt: number;
  suggestedAt: number;
};

const socialWarmMetaByUser: Record<string, SocialWarmMeta> = {};
const friendProfileFetchedAtByUser: Record<string, Record<string, number>> = {};
const friendsOfFriendIdsByUser: Record<
  string,
  Record<string, { ids: string[]; fetchedAt: number }>
> = {};
const synqActiveFriendsPollCache: Record<
  string,
  { fetchedAt: number; friendIdsKey: string; friends: Friend[] }
> = {};

export type WarmFriendsOptions = {
  /** Bypass TTL and refresh profiles / mutual index. */
  force?: boolean;
  /** Friend ids already known (skips reading the friends subcollection). */
  friendIds?: string[];
};

export function friendIdsKey(ids: string[]): string {
  return [...new Set(ids.map((id) => String(id || "").trim()).filter(Boolean))].sort().join("|");
}

export function invalidateSocialWarmCache(userId: string) {
  if (!userId) return;
  delete socialWarmMetaByUser[userId];
  delete synqActiveFriendsPollCache[userId];
}

const sortFriendsByName = (list: Friend[]) =>
  [...list].sort((a, b) => (a.displayName || "").localeCompare(b.displayName || ""));

type PersistedSocialCache = {
  friendsList: Friend[];
  friendProfiles: Record<string, Friend>;
  friendRelations: Record<string, { synqCount: number; lastSynqAt?: any }>;
  connections: Connection[];
  connectionProfiles: Record<string, Omit<Connection, "synqCount">>;
  suggested: any[];
  mutualFriends: Record<string, Friend[]>;
  outgoingFriendRequestIds: string[];
  cacheMeta?: Partial<SocialWarmMeta>;
};

export function getCachedFriendRelationship(
  viewerId: string,
  friendKey: string
): { isFriend: boolean; requestSent: boolean } {
  if (!viewerId || !friendKey) {
    return { isFriend: false, requestSent: false };
  }
  const isFriend =
    (friendsListCacheByUser[viewerId]?.some((f) => f.id === friendKey) ?? false) ||
    friendRelationCacheByUser[viewerId]?.[friendKey] != null;
  const requestSent =
    outgoingFriendRequestIdsCacheByUser[viewerId]?.has(friendKey) ?? false;
  return { isFriend, requestSent };
}

export function setCachedOutgoingFriendRequest(
  viewerId: string,
  friendKey: string,
  pending: boolean
) {
  if (!viewerId || !friendKey) return;
  if (!outgoingFriendRequestIdsCacheByUser[viewerId]) {
    outgoingFriendRequestIdsCacheByUser[viewerId] = new Set();
  }
  const set = outgoingFriendRequestIdsCacheByUser[viewerId];
  if (pending) {
    set.add(friendKey);
  } else {
    set.delete(friendKey);
  }
  void persistSocialCache(viewerId);
}

export function syncOutgoingFriendRequestsCache(viewerId: string, targetIds: string[]) {
  if (!viewerId) return;
  outgoingFriendRequestIdsCacheByUser[viewerId] = new Set(targetIds.filter(Boolean));
  void persistSocialCache(viewerId);
}

export function pruneSocialCachesToFriendIds(userId: string, friendIds: Set<string>) {
  if (!userId) return;

  const pruneRecord = (obj: Record<string, unknown> | undefined) => {
    if (!obj) return;
    Object.keys(obj).forEach((id) => {
      if (!friendIds.has(id)) delete obj[id];
    });
  };

  pruneRecord(friendProfileCacheByUser[userId] as Record<string, unknown>);
  pruneRecord(connectionProfileCacheByUser[userId] as Record<string, unknown>);
  pruneRecord(friendRelationCacheByUser[userId] as Record<string, unknown>);

  const list = friendsListCacheByUser[userId];
  if (list?.length) {
    friendsListCacheByUser[userId] = list.filter((f) => friendIds.has(f.id));
  }

  const conns = connectionsCacheByUser[userId];
  if (conns?.length) {
    connectionsCacheByUser[userId] = conns.filter((c) => friendIds.has(c.id));
  }

  const mutuals = mutualFriendsCacheByUser[userId];
  if (mutuals) {
    Object.keys(mutuals).forEach((targetId) => {
      if (!friendIds.has(targetId)) delete mutuals[targetId];
    });
  }

  void persistSocialCache(userId);
}

function getWarmMeta(userId: string): SocialWarmMeta {
  return (
    socialWarmMetaByUser[userId] ?? {
      friendIdsKey: "",
      warmedAt: 0,
      mutualIndexKey: "",
      mutualIndexAt: 0,
      suggestedAt: 0,
    }
  );
}

function setWarmMeta(userId: string, patch: Partial<SocialWarmMeta>) {
  socialWarmMetaByUser[userId] = { ...getWarmMeta(userId), ...patch };
}

async function loadFriendsOfFriendSet(
  viewerId: string,
  fid: string,
  force = false
): Promise<Set<string>> {
  if (!friendsOfFriendIdsByUser[viewerId]) {
    friendsOfFriendIdsByUser[viewerId] = {};
  }
  const bucket = friendsOfFriendIdsByUser[viewerId];
  const cached = bucket[fid];
  const now = Date.now();
  if (!force && cached && now - cached.fetchedAt < FRIENDS_OF_FRIEND_TTL_MS) {
    return new Set(cached.ids);
  }

  try {
    const theirFriendsSnap = await getDocs(collection(db, "users", fid, "friends"));
    const ids = theirFriendsSnap.docs.map((d) => d.id);
    bucket[fid] = { ids, fetchedAt: now };
    return new Set(ids);
  } catch {
    bucket[fid] = { ids: [], fetchedAt: now };
    return new Set();
  }
}

async function buildMutualFriendsIndex(
  viewerId: string,
  myFriendIds: string[],
  profileCache: Record<string, Friend>,
  force = false
): Promise<Record<string, Friend[]>> {
  const myFriendSet = new Set(myFriendIds);
  const friendsOfFriend = new Map<string, Set<string>>();

  await Promise.all(
    myFriendIds.map(async (fid) => {
      friendsOfFriend.set(fid, await loadFriendsOfFriendSet(viewerId, fid, force));
    })
  );

  const index: Record<string, Friend[]> = {};
  const byTarget = new Map<string, Map<string, Friend>>();

  for (const fid of myFriendIds) {
    const mutualProfile = profileCache[fid];
    if (!mutualProfile) continue;
    const theirFriends = friendsOfFriend.get(fid);
    if (!theirFriends) continue;

    theirFriends.forEach((targetId) => {
      if (targetId === fid || targetId === viewerId) return;

      if (myFriendSet.has(targetId)) {
        return;
      }

      let bucket = byTarget.get(targetId);
      if (!bucket) {
        bucket = new Map();
        byTarget.set(targetId, bucket);
      }
      bucket.set(fid, mutualProfile);
    });
  }

  byTarget.forEach((bucket, targetId) => {
    index[targetId] = sortFriendsByName([...bucket.values()]);
  });

  for (const targetId of myFriendIds) {
    const bucket = new Map<string, Friend>();
    for (const fid of myFriendIds) {
      if (fid === targetId) continue;
      const mutualProfile = profileCache[fid];
      if (!mutualProfile) continue;
      if (friendsOfFriend.get(fid)?.has(targetId)) {
        bucket.set(fid, mutualProfile);
      }
    }
    index[targetId] = sortFriendsByName([...bucket.values()]);
  }

  return index;
}

export function getCachedMutualFriends(
  viewerId: string,
  targetId: string
): Friend[] | undefined {
  if (!viewerId || !targetId) return undefined;
  const cache = mutualFriendsCacheByUser[viewerId];
  if (!cache || !Object.prototype.hasOwnProperty.call(cache, targetId)) {
    return undefined;
  }
  return cache[targetId];
}

export function setCachedMutualFriends(
  viewerId: string,
  targetId: string,
  list: Friend[]
) {
  if (!viewerId || !targetId) return;
  if (!mutualFriendsCacheByUser[viewerId]) {
    mutualFriendsCacheByUser[viewerId] = {};
  }
  mutualFriendsCacheByUser[viewerId][targetId] = list;
  void persistSocialCache(viewerId);
}

/** Loads mutual friends for a profile; uses memory/disk cache when available. */
export async function resolveMutualFriendsForTarget(
  viewerId: string,
  targetId: string
): Promise<Friend[]> {
  if (!viewerId || !targetId || viewerId === targetId) return [];

  const cached = getCachedMutualFriends(viewerId, targetId);
  if (cached !== undefined) return cached;

  const myFriendIds = (
    friendsListCacheByUser[viewerId]?.map((f) => f.id) ??
    (
      await getDocs(collection(db, "users", viewerId, "friends"))
    ).docs.map((d) => d.id)
  ).filter((id) => id !== targetId);

  const profileCache = friendProfileCacheByUser[viewerId] ?? {};
  const mutualProfiles: Friend[] = [];

  await Promise.all(
    myFriendIds.map(async (fid) => {
      try {
        const snap = await getDoc(doc(db, "users", fid, "friends", targetId));
        if (!snap.exists()) return;
        const cachedProfile = profileCache[fid];
        if (cachedProfile) {
          mutualProfiles.push(cachedProfile);
          return;
        }
        const userSnap = await getDoc(doc(db, "users", fid));
        if (userSnap.exists()) {
          const row = { id: fid, ...(userSnap.data() as object) } as Friend;
          profileCache[fid] = row;
          mutualProfiles.push(row);
        }
      } catch {
        /* skip unreadable edge */
      }
    })
  );

  const sorted = sortFriendsByName(mutualProfiles);
  setCachedMutualFriends(viewerId, targetId, sorted);
  return sorted;
}

async function persistSocialCache(userId: string) {
  const payload: PersistedSocialCache = {
    friendsList: friendsListCacheByUser[userId] ?? [],
    friendProfiles: friendProfileCacheByUser[userId] ?? {},
    friendRelations: friendRelationCacheByUser[userId] ?? {},
    connections: connectionsCacheByUser[userId] ?? [],
    connectionProfiles: connectionProfileCacheByUser[userId] ?? {},
    suggested: suggestedCacheByUser[userId] ?? [],
    mutualFriends: mutualFriendsCacheByUser[userId] ?? {},
    outgoingFriendRequestIds: [
      ...Array.from(outgoingFriendRequestIdsCacheByUser[userId] ?? []),
    ],
    cacheMeta: getWarmMeta(userId),
  };
  try {
    await AsyncStorage.setItem(socialCacheKey(userId), JSON.stringify(payload));
  } catch {}
}

export async function hydrateSocialCachesFromDisk(userId: string): Promise<void> {
  if (!userId) return;
  if (hydrateInFlight[userId]) {
    await hydrateInFlight[userId];
    return;
  }

  hydrateInFlight[userId] = (async () => {
    try {
      const raw = await AsyncStorage.getItem(socialCacheKey(userId));
      if (!raw) return;
      const parsed = JSON.parse(raw) as PersistedSocialCache;
      friendsListCacheByUser[userId] = parsed.friendsList ?? [];
      friendProfileCacheByUser[userId] = parsed.friendProfiles ?? {};
      friendRelationCacheByUser[userId] = parsed.friendRelations ?? {};
      connectionsCacheByUser[userId] = parsed.connections ?? [];
      connectionProfileCacheByUser[userId] = parsed.connectionProfiles ?? {};
      suggestedCacheByUser[userId] = parsed.suggested ?? [];
      mutualFriendsCacheByUser[userId] = parsed.mutualFriends ?? {};
      outgoingFriendRequestIdsCacheByUser[userId] = new Set(
        parsed.outgoingFriendRequestIds ?? []
      );
      if (parsed.cacheMeta) {
        socialWarmMetaByUser[userId] = {
          ...getWarmMeta(userId),
          ...parsed.cacheMeta,
        };
      }

    } catch {}
  })();

  try {
    await hydrateInFlight[userId];
  } finally {
    hydrateInFlight[userId] = undefined;
  }
}

export async function warmFriendsAndConnectionsCache(
  userId: string,
  options: WarmFriendsOptions = {}
): Promise<void> {
  if (!userId) return;
  if (warmFriendsInFlight[userId]) {
    await warmFriendsInFlight[userId];
    return;
  }

  warmFriendsInFlight[userId] = (async () => {
    const force = !!options.force;
    const now = Date.now();
    const meta = getWarmMeta(userId);

    let friendDocs: { id: string; synqCount: number }[];
    let friendsSnapDocs: { id: string; data: () => Record<string, unknown> }[] = [];

    if (options.friendIds?.length) {
      friendDocs = options.friendIds.map((id) => ({
        id,
        synqCount: friendRelationCacheByUser[userId]?.[id]?.synqCount ?? 0,
      }));
    } else {
      const friendsSnap = await getDocs(collection(db, "users", userId, "friends"));
      friendsSnapDocs = friendsSnap.docs;
      friendDocs = friendsSnap.docs.map((d) => ({
        id: d.id,
        synqCount: (d.data().synqCount as number) || 0,
      }));
    }

    const idsKey = friendIdsKey(friendDocs.map((d) => d.id));
    const cachedList = friendsListCacheByUser[userId] ?? [];
    const profilesComplete =
      friendDocs.length > 0 &&
      friendDocs.every((d) => !!friendProfileCacheByUser[userId]?.[d.id]);

    if (
      !force &&
      meta.friendIdsKey === idsKey &&
      now - meta.warmedAt < FRIENDS_WARM_TTL_MS &&
      cachedList.length === friendDocs.length &&
      profilesComplete
    ) {
      return;
    }

    if (meta.friendIdsKey !== idsKey) {
      delete friendsOfFriendIdsByUser[userId];
      delete synqActiveFriendsPollCache[userId];
      setWarmMeta(userId, { mutualIndexKey: "", mutualIndexAt: 0 });
    }

    pruneSocialCachesToFriendIds(userId, new Set(friendDocs.map((d) => d.id)));

    if (!friendProfileCacheByUser[userId]) {
      friendProfileCacheByUser[userId] = {};
    }
    if (!connectionProfileCacheByUser[userId]) {
      connectionProfileCacheByUser[userId] = {};
    }
    if (!friendRelationCacheByUser[userId]) {
      friendRelationCacheByUser[userId] = {};
    }
    if (!friendProfileFetchedAtByUser[userId]) {
      friendProfileFetchedAtByUser[userId] = {};
    }

    const profileCache = friendProfileCacheByUser[userId];
    const connectionCache = connectionProfileCacheByUser[userId];
    const relationCache = friendRelationCacheByUser[userId];
    const fetchedAtMap = friendProfileFetchedAtByUser[userId];

    const fetchedFriends: Friend[] = await Promise.all(
      friendDocs.map(async ({ id }) => {
        const cachedProfile = profileCache[id];
        const fetchedAt = fetchedAtMap[id] ?? 0;
        if (!force && cachedProfile && now - fetchedAt < FRIEND_PROFILE_TTL_MS) {
          return cachedProfile;
        }

        const uSnap = await getDoc(doc(db, "users", id));
        if (!uSnap.exists()) {
          return (
            cachedProfile ??
            ({
              id,
              displayName: "Unknown",
              mutualCount: 0,
            } as Friend)
          );
        }

        const data = uSnap.data() as Record<string, unknown>;
        const friendObj = {
          id,
          ...(data as object),
          location:
            data.city && data.state ? `${String(data.city)}, ${String(data.state)}` : "",
        } as Friend;
        fetchedAtMap[id] = now;
        return friendObj;
      })
    );

    const sortedFriends = sortFriendsByName(fetchedFriends);
    sortedFriends.forEach((friend) => {
      profileCache[friend.id] = friend;
      const imageUrl = (friend as { imageurl?: string }).imageurl || null;
      connectionCache[friend.id] = {
        id: friend.id,
        name: friend.displayName || "User",
        imageUrl,
      };
      const relationDoc = friendDocs.find((d) => d.id === friend.id);
      if (relationDoc) {
        relationCache[friend.id] = {
          synqCount: relationDoc.synqCount || 0,
          lastSynqAt: friendsSnapDocs.length
            ? (friendsSnapDocs.find((d) => d.id === friend.id)?.data() as { lastSynqAt?: unknown })
                ?.lastSynqAt
            : relationCache[friend.id]?.lastSynqAt,
        };
      }
    });

    const connections = friendDocs
      .map(({ id, synqCount }) => ({
        id,
        name: connectionCache[id]?.name || "User",
        imageUrl: connectionCache[id]?.imageUrl || null,
        synqCount,
      }))
      .sort((a, b) => b.synqCount - a.synqCount);

    friendsListCacheByUser[userId] = sortedFriends;
    connectionsCacheByUser[userId] = connections;

    const mutualKey = idsKey;
    const hasMutualIndex =
      !!mutualFriendsCacheByUser[userId] &&
      Object.keys(mutualFriendsCacheByUser[userId]).length > 0;
    const mutualFresh =
      !force &&
      meta.mutualIndexKey === mutualKey &&
      now - meta.mutualIndexAt < MUTUAL_INDEX_TTL_MS &&
      hasMutualIndex;

    if (!mutualFresh) {
      const mutualIndex = await buildMutualFriendsIndex(
        userId,
        sortedFriends.map((f) => f.id),
        profileCache,
        force
      );
      if (!mutualFriendsCacheByUser[userId]) {
        mutualFriendsCacheByUser[userId] = {};
      }
      Object.assign(mutualFriendsCacheByUser[userId], mutualIndex);
      setWarmMeta(userId, { mutualIndexKey: mutualKey, mutualIndexAt: now });
    }

    setWarmMeta(userId, { friendIdsKey: idsKey, warmedAt: now });
    delete synqActiveFriendsPollCache[userId];
    await persistSocialCache(userId);
  })();

  try {
    await warmFriendsInFlight[userId];
  } finally {
    warmFriendsInFlight[userId] = undefined;
  }
}

export async function warmOutgoingFriendRequestsCache(userId: string): Promise<void> {
  if (!userId) return;
  if (warmOutgoingInFlight[userId]) {
    await warmOutgoingInFlight[userId];
    return;
  }

  warmOutgoingInFlight[userId] = (async () => {
    try {
      const snap = await getDocs(
        collection(db, "users", userId, "outgoingFriendRequests")
      );
      syncOutgoingFriendRequestsCache(
        userId,
        snap.docs.map((d) => d.id)
      );
    } catch {
      /* non-fatal */
    }
  })();

  try {
    await warmOutgoingInFlight[userId];
  } finally {
    warmOutgoingInFlight[userId] = undefined;
  }
}

export async function warmSuggestedCache(
  userId: string,
  options: { force?: boolean } = {}
): Promise<void> {
  if (!userId) return;
  if (warmSuggestedInFlight[userId]) {
    await warmSuggestedInFlight[userId];
    return;
  }

  warmSuggestedInFlight[userId] = (async () => {
    try {
      const force = !!options.force;
      const now = Date.now();
      const meta = getWarmMeta(userId);
      if (
        !force &&
        (suggestedCacheByUser[userId]?.length ?? 0) > 0 &&
        now - meta.suggestedAt < SUGGESTED_CACHE_TTL_MS
      ) {
        return;
      }

      const myFriendIds =
        friendsListCacheByUser[userId]?.map((f) => f.id) ??
        (await getDocs(collection(db, "users", userId, "friends"))).docs.map((d) => d.id);
      const exclude = new Set([userId, ...myFriendIds]);
      const mutualCounts = new Map<string, number>();

      await Promise.all(
        myFriendIds.map(async (friendId) => {
          const theirFriends = await loadFriendsOfFriendSet(userId, friendId, force);
          theirFriends.forEach((candidateId) => {
            if (exclude.has(candidateId)) return;
            mutualCounts.set(candidateId, (mutualCounts.get(candidateId) || 0) + 1);
          });
        })
      );

      const ranked = [...mutualCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);

      const nextSuggested: Record<string, unknown>[] = [];
      for (const [candidateId, mutualCount] of ranked) {
        try {
          const profileSnap = await getDoc(doc(db, "users", candidateId));
          if (!profileSnap.exists()) continue;
          nextSuggested.push({
            id: candidateId,
            ...(profileSnap.data() as object),
            mutualCount,
          });
        } catch {
          // Profile not readable — skip.
        }
      }

      suggestedCacheByUser[userId] = nextSuggested;
      setWarmMeta(userId, { suggestedAt: now });
      await persistSocialCache(userId);
    } catch (err) {
      console.error("[warmSuggestedCache] failed:", err);
    }
  })();

  try {
    await warmSuggestedInFlight[userId];
  } finally {
    warmSuggestedInFlight[userId] = undefined;
  }
}

export function resolveMutualFriendCount(
  viewerId: string,
  targetId: string,
  fallback?: unknown
): number {
  const cached = getCachedMutualFriends(viewerId, targetId);
  if (cached !== undefined) return cached.length;
  if (typeof fallback === "number" && Number.isFinite(fallback)) return fallback;
  return 0;
}

export async function countMutualFriendsForTarget(
  viewerId: string,
  targetId: string
): Promise<number> {
  const list = await resolveMutualFriendsForTarget(viewerId, targetId);
  return list.length;
}

export async function hydrateMutualCountsForUsers(
  viewerId: string,
  targetIds: string[]
): Promise<Record<string, number>> {
  const uniqueIds = [...new Set(targetIds.filter(Boolean))];
  const counts: Record<string, number> = {};
  const missing: string[] = [];

  for (const targetId of uniqueIds) {
    const cached = getCachedMutualFriends(viewerId, targetId);
    if (cached !== undefined) {
      counts[targetId] = cached.length;
    } else {
      missing.push(targetId);
    }
  }

  if (missing.length === 0) return counts;

  await Promise.all(
    missing.map(async (targetId) => {
      counts[targetId] = (await resolveMutualFriendsForTarget(viewerId, targetId)).length;
    })
  );
  return counts;
}

/** Poll Synq-active friends without per-friend realtime listeners. */
export async function pollSynqActiveFriends(
  viewerId: string,
  friendIds: string[],
  options: { force?: boolean } = {}
): Promise<Friend[]> {
  if (!viewerId || friendIds.length === 0) return [];

  const force = !!options.force;
  const now = Date.now();
  const pollKey = friendIdsKey(friendIds);
  const cached = synqActiveFriendsPollCache[viewerId];
  if (
    !force &&
    cached &&
    now - cached.fetchedAt < SYNQ_FRIEND_POLL_TTL_MS &&
    cached.friendIdsKey === pollKey
  ) {
    return cached.friends;
  }

  const profileCache = friendProfileCacheByUser[viewerId] ?? {};
  const fetchedAtMap = friendProfileFetchedAtByUser[viewerId] ?? {};
  const active: Friend[] = [];

  await Promise.all(
    friendIds.map(async (fid) => {
      const cachedProfile = profileCache[fid];
      const profileAge = fetchedAtMap[fid] ?? 0;
      const profileFresh = cachedProfile && now - profileAge < SYNQ_FRIEND_POLL_TTL_MS;

      let data: Record<string, unknown> | undefined;
      if (profileFresh) {
        data = cachedProfile as unknown as Record<string, unknown>;
      } else {
        try {
          const snap = await getDoc(doc(db, "users", fid));
          if (!snap.exists()) return;
          data = snap.data() as Record<string, unknown>;
          profileCache[fid] = { id: fid, ...(data as object) } as Friend;
          if (!friendProfileFetchedAtByUser[viewerId]) {
            friendProfileFetchedAtByUser[viewerId] = {};
          }
          friendProfileFetchedAtByUser[viewerId][fid] = now;
        } catch {
          return;
        }
      }

      if (!computeSynqActiveFromUserData(data)) return;
      active.push({ id: fid, ...(data as object) } as Friend);
    })
  );

  const sorted = sortFriendsByName(active);
  synqActiveFriendsPollCache[viewerId] = {
    fetchedAt: now,
    friendIdsKey: pollKey,
    friends: sorted,
  };
  return sorted;
}

export function warmSocialCachesInBackground(userId: string) {
  if (!userId) return;
  warmFriendsAndConnectionsCache(userId).catch(() => {});
  warmOutgoingFriendRequestsCache(userId).catch(() => {});
  warmSuggestedCache(userId).catch(() => {});
}
