import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "./firebase";

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

const functions = getFunctions(app, "us-central1");

export async function mergeChatsRemote(
  chatIdA: string,
  chatIdB: string
): Promise<{ chatId: string; reused: boolean }> {
  const a = String(chatIdA || "").trim();
  const b = String(chatIdB || "").trim();
  if (!a || !b || a === b) {
    throw new Error("Two different chats are required.");
  }
  const fn = httpsCallable(functions, "mergeChats");
  const result = await fn({ chatIdA: a, chatIdB: b });
  const data = (result?.data || {}) as { chatId?: string; reused?: boolean };
  const chatId = String(data.chatId || "").trim();
  if (!chatId) {
    throw new Error("Combine did not return a chat id.");
  }
  return { chatId, reused: !!data.reused };
}
