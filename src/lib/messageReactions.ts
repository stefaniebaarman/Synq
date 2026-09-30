export const MESSAGE_REACTION_TYPES = [
  "heart",
  "thumbs_up",
  "laugh",
  "emphasize",
] as const;

export type MessageReactionType = (typeof MESSAGE_REACTION_TYPES)[number];

export type MessageReactionCounts = Record<MessageReactionType, number>;

const REACTION_EMOJI: Record<MessageReactionType, string> = {
  heart: "❤️",
  thumbs_up: "👍",
  laugh: "😂",
  emphasize: "❗",
};

export function isMessageReactionType(
  value: unknown
): value is MessageReactionType {
  return (
    typeof value === "string" &&
    (MESSAGE_REACTION_TYPES as readonly string[]).includes(value)
  );
}

export function emptyReactionCounts(): MessageReactionCounts {
  return {
    heart: 0,
    thumbs_up: 0,
    laugh: 0,
    emphasize: 0,
  };
}

export function getReactionCounts(
  reactions?: Record<string, string>
): MessageReactionCounts {
  const counts = emptyReactionCounts();
  if (!reactions) return counts;
  for (const value of Object.values(reactions)) {
    if (isMessageReactionType(value)) counts[value] += 1;
  }
  return counts;
}

export function countReactionsOfType(
  reactions: Record<string, string> | undefined,
  type: MessageReactionType
): number {
  return getReactionCounts(reactions)[type];
}

export function totalReactionCount(counts: MessageReactionCounts): number {
  let total = 0;
  for (const type of MESSAGE_REACTION_TYPES) total += counts[type];
  return total;
}

export function reactionEmoji(type: MessageReactionType): string {
  return REACTION_EMOJI[type];
}
