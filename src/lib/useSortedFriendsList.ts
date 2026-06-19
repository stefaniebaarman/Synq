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

export function useSortedFriendsList(
  friends: Friend[],
  sortMode: FriendsSortMode,
  userProfile: Record<string, unknown> | null | undefined
): Friend[] {
  const { myCoords, myCityLabel } = useMemo(
    () => userOriginFromProfile(userProfile),
    [userProfile]
  );
  const [friendDistancesKm, setFriendDistancesKm] = useState<Record<string, number>>({});
  const [distanceSortReady, setDistanceSortReady] = useState(sortMode !== "distance");

  useEffect(() => {
    if (sortMode !== "distance") {
      setDistanceSortReady(true);
      return;
    }

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
  }, [sortMode, friends, myCoords, myCityLabel]);

  return useMemo(() => {
    if (sortMode === "distance" && distanceSortReady) {
      return sortFriendsByDistanceKm(friends, friendDistancesKm);
    }
    return sortFriendsByName(friends);
  }, [friends, sortMode, distanceSortReady, friendDistancesKm]);
}
