function str(v) {
  if (typeof v === "string" && v.trim()) return v.trim();
  return undefined;
}

function chatIdFromData(data) {
  const chatRaw = data.chatId ?? data.chat_id;
  if (typeof chatRaw === "string" && chatRaw.trim()) return chatRaw.trim();
  if (chatRaw != null) return String(chatRaw).trim() || undefined;
  return undefined;
}

function messageIdFromData(data) {
  return str(data.messageId ?? data.message_id);
}

const CHAT_NOTIFICATION_TYPES = new Set([
  "message",
  "message_reaction",
  "poll_vote",
]);

/**
 * Map Expo push notification `data` to an in-app navigation target.
 * Returns null when the payload is missing or unrecognized.
 */
function parsePushNotificationTap(data) {
  if (!data || typeof data !== "object") return null;

  const type = typeof data.type === "string" ? data.type : undefined;
  const chatId = chatIdFromData(data);
  const messageId = messageIdFromData(data);

  if (chatId || (type && CHAT_NOTIFICATION_TYPES.has(type))) {
    const resolvedChatId = chatId;
    if (resolvedChatId) {
      return {
        kind: "chat",
        chatId: resolvedChatId,
        messageId: messageId || undefined,
      };
    }
  }

  if (type === "friend_request" || type === "friend_request_reminder") {
    return { kind: "notifications" };
  }

  if (type === "friend_accepted") {
    const friendId = str(data.fromUserId);
    if (friendId) {
      return { kind: "friend_profile", friendId };
    }
    return { kind: "notifications" };
  }

  if (
    type === "friend_synq_active" ||
    type === "synq_nudge" ||
    type === "friends_free_digest" ||
    type === "prime_time"
  ) {
    return {
      kind: "synq_home",
      fromUserId: str(data.fromUserId),
      notificationType: type,
    };
  }

  if (type === "friend_drop_in") {
    const fromUserId = str(data.fromUserId);
    return {
      kind: "synq_home",
      fromUserId,
      notificationType: type,
      openChatWith: fromUserId,
    };
  }

  if (type === "open_plan_interest") {
    return {
      kind: "me",
      focusEventId: str(data.eventId),
      notificationId: str(data.notificationId),
    };
  }

  if (type === "plan_invite") {
    return { kind: "notifications" };
  }

  if (type === "community_group_invite") {
    const groupId = str(data.groupId);
    if (groupId) {
      return { kind: "community_group", groupId };
    }
    return { kind: "notifications" };
  }

  if (
    type === "community_post_approval" ||
    type === "community_post_approved" ||
    type === "community_post_rejected"
  ) {
    const groupId = str(data.groupId);
    if (groupId) {
      return { kind: "community_group", groupId };
    }
    return { kind: "notifications" };
  }

  if (type === "community_plan_join") {
    const groupId = str(data.groupId);
    const planId = str(data.planId);
    if (groupId) {
      return { kind: "community_group", groupId, planId };
    }
    return { kind: "notifications" };
  }

  return null;
}

module.exports = {
  parsePushNotificationTap,
};
