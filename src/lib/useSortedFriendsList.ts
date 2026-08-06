import type { Friend } from "@/constants/Variables";
import type { FriendsSortMode } from "@/src/components/friends/FriendsSortControls";
import {
  buildFriendDistanceMap,
  resolveOriginCoords,
  sortFriendsByDistanceKm,
  sortFriendsByName,
  userOriginFromProfile,
} from "@/src/lib/friendDistance";
import { useEffect, useMemo, useState } from "react";

export type SortedFriendsListResult = {
  friends: Friend[];
  distancesKm: Record<string, number>;
};

export function useSortedFriendsList(
  friends: Friend[],
  sortMode: FriendsSortMode,
  userProfile: Record<string, unknown> | null | undefined
): SortedFriendsListResult {
  const { myCoords, myCityLabel } = useMemo(
    () => userOriginFromProfile(userProfile),
    [userProfile]
  );
  const [friendDistancesKm, setFriendDistancesKm] = useState<Record<string, number>>({});
  const [distanceSortReady, setDistanceSortReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setDistanceSortReady(false);

    (async () => {
      const origin = await resolveOriginCoords(myCoords, myCityLabel);
      if (cancelled) return;

      if (!origin || friends.length === 0) {
        setFriendDistancesKm({});
        setDistanceSortReady(true);
        return;
      }

      const map = await buildFriendDistanceMap(friends, origin);
      if (!cancelled) {
        setFriendDistancesKm(map);
        setDistanceSortReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [friends, myCoords, myCityLabel]);

  const sortedFriends = useMemo(() => {
    if (sortMode === "distance" && distanceSortReady) {
      return sortFriendsByDistanceKm(friends, friendDistancesKm);
    }
    return sortFriendsByName(friends);
  }, [friends, sortMode, distanceSortReady, friendDistancesKm]);

  return { friends: sortedFriends, distancesKm: friendDistancesKm };
}
