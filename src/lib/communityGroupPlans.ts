import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import {
  matchesPlanEvent,
  sortOpenPlansByDateTime,
} from "./planEvents";

export type CommunityGroupPlan = {
  id: string;
  groupId: string;
  creatorId: string;
  creatorDisplayName: string;
  title: string;
  date: string;
  time?: string;
  location?: string;
  goingMemberIds: string[];
  createdAt?: unknown;
};

export type CreateCommunityGroupPlanInput = {
  title: string;
  date: string;
  time?: string;
  location?: string;
};

function communityPlansCollection(groupId: string) {
  return collection(db, "communityGroups", groupId, "plans");
}

function communityPlanRef(groupId: string, planId: string) {
  return doc(db, "communityGroups", groupId, "plans", planId);
}

function mapPlanDoc(groupId: string, id: string, data: Record<string, unknown>): CommunityGroupPlan {
  return {
    id,
    groupId,
    creatorId: String(data.creatorId || "").trim(),
    creatorDisplayName: String(data.creatorDisplayName || "").trim() || "Member",
    title: String(data.title || "").trim(),
    date: String(data.date || "").trim(),
    time: String(data.time || "").trim() || undefined,
    location: String(data.location || "").trim() || undefined,
    goingMemberIds: Array.isArray(data.goingMemberIds)
      ? [...new Set((data.goingMemberIds as string[]).map(String).filter(Boolean))]
      : [],
    createdAt: data.createdAt,
  };
}

export function subscribeCommunityGroupPlans(
  groupId: string,
  onData: (plans: CommunityGroupPlan[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  return onSnapshot(
    communityPlansCollection(groupId),
    (snap) => {
      const plans = snap.docs.map((d) =>
        mapPlanDoc(groupId, d.id, d.data() as Record<string, unknown>)
      );
      onData(sortOpenPlansByDateTime(plans));
    },
    (err) => onError?.(err)
  );
}

function formatStoredDateValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isSpontaneousCommunitySynqDate(dateStr: string, now = new Date()): boolean {
  const date = dateStr.trim();
  if (!date) return false;
  const today = formatStoredDateValue(now);
  const tomorrow = formatStoredDateValue(new Date(now.getTime() + 86400000));
  return date === today || date === tomorrow;
}

function formatSynqTimeLabel(timeStr?: string): string {
  const raw = timeStr?.trim();
  if (!raw) return "";
  const cleaned = raw.replace(/\u202f/g, " ").trim();
  const match = cleaned.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match) {
    const hour = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const period = match[3].toLowerCase();
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    if (minutes === 0) {
      return `${displayHour}${period}`;
    }
    return `${displayHour}:${String(minutes).padStart(2, "0")}${period}`;
  }
  return cleaned.toLowerCase().replace(/\s/g, "").replace(":00", "");
}

export function formatCommunitySynqWhenLabel(
  dateStr: string,
  timeStr?: string,
  now = new Date()
): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const planDate = new Date(y, (m || 1) - 1, d || 1);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  planDate.setHours(0, 0, 0, 0);

  let dayLabel: string;
  if (planDate.getTime() === today.getTime()) {
    dayLabel = "today";
  } else if (planDate.getTime() === tomorrow.getTime()) {
    dayLabel = "tomorrow";
  } else {
    const fallbackDay = planDate.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    const timeLabel = formatSynqTimeLabel(timeStr);
    return timeLabel ? `${fallbackDay} at ${timeLabel}` : fallbackDay;
  }

  const timeLabel = formatSynqTimeLabel(timeStr);
  return timeLabel ? `${dayLabel} at ${timeLabel}` : dayLabel;
}

function formatCommunitySynqCardDayLabel(dateStr: string, now = new Date()): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const planDate = new Date(y, (m || 1) - 1, d || 1);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  planDate.setHours(0, 0, 0, 0);

  if (planDate.getTime() === today.getTime()) return "Today";
  if (planDate.getTime() === tomorrow.getTime()) return "Tomorrow";
  return planDate.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatCommunitySynqCardTimeLabel(timeStr?: string): string {
  const raw = timeStr?.trim();
  if (!raw) return "";
  const cleaned = raw.replace(/\u202f/g, " ").trim();
  const match = cleaned.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match) {
    const hour = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const period = match[3].toUpperCase();
    return `${hour}:${String(minutes).padStart(2, "0")} ${period}`;
  }
  return cleaned;
}

export function getCommunitySynqCardMetaParts(
  dateStr: string,
  timeStr?: string,
  location?: string,
  now = new Date()
): string[] {
  const parts = [formatCommunitySynqCardDayLabel(dateStr, now)];
  const timeLabel = formatCommunitySynqCardTimeLabel(timeStr);
  if (timeLabel) parts.push(timeLabel);
  const locationLabel = location?.trim();
  if (locationLabel) parts.push(locationLabel);
  return parts;
}

export function formatCommunitySynqCardMeta(
  dateStr: string,
  timeStr?: string,
  location?: string,
  now = new Date()
): string {
  return getCommunitySynqCardMetaParts(dateStr, timeStr, location, now).join(" • ");
}

export function formatCommunitySynqGoingCount(count: number): string {
  const n = Math.max(0, count);
  return n === 1 ? "1 person going" : `${n} people going`;
}

export function isCommunityPlanGoing(plan: CommunityGroupPlan, uid: string): boolean {
  if (!uid) return false;
  return plan.goingMemberIds.includes(uid);
}

export async function createCommunityGroupPlan(
  groupId: string,
  uid: string,
  creatorDisplayName: string,
  input: CreateCommunityGroupPlanInput
): Promise<string> {
  const title = input.title.trim();
  const date = input.date.trim();
  if (!title) throw new Error("Synq title is required.");
  if (!date) throw new Error("Synq date is required.");
  if (!isSpontaneousCommunitySynqDate(date)) {
    throw new Error("Plans can only be shared for today or tomorrow.");
  }

  const ref = doc(communityPlansCollection(groupId));
  await setDoc(ref, {
    groupId,
    creatorId: uid,
    creatorDisplayName: creatorDisplayName.trim() || "Member",
    title: title.slice(0, 80),
    date,
    time: input.time?.trim().slice(0, 32) || "",
    location: input.location?.trim().slice(0, 120) || "",
    goingMemberIds: [uid],
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deleteCommunityGroupPlan(groupId: string, planId: string): Promise<void> {
  await deleteDoc(communityPlanRef(groupId, planId));
}

export function isCommunityPlanOnUserEvents(
  plan: CommunityGroupPlan,
  userEvents: unknown[]
): boolean {
  if (!Array.isArray(userEvents)) return false;
  return userEvents.some((event) =>
    isMatchingCommunityPlanUserEvent(event, plan, userEvents)
  );
}

function communityPlanEventTarget(plan: CommunityGroupPlan) {
  return {
    title: plan.title,
    date: plan.date,
    time: plan.time || "",
    location: plan.location || "",
    planHostUid: plan.creatorId,
    communityPlanId: plan.id,
    communityGroupId: plan.groupId,
  };
}

function isMatchingCommunityPlanUserEvent(
  event: unknown,
  plan: CommunityGroupPlan,
  userEvents: unknown[]
): boolean {
  if (String((event as { communityPlanId?: string })?.communityPlanId || "") === plan.id) {
    return true;
  }
  return matchesPlanEvent(event, communityPlanEventTarget(plan), userEvents);
}

export async function removeCommunityPlanFromUserEvents(
  uid: string,
  plan: CommunityGroupPlan
): Promise<"removed" | "not_found"> {
  const result = await setCommunityPlanGoing(uid, plan, "", false);
  return result === "not_found" ? "not_found" : "removed";
}

async function setCommunityPlanGoing(
  uid: string,
  plan: CommunityGroupPlan,
  viewerDisplayName: string,
  going: boolean
): Promise<"added" | "already" | "removed" | "not_found"> {
  const meRef = doc(db, "users", uid);
  const planRef = communityPlanRef(plan.groupId, plan.id);

  return runTransaction(db, async (tx) => {
    const meSnap = await tx.get(meRef);
    const planSnap = await tx.get(planRef);
    if (!planSnap.exists()) {
      throw new Error("This synq is no longer available.");
    }

    const planData = planSnap.data() as Record<string, unknown>;
    const goingMemberIds = Array.isArray(planData.goingMemberIds)
      ? [...new Set((planData.goingMemberIds as string[]).map(String).filter(Boolean))]
      : [];
    const existing = meSnap.exists()
      ? Array.isArray((meSnap.data() as { events?: unknown }).events)
        ? ([...(meSnap.data() as { events: unknown[] }).events] as Record<string, unknown>[])
        : []
      : [];
    const alreadyGoing = isCommunityPlanOnUserEvents(plan, existing) || goingMemberIds.includes(uid);

    if (going) {
      if (alreadyGoing) return "already";

      const creatorName = plan.creatorDisplayName.trim() || "Member";
      const viewerName = viewerDisplayName.trim() || "You";
      const sourceIds = Array.from(new Set([plan.creatorId, uid].filter(Boolean)));
      const sourceNames = Array.from(new Set([creatorName, viewerName].filter(Boolean)));

      const newEvent = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: plan.title,
        date: plan.date,
        time: plan.time || "",
        location: plan.location || "",
        planHostUid: plan.creatorId,
        joinedFromId: plan.creatorId,
        joinedFromIds: sourceIds,
        joinedFromName: sourceNames.join(", "),
        joinedFromNames: sourceNames,
        mergedIntoExisting: false,
        joinedFromFriendUid: plan.creatorId,
        communityGroupId: plan.groupId,
        communityPlanId: plan.id,
        attendeeDisplayNames: {
          [plan.creatorId]: creatorName,
          [uid]: viewerName,
        },
      };

      tx.update(meRef, {
        events: sortOpenPlansByDateTime([...existing, newEvent]),
      });
      tx.update(planRef, {
        goingMemberIds: [...new Set([...goingMemberIds, uid])],
      });
      return "added";
    }

    if (!alreadyGoing) return "not_found";

    const nextEvents = existing.filter(
      (event) => !isMatchingCommunityPlanUserEvent(event, plan, existing)
    );
    tx.update(meRef, { events: nextEvents });
    tx.update(planRef, {
      goingMemberIds: goingMemberIds.filter((id) => id !== uid),
    });
    return "removed";
  });
}

export async function addCommunityPlanToUserEvents(
  uid: string,
  plan: CommunityGroupPlan,
  viewerDisplayName: string
): Promise<"added" | "already"> {
  const result = await setCommunityPlanGoing(uid, plan, viewerDisplayName, true);
  return result === "already" ? "already" : "added";
}

export function formatCommunityPlanDateLabel(dateStr: string): {
  weekday: string;
  day: number;
  month: string;
} {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  return {
    weekday: date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(),
    day: date.getDate(),
    month: date.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
  };
}
