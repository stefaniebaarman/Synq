import type { Friend } from "@/constants/Variables";
import type { FriendsSortMode } from "@/src/components/friends/FriendsSortControls";
import {
  buildFriendDistanceMap,
  resolveOriginCoords,
  sortFriendsByDistanceKm,
  sortFriendsByName,
  userOriginFromProfile,
} from "@/src/lib/friendDistance";
import { useEffect, useMemo, useRef, useState } from "react";

export type SortedFriendsListResult = {
  friends: Friend[];
  distancesKm: Record<string, number>;
};

function originKey(
  myCoords: { lat: number; lng: number } | null,
  myCityLabel: string
): string {
  if (myCoords) return `c:${myCoords.lat},${myCoords.lng}`;
  return `l:${myCityLabel}`;
}

function friendsIdentityKey(friends: Friend[]): string {
  return friends
    .map((f) => {
      const lat = (f as { lat?: unknown }).lat;
      const lng = (f as { lng?: unknown }).lng;
      const coords =
        typeof lat === "number" && typeof lng === "number"
          ? `${lat},${lng}`
          : "";
      return `${f.id}:${coords}`;
    })
    .join("|");
}

function distanceMapsEqual(
  a: Record<string, number>,
  b: Record<string, number>
): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return bKeys.every((id) => a[id] === b[id]);
}

export function useSortedFriendsList(
  friends: Friend[],
  sortMode: FriendsSortMode,
  userProfile: Record<string, unknown> | null | undefined
): SortedFriendsListResult {
  const { myCoords, myCityLabel } = useMemo(
    () => userOriginFromProfile(userProfile),
    // Only recompute when origin fields change — ignore drop-in / memo / etc.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      typeof userProfile?.lat === "number" ? userProfile.lat : null,
      typeof userProfile?.lng === "number" ? userProfile.lng : null,
      typeof userProfile?.city === "string" ? userProfile.city : "",
      typeof userProfile?.state === "string" ? userProfile.state : "",
      typeof userProfile?.locationDisplay === "string"
        ? userProfile.locationDisplay
        : "",
    ]
  );

  const listKey = useMemo(() => friendsIdentityKey(friends), [friends]);
  const rebuildKey = `${listKey}::${originKey(myCoords, myCityLabel)}`;
  const friendsRef = useRef(friends);
  friendsRef.current = friends;

  const [friendDistancesKm, setFriendDistancesKm] = useState<
    Record<string, number>
  >({});
  const [distanceSortReady, setDistanceSortReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const origin = await resolveOriginCoords(myCoords, myCityLabel);
      if (cancelled) return;

      const list = friendsRef.current;
      if (!origin || list.length === 0) {
        setFriendDistancesKm((prev) =>
          Object.keys(prev).length === 0 ? prev : {}
        );
        setDistanceSortReady(true);
        return;
      }

      const map = await buildFriendDistanceMap(list, origin);
      if (cancelled) return;
      setFriendDistancesKm((prev) =>
        distanceMapsEqual(prev, map) ? prev : map
      );
      setDistanceSortReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [rebuildKey]);

  const sortedFriends = useMemo(() => {
    if (sortMode === "distance" && distanceSortReady) {
      return sortFriendsByDistanceKm(friends, friendDistancesKm);
    }
    return sortFriendsByName(friends);
  }, [friends, sortMode, distanceSortReady, friendDistancesKm]);

  return { friends: sortedFriends, distancesKm: friendDistancesKm };
}
