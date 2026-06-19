import { DEFAULT_AVATAR } from "@/constants/Variables";
import * as ExpoImage from "expo-image";

export type SynqStatus = "idle" | "activating" | "active";

export const formatTime = (timestamp: any) => {
  if (!timestamp) return "";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const chatFirstName = (fullName: string) =>
  (fullName || "").trim().split(/\s+/)[0];

export type ChatParticipantSummary = { uid: string; name: string };

export const getOtherChatParticipants = (
  chat: any,
  myId?: string
): ChatParticipantSummary[] => {
  if (!chat?.participantNames || !myId) return [];

  return Object.entries(chat.participantNames)
    .filter(([uid]) => uid !== myId)
    .map(([uid, name]) => ({ uid, name: (name as string).trim() }))
    .filter((participant) => participant.name)
    .sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );
};

/** Stable display title for inbox preview and open chat (names sorted A→Z). */
export const getChatTitle = (chat: any, myId?: string) => {
  if (!chat) return "Synq Chat";

  if (chat.customName?.trim()) {
    return wrapChatTitle(chat.customName.trim(), 25);
  }

  if (!chat.participantNames || !myId) return "Synq Chat";

  const otherUsers = getOtherChatParticipants(chat, myId).map(
    (participant) => participant.name
  );

  if (otherUsers.length === 0) return "Just You";
  if (otherUsers.length === 1) return otherUsers[0];

  const firstNames = otherUsers.map(chatFirstName);
  const lastFriend = firstNames.pop();
  return `${firstNames.join(", ")} & ${lastFriend}`;
};

/** Secondary line under the title in the messages inbox for community chats. */
export const getCommunityChatInboxSubtitle = (chat: any): string | null => {
  if (!chat) return null;
  const planTitle = String(chat.communityPlanTitle || "").trim();
  const groupName = String(chat.communityGroupName || "").trim();
  return planTitle || groupName || null;
};

export const getLeadingEmoji = (text: string) => {
  if (!text) return null;
  const firstChar = Array.from(text.trim())[0];
  if (/\p{Extended_Pictographic}/u.test(firstChar)) {
    return firstChar;
  }
  return null;
};

export const formatLastSynq = (date: Date) => {
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;

  return date.toLocaleDateString();
};

export const parseIdeaText = (text: string) => {
  const lines = (text || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const name = lines[0] || "";
  const address = lines.slice(1).join(" ") || "";
  return { name, address };
};

const LEGACY_AI_PREFIX = /^✨\s*Synq AI Suggestion:?$/i;

/** True when a chat message should render as a Synq AI suggestion card. */
export function isAiSuggestionMessage(item: {
  text?: string;
  type?: string;
  venueImage?: string;
}): boolean {
  if (item.type === "aiSuggestion") return true;
  if (item.venueImage) return true;

  const text = String(item.text || "");
  if (text.includes("✨ Synq AI Suggestion")) return true;

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2 || lines.length > 3) return false;
  if (LEGACY_AI_PREFIX.test(lines[0])) return false;

  const addressLine = lines.slice(1).join(" ");
  return /\d/.test(addressLine) && /[,]/.test(addressLine);
}

export function isLegacyAiSuggestionText(text: string): boolean {
  return String(text || "").includes("✨ Synq AI Suggestion");
}

export function stripLegacyAiPrefix(text: string): string {
  const lines = String(text || "").split("\n");
  if (LEGACY_AI_PREFIX.test(lines[0]?.trim() || "")) {
    return lines.slice(1).join("\n").trim();
  }
  return text.replace(/^✨\s*Synq AI Suggestion:?\s*/i, "").trim();
}

/** Strip trailing US zip codes for shorter venue address display. */
export function formatVenueAddressDisplay(address: string): string {
  return String(address || "")
    .trim()
    .replace(/\s+\d{5}(-\d{4})?\s*$/, "");
}

export const resolveAvatar = (url?: any) => {
  if (typeof url === "string" && url.trim().startsWith("http")) {
    return url;
  }
  return DEFAULT_AVATAR;
};

export function isCustomAvatar(url?: unknown): url is string {
  return (
    typeof url === "string" &&
    url.trim().startsWith("http") &&
    url.trim() !== DEFAULT_AVATAR
  );
}

/** Prefer the newest real profile photo over stale chat snapshots or placeholders. */
export function resolveChatSenderAvatar(
  senderId: string,
  opts: {
    participantImages?: Record<string, string>;
    messageImageUrl?: unknown;
    liveImages?: Record<string, string>;
  }
): string {
  const candidates = [
    opts.liveImages?.[senderId],
    opts.participantImages?.[senderId],
    opts.messageImageUrl,
  ];
  for (const candidate of candidates) {
    if (isCustomAvatar(candidate)) return candidate.trim();
  }
  return DEFAULT_AVATAR;
}

/** Max faces shown in inbox/chat overlapping avatar stacks (3+ person chats still show 2). */
export const MAX_STACK_AVATARS = 2;

export function getStackAvatarUris(
  images: Record<string, string> | undefined | null,
  currentUserId?: string,
  participantOrder?: string[]
): string[] {
  if (!images) return [];

  const seen = new Set<string>();
  const uris: string[] = [];
  const orderedUids =
    participantOrder && participantOrder.length > 0
      ? participantOrder.filter(Boolean)
      : Object.keys(images).sort();

  for (const uid of orderedUids) {
    if (currentUserId && uid === currentUserId) continue;
    const url = images[uid];
    if (url == null) continue;
    const uri = resolveAvatar(url);
    if (!uri || seen.has(uri)) continue;
    seen.add(uri);
    uris.push(uri);
    if (uris.length >= MAX_STACK_AVATARS) break;
  }

  return uris;
}

export const prefetchResolvedAvatar = (url?: any) => {
  const resolved = resolveAvatar(url);
  if (typeof resolved === "string" && resolved.startsWith("http")) {
    ExpoImage.Image.prefetch(resolved, "memory-disk").catch(() => {});
  }
};

export const wrapChatTitle = (text: string, maxChars = 30) => {
    const tokens = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const token of tokens) {
      const testLine = currentLine
        ? `${currentLine} ${token}`
        : token;

      if (testLine.length <= maxChars) {
        currentLine = testLine;
      } else {
        lines.push(currentLine);
        currentLine = token;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines.join('\n');
  };

export function friendLocationLine(friend: any): string | null {
  const loc =
    typeof friend?.locationDisplay === "string" && friend.locationDisplay.trim()
      ? friend.locationDisplay.trim()
      : friend?.city
        ? `${friend.city}${friend.state ? `, ${friend.state}` : ""}`
        : null;
  return loc;
}
