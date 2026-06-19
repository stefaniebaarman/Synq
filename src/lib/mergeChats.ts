export type ChatLike = {
  id: string;
  participants?: string[];
  participantNames?: Record<string, string>;
  participantImages?: Record<string, string>;
};

export function sortedParticipants(participants: string[]): string[] {
  return [...new Set(participants.filter(Boolean))].sort();
}

export function participantsMatch(a: string[], b: string[]): boolean {
  const left = sortedParticipants(a);
  const right = sortedParticipants(b);
  if (left.length !== right.length) return false;
  return left.every((id, index) => id === right[index]);
}

export function mergeParticipantSets(
  chatA: Pick<ChatLike, "participants">,
  chatB: Pick<ChatLike, "participants">
): string[] {
  return sortedParticipants([
    ...(chatA.participants || []),
    ...(chatB.participants || []),
  ]);
}

export function findChatWithParticipants(
  chats: ChatLike[],
  participants: string[]
): ChatLike | undefined {
  return chats.find((chat) =>
    participantsMatch(chat.participants || [], participants)
  );
}

export function mergeParticipantMaps(
  chatA: Pick<ChatLike, "participantNames" | "participantImages">,
  chatB: Pick<ChatLike, "participantNames" | "participantImages">,
  mergedParticipants: string[]
): {
  participantNames: Record<string, string>;
  participantImages: Record<string, string>;
} {
  const participantNames: Record<string, string> = {};
  const participantImages: Record<string, string> = {};

  for (const uid of mergedParticipants) {
    participantNames[uid] =
      chatA.participantNames?.[uid] ||
      chatB.participantNames?.[uid] ||
      "";
    participantImages[uid] =
      chatA.participantImages?.[uid] ||
      chatB.participantImages?.[uid] ||
      "";
  }

  return { participantNames, participantImages };
}

export function uniqueChatIds(chatIds: string[]): string[] {
  return [...new Set(chatIds.map((id) => String(id || "").trim()).filter(Boolean))];
}
