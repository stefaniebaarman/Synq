import { doc, writeBatch } from "firebase/firestore";
import { db } from "./firebase";

export function synqNudgeNotifId(fromUserId: string, recipientId: string): string {
  return `synq_nudge_${fromUserId}_${recipientId}`.slice(0, 1400);
}

export function friendSynqActiveNotifId(
  activatedUserId: string,
  recipientId: string
): string {
  return `synq_active_${activatedUserId}_${recipientId}`.slice(0, 1400);
}

export function activityNotificationId(
  type: "friend_synq_active" | "synq_nudge",
  fromUserId: string,
  recipientId: string
): string {
  return type === "synq_nudge"
    ? synqNudgeNotifId(fromUserId, recipientId)
    : friendSynqActiveNotifId(fromUserId, recipientId);
}

/** Deletes mirrored notification docs (notifications + notificationLocks). */
export async function dismissActivityNotification(
  userId: string,
  notificationId: string
): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, "users", userId, "notifications", notificationId));
  batch.delete(doc(db, "users", userId, "notificationLocks", notificationId));
  await batch.commit();
}
