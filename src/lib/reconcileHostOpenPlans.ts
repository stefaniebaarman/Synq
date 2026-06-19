import { collection, doc, getDoc, getDocs, updateDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import { eventKeyLoose, filterOutPastOpenPlans } from "./planEvents";

export async function reconcileHostOpenPlansFromFriends(hostUid: string): Promise<void> {
  const user = auth.currentUser;
  if (!user || user.uid !== hostUid) return;

  const meRef = doc(db, "users", hostUid);
  const meSnap = await getDoc(meRef);
  if (!meSnap.exists()) return;

  let events = Array.isArray(meSnap.data()?.events) ? [...(meSnap.data() as any).events] : [];
  const beforePrune = events.length;
  events = filterOutPastOpenPlans(events);
  if (events.length < beforePrune) {
    await updateDoc(meRef, { events });
  }
  if (events.length === 0) return;

  const friendsSnap = await getDocs(collection(db, "users", hostUid, "friends"));
  const friendIds = friendsSnap.docs.map((d) => d.id);
  if (friendIds.length === 0) return;

  const displayNameById: Record<string, string> = {};
  const ensureName = async (uid: string) => {
    if (displayNameById[uid]) return;
    try {
      const s = await getDoc(doc(db, "users", uid));
      if (s.exists()) {
        displayNameById[uid] = String((s.data() as any)?.displayName || "").trim();
      }
    } catch {}
  };

  let anyChange = false;

  for (const fid of friendIds) {
    try {
      const fs = await getDoc(doc(db, "users", fid));
      if (!fs.exists()) continue;
      const theirs = Array.isArray((fs.data() as any)?.events) ? (fs.data() as any).events : [];

      for (const te of theirs) {
        const pointsToHost =
          String(te.planHostUid || "").trim() === hostUid ||
          String(te.joinedFromFriendUid || "").trim() === hostUid;
        if (!pointsToHost) continue;

        const looseT = eventKeyLoose(te);
        const titleT = String(te.title || "").trim().toLowerCase();

        const candidates = events
          .map((e: any, i: number) => ({ e, i }))
          .filter(({ e }) => {
            const titleE = String(e.title || "").trim().toLowerCase();
            if (titleE !== titleT) return false;
            if (eventKeyLoose(e) !== looseT) return false;
            const ph = String(e.planHostUid || "").trim();
            if (ph && ph !== hostUid) return false;
            return true;
          });

        if (candidates.length !== 1) continue;
        const idx = candidates[0].i;
        const e = events[idx];

        const existingIds = new Set<string>(
          [...(Array.isArray(e.joinedFromIds) ? e.joinedFromIds : []), e.joinedFromId]
            .filter(Boolean)
            .map((x: string) => String(x).trim())
        );
        existingIds.add(hostUid);
        existingIds.add(fid);
        for (const x of Array.isArray(te.joinedFromIds) ? te.joinedFromIds : []) {
          if (x) existingIds.add(String(x).trim());
        }
        if (te.joinedFromId) existingIds.add(String(te.joinedFromId).trim());

        const mergedIds = Array.from(existingIds);
        const prevKey = [...(Array.isArray(e.joinedFromIds) ? e.joinedFromIds : [])]
          .map((x: string) => String(x).trim())
          .filter(Boolean)
          .sort()
          .join("|");
        const orderedIds = [hostUid, ...mergedIds.filter((id) => id !== hostUid)];
        const nextKey = orderedIds.slice().sort().join("|");

        for (const uid of mergedIds) await ensureName(uid);
        const otherNames = mergedIds
          .filter((id) => id !== hostUid)
          .map((id) => displayNameById[id])
          .filter(Boolean);

        const prevNamesStr = (Array.isArray(e.joinedFromNames) ? e.joinedFromNames : [e.joinedFromName])
          .filter(Boolean)
          .map(String)
          .sort()
          .join("|");
        const nextNamesStr = otherNames
          .slice()
          .sort()
          .join("|");
        if (prevKey === nextKey && prevNamesStr === nextNamesStr) continue;

        anyChange = true;
        const updated: Record<string, unknown> = {
          ...e,
          planHostUid: hostUid,
          joinedFromIds: orderedIds,
          joinedFromId: hostUid,
          joinedFromNames: otherNames,
          joinedFromName: otherNames.join(", "),
        };
        delete updated.joinedFromFriendUid;
        events[idx] = updated;
      }
    } catch {}
  }

  if (!anyChange) return;

  await updateDoc(meRef, { events });
}
