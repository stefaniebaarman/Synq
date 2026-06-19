export {
  MESSAGE_PAGE_SIZE,
  createPendingMessage,
  pendingMatchesServer,
  mergeMessages,
  pruneAcknowledgedPending,
  findModeratedPendingRemovals,
  reverseMessagePage,
  messageTimestampMs,
  dedupeMessagesById,
  mergeMessagePages,
} from "./chatMessagesCore.js";

export type MessageSendStatus = "sending" | "failed";

export type ChatMessage = {
  id: string;
  text: string;
  senderId: string;
  createdAt?: unknown;
  imageurl?: string;
  type?: string;
  reactions?: Record<string, string>;
  sendStatus?: MessageSendStatus;
  clientId?: string;
};

export type PendingMessage = ChatMessage & {
  clientId: string;
  sendStatus: MessageSendStatus;
  createdAt: number;
  sendOrder?: number;
};

export function isPendingMessageId(id: string): boolean {
  return id.startsWith("pending-");
}
