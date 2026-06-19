
export function eventKey(event: any): string {
  return `${String(event?.title || "").trim().toLowerCase()}|${String(event?.date || "").trim()}|${String(
    event?.time || ""
  ).trim().toLowerCase()}|${String(event?.location || "").trim().toLowerCase()}`;
}

export function eventKeyLoose(event: any): string {
  return `${String(event?.title || "").trim().toLowerCase()}|${String(event?.date || "").trim()}`;
}

/** Locate a host's open plan row by stored id, then by content match. */
export function findHostOpenPlanIndex(
  events: any[] | null | undefined,
  planId: string,
  snapshot: any,
  options?: {
    hostUid?: string;
    fields?: { title?: string; date?: string; time?: string; location?: string };
  }
): number {
  if (!Array.isArray(events)) return -1;
  const id = String(planId || "").trim();
  if (!id) return -1;

  const byId = events.findIndex((e) => String(e?.id ?? "").trim() === id);
  if (byId >= 0) return byId;

  const hostUid = String(options?.hostUid || snapshot?.planHostUid || "").trim();
  const snapshots = [
    snapshot ? { ...snapshot, planHostUid: hostUid || snapshot?.planHostUid } : null,
    options?.fields
      ? {
          ...(snapshot || {}),
          ...options.fields,
          planHostUid: hostUid || snapshot?.planHostUid,
        }
      : null,
    options?.fields ? { ...options.fields, planHostUid: hostUid } : null,
  ].filter(Boolean);

  for (const snap of snapshots) {
    const idx = events.findIndex((e) => matchesPlanEvent(e, snap, events));
    if (idx >= 0) return idx;
  }

  const title = String(
    options?.fields?.title || snapshot?.title || ""
  )
    .trim()
    .toLowerCase();
  const date = String(options?.fields?.date || snapshot?.date || "").trim();
  if (title && date && hostUid) {
    const candidates = events
      .map((e, i) => ({ e, i }))
      .filter(({ e }) => {
        if (String(e?.title || "").trim().toLowerCase() !== title) return false;
        if (String(e?.date || "").trim() !== date) return false;
        const rowHost = String(e?.planHostUid || "").trim();
        return !rowHost || rowHost === hostUid;
      });
    if (candidates.length === 1) return candidates[0].i;
  }

  return -1;
}

/** Ensure hosted plan rows keep a stable id for invite lookups. */
export function hostPlanRowWithIdentity(
  row: any,
  planId: string,
  hostUid: string
): Record<string, unknown> {
  const id = String(planId || row?.id || "").trim();
  const host = String(row?.planHostUid || hostUid).trim() || hostUid;
  return {
    ...row,
    id,
    planHostUid: host,
  };
}

export function matchesPlanEvent(e: any, target: any, siblingEvents: any[]): boolean {
  if (eventKey(e) === eventKey(target)) return true;

  const hostE = String(e?.planHostUid || "").trim();
  const hostT = String(target?.planHostUid || "").trim();
  if (hostE && hostT && hostE !== hostT) return false;

  if (hostE && hostT && hostE === hostT && eventKeyLoose(e) === eventKeyLoose(target)) {
    const sameHostLoose = siblingEvents.filter(
      (x) =>
        String(x?.planHostUid || "").trim() === hostE && eventKeyLoose(x) === eventKeyLoose(e)
    );
    if (sameHostLoose.length === 1) return true;
  }

  if (hostT && !hostE && eventKeyLoose(e) === eventKeyLoose(target)) {
    const sameLoose = siblingEvents.filter((x) => eventKeyLoose(x) === eventKeyLoose(target));
    const withoutHost = sameLoose.filter((x) => !String(x?.planHostUid || "").trim());
    if (withoutHost.length === 1 && withoutHost[0] === e) return true;
  }

  if (!hostT && hostE && eventKeyLoose(e) === eventKeyLoose(target)) {
    const sameLoose = siblingEvents.filter((x) => eventKeyLoose(x) === eventKeyLoose(target));
    const withHost = sameLoose.filter((x) => String(x?.planHostUid || "").trim() === hostE);
    if (withHost.length === 1 && withHost[0] === e) return true;
  }

  return false;
}

export function matchesPlanEventForHostSync(
  e: any,
  target: any,
  siblingEvents: any[],
  planHostUid: string
): boolean {
  const host = String(planHostUid || "").trim();
  if (!host) return false;
  if (eventKeyLoose(e) !== eventKeyLoose(target)) return false;
  const rowHost = String(e?.planHostUid || "").trim();
  if (rowHost && rowHost !== host) return false;
  const candidates = siblingEvents.filter(
    (x) =>
      eventKeyLoose(x) === eventKeyLoose(target) &&
      (!String(x?.planHostUid || "").trim() || String(x.planHostUid).trim() === host)
  );
  return candidates.length === 1 && candidates[0] === e;
}

/** Open plans stay visible for 12 hours after start so late joiners can still find them. */
export const OPEN_PLAN_GRACE_MS = 12 * 60 * 60 * 1000;

/** True when the plan started more than 12 hours ago (date-only plans use noon as start). */
export function isOpenPlanPast(
  event: { date?: string; time?: string },
  now: Date = new Date()
): boolean {
  const dateStr = String(event?.date || "").trim();
  if (!dateStr) return false;
  const startMs = parseOpenPlanDateTime(dateStr, event?.time).getTime();
  return now.getTime() >= startMs + OPEN_PLAN_GRACE_MS;
}

export function filterOutPastOpenPlans<T extends { date?: string; time?: string }>(
  events: T[] | null | undefined
): T[] {
  if (!Array.isArray(events)) return [];
  return events.filter((e) => !isOpenPlanPast(e));
}

export function parseOpenPlanDateTime(dateStr: string, timeStr?: string): Date {
  const raw = String(dateStr || "").trim();
  const parts = raw.split("-").map(Number);
  const y = parts[0] || 1970;
  const m = parts[1] || 1;
  const d = parts[2] || 1;
  const date = new Date(y, m - 1, d);

  const timeRaw = String(timeStr || "").trim();
  if (!timeRaw) {
    date.setHours(12, 0, 0, 0);
    return date;
  }

  const cleaned = timeRaw.replace(/\u202f/g, " ").trim();
  const match12 = cleaned.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = parseInt(match12[2], 10);
    const period = match12[3].toUpperCase();
    if (period === "PM" && hours !== 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;
    date.setHours(hours, minutes || 0, 0, 0);
    return date;
  }

  const match24 = cleaned.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    date.setHours(parseInt(match24[1], 10), parseInt(match24[2], 10), 0, 0);
    return date;
  }

  // Unrecognized format — keep on the calendar day instead of treating as midnight/past.
  date.setHours(23, 59, 59, 999);
  return date;
}

/** Canonical 12-hour time string for Firestore (avoids locale-specific spaces). */
export function formatPlanTimeForStorage(date: Date): string {
  const hours24 = date.getHours();
  const minutes = date.getMinutes();
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${String(minutes).padStart(2, "0")} ${period}`;
}

/** Sort key for when a plan happens (earliest first). */
export function openPlanSortValue(event: { date?: string; time?: string }): number {
  return parseOpenPlanDateTime(String(event?.date || ""), event?.time).getTime();
}

/** Order open plans by event date/time, not when they were added. */
export function sortOpenPlansByDateTime<T extends { date?: string; time?: string }>(
  events: T[]
): T[] {
  return [...events].sort((a, b) => openPlanSortValue(a) - openPlanSortValue(b));
}

/** Friend UIDs who expressed interest on the host's plan (excludes the host). */
export function collectPlanInterestedFriendIds(
  event: any,
  hostUid?: string
): string[] {
  const host = String(hostUid || event?.planHostUid || "").trim();
  const ids = new Set<string>();
  if (Array.isArray(event?.joinedFromIds)) {
    event.joinedFromIds.forEach((id: unknown) => {
      const s = String(id || "").trim();
      if (s && s !== host) ids.add(s);
    });
  }
  const joinedFromId = String(event?.joinedFromId || "").trim();
  if (joinedFromId && joinedFromId !== host) ids.add(joinedFromId);
  return [...ids];
}

/** True when the viewer created this plan (not a copy joined from a friend). */
export function canEditOpenPlan(event: any, viewerUid: string): boolean {
  const viewer = String(viewerUid || "").trim();
  if (!viewer) return false;
  const host = String(event?.planHostUid || "").trim();
  if (host) return host === viewer;
  const joinedFromFriend = String(event?.joinedFromFriendUid || "").trim();
  if (joinedFromFriend && joinedFromFriend !== viewer) return false;
  return true;
}
