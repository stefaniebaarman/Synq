/**
 * Multiplexes Firestore listeners so tab screens share one subscription per collection/doc.
 */
import { Friend } from "@/constants/Variables";
import { collection, doc, onSnapshot, type DocumentData, type Unsubscribe } from "firebase/firestore";
import { db } from "./firebase";
import { ignoreSnapshotPermissionDenied } from "./firestoreListeners";

type UserDocListener = (data: DocumentData | null) => void;
type FriendsListener = (friendIds: string[]) => void;

const userDocHub = new Map<string, { unsub: Unsubscribe; listeners: Set<UserDocListener> }>();
const friendsHub = new Map<string, { unsub: Unsubscribe; listeners: Set<FriendsListener> }>();

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

/** @deprecated type hint for consumers */
export type { Friend };
