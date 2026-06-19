import { auth, db } from "@/src/lib/firebase";
import { ignoreSnapshotPermissionDenied } from "@/src/lib/firestoreListeners";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot } from "firebase/firestore";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type BlockedContextValue = {
  blockedSet: Set<string>;
  isBlocked: (uid: string) => boolean;
  ready: boolean;
};

const BlockedUsersContext = createContext<BlockedContextValue>({
  blockedSet: new Set(),
  isBlocked: () => false,
  ready: false,
});

export function BlockedUsersProvider({ children }: { children: React.ReactNode }) {
  const [blockedSet, setBlockedSet] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);
  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUid(u?.uid ?? null));
    return unsub;
  }, []);

  useEffect(() => {
    if (!uid) {
      setBlockedSet(new Set());
      setReady(true);
      return;
    }
    setReady(false);
    const unsub = onSnapshot(
      collection(db, "users", uid, "blocked"),
      (snap) => {
        const next = new Set<string>();
        snap.docs.forEach((d) => next.add(d.id));
        setBlockedSet(next);
        setReady(true);
      },
      (err) => {
        ignoreSnapshotPermissionDenied(err);
        setReady(true);
      }
    );
    return unsub;
  }, [uid]);

  const value = useMemo(
    () => ({
      blockedSet,
      isBlocked: (id: string) => blockedSet.has(id),
      ready,
    }),
    [blockedSet, ready]
  );

  return (
    <BlockedUsersContext.Provider value={value}>{children}</BlockedUsersContext.Provider>
  );
}

export function useBlockedUsers() {
  return useContext(BlockedUsersContext);
}
