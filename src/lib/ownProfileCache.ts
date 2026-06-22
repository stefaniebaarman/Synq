import AsyncStorage from "@react-native-async-storage/async-storage";
import { Friend } from "@/constants/Variables";

import { prefetchResolvedAvatar } from "@/src/lib/helpers";
import {
  friendRelationCacheByUser,
  friendsListCacheByUser,
} from "./socialCache";

export type CachedTopSynq = {
  friendId: string;
  displayName: string;
  imageurl: string | null;
  messageCount: number;
};

export type OwnProfileSnapshot = {
  imageurl: string | null;
  interests: string[];
  events: unknown[];
  city: string | null;
  state: string | null;
  topSynqs: CachedTopSynq[];
};

export type TopSynqRow = { friend: Friend; messageCount: number };

export const ownProfileCacheByUser: Record<string, OwnProfileSnapshot> = {};

const CACHE_VERSION = 3;
const ownProfileCacheKey = (userId: string) =>
  `own-profile-cache:${CACHE_VERSION}:${userId}`;

const hydrateInFlight: Record<string, Promise<void> | undefined> = {};

const emptySnapshot = (): OwnProfileSnapshot => ({
  imageurl: null,
  interests: [],
  events: [],
  city: null,
  state: null,
  topSynqs: [],
});

const prefetchOwnProfileImage = (url: string | null | undefined) => {
  prefetchResolvedAvatar(url);
};

/** Friends you've messaged most (synqCount on the friend doc). */
export function computeTopSynqRows(userId: string, friends: Friend[]): TopSynqRow[] {
  if (!userId) return [];
  const rel = friendRelationCacheByUser[userId];
  if (!rel) return [];
  const rows: TopSynqRow[] = [];
  for (const friend of friends) {
    const messageCount = rel[friend.id]?.synqCount ?? 0;
    if (messageCount <= 0) continue;
    rows.push({ friend, messageCount });
  }
  rows.sort((a, b) => b.messageCount - a.messageCount);
  return rows.slice(0, 3);
}

export function topSynqRowsEqual(a: TopSynqRow[], b: TopSynqRow[]): boolean {
  if (a.length !== b.length) return false;
  return a.every(
    (row, i) =>
      row.friend.id === b[i]?.friend.id && row.messageCount === b[i]?.messageCount
  );
}

export function topSynqRowsFromCache(cached: CachedTopSynq[] | undefined): TopSynqRow[] {
  if (!cached?.length) return [];
  return cached
    .map((row) => {
      if (!row.messageCount || row.messageCount <= 0) return null;
      return {
        friend: {
          id: row.friendId,
          displayName: row.displayName,
          imageurl: row.imageurl,
          mutualCount: 0,
        } as Friend,
        messageCount: row.messageCount,
      };
    })
    .filter((row): row is TopSynqRow => row != null);
}

export function topSynqRowsToCache(rows: TopSynqRow[]): CachedTopSynq[] {
  return rows.map(({ friend, messageCount }) => ({
    friendId: friend.id,
    displayName: friend.displayName || "Friend",
    imageurl:
      typeof friend.imageurl === "string" && friend.imageurl.trim().startsWith("http")
        ? friend.imageurl
        : null,
    messageCount,
  }));
}

export function getCachedOwnProfile(
  userId: string
): OwnProfileSnapshot | undefined {
  return ownProfileCacheByUser[userId];
}

export function setCachedOwnProfile(userId: string, snapshot: OwnProfileSnapshot) {
  if (!userId) return;
  const next: OwnProfileSnapshot = {
    ...emptySnapshot(),
    ...snapshot,
    topSynqs: snapshot.topSynqs ?? [],
  };
  ownProfileCacheByUser[userId] = next;
  prefetchOwnProfileImage(next.imageurl);
  void AsyncStorage.setItem(ownProfileCacheKey(userId), JSON.stringify(next)).catch(
    () => {}
  );
}

export function mergeCachedOwnProfile(
  userId: string,
  partial: Partial<OwnProfileSnapshot>
) {
  const prev = ownProfileCacheByUser[userId] ?? emptySnapshot();
  setCachedOwnProfile(userId, { ...prev, ...partial });
}

export type MeTabInitialState = {
  profileImage: string | null;
  interests: string[];
  selectedInterests: string[];
  city: string | null;
  state: string | null;
  events: unknown[];
  friendsForHostNames: Friend[];
  topSynqRows: TopSynqRow[];
  topSynqsReady: boolean;
};

/** Synchronous snapshot for Me tab first paint (after disk hydrate at app boot). */
export function getMeTabInitialState(userId: string): MeTabInitialState {
  const profile = getCachedOwnProfile(userId);
  const friends = friendsListCacheByUser[userId] ?? [];
  const cachedTop = topSynqRowsFromCache(profile?.topSynqs);
  const topSynqRows =
    cachedTop.length > 0 ? cachedTop : computeTopSynqRows(userId, friends);
  const socialCacheReady = friendsListCacheByUser[userId] !== undefined;

  return {
    profileImage: profile?.imageurl ?? null,
    interests: profile?.interests ?? [],
    selectedInterests: profile?.interests ?? [],
    city: profile?.city ?? null,
    state: profile?.state ?? null,
    events: profile?.events ?? [],
    friendsForHostNames: friends,
    topSynqRows,
    topSynqsReady: topSynqRows.length > 0 || socialCacheReady,
  };
}

/** Prefetch Me tab images after auth hydrate so first open does not flash. */
export function prewarmMeTabScreen(userId: string): void {
  if (!userId) return;
  const profile = getCachedOwnProfile(userId);
  if (profile) {
    prefetchOwnProfileImage(profile.imageurl);
  }
}

export async function hydrateOwnProfileFromDisk(userId: string): Promise<void> {
  if (!userId) return;
  if (ownProfileCacheByUser[userId]) return;
  if (hydrateInFlight[userId]) {
    await hydrateInFlight[userId];
    return;
  }

  hydrateInFlight[userId] = (async () => {
    try {
      const raw = await AsyncStorage.getItem(ownProfileCacheKey(userId));
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<OwnProfileSnapshot>;
      ownProfileCacheByUser[userId] = {
        imageurl: parsed.imageurl ?? null,
        interests: Array.isArray(parsed.interests) ? parsed.interests : [],
        events: Array.isArray(parsed.events) ? parsed.events : [],
        city: parsed.city ?? null,
        state: parsed.state ?? null,
        topSynqs: Array.isArray(parsed.topSynqs) ? parsed.topSynqs : [],
      };
      prefetchOwnProfileImage(ownProfileCacheByUser[userId].imageurl);
    } catch {}
  })();

  try {
    await hydrateInFlight[userId];
  } finally {
    hydrateInFlight[userId] = undefined;
  }
}
