/** Chat to open after navigating to the Synq tab (e.g. from a push notification or community page). */
export type PendingChatOpenExisting = {
  mode: "existing";
  chatId: string;
  messageId?: string;
};

export type PendingChatOpenNew = {
  mode: "new";
  chatId?: string;
  participants: string[];
  participantNames: Record<string, string>;
  participantImages: Record<string, string>;
  communityGroupId?: string;
  communityGroupName?: string;
  communityPlanId?: string;
  communityPlanTitle?: string;
};

export type PendingChatOpen = PendingChatOpenExisting | PendingChatOpenNew;

let pending: PendingChatOpen | null = null;
const listeners = new Set<() => void>();

function notifyPendingChatOpen() {
  for (const listener of listeners) {
    try {
      listener();
    } catch {}
  }
}

export function setPendingChatOpen(value: PendingChatOpen | string, messageId?: string) {
  if (typeof value === "string") {
    pending = { mode: "existing", chatId: value, messageId };
  } else {
    pending = value;
  }
  notifyPendingChatOpen();
}

export function peekPendingChatOpen(): PendingChatOpen | null {
  return pending;
}

/** Removes and returns the pending chat open request (call only after handling). */
export function consumePendingChatOpen(): PendingChatOpen | null {
  const value = pending;
  pending = null;
  return value;
}

export function clearPendingChatOpen() {
  pending = null;
}

export function subscribePendingChatOpen(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
