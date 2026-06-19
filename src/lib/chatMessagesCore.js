/** Shared chat message helpers (client + Jest). */

const MESSAGE_PAGE_SIZE = 50;

function rawMessageTimestampMs(message) {
  const createdAt = message.createdAt;
  if (createdAt && typeof createdAt === "object" && createdAt.toMillis) {
    return createdAt.toMillis();
  }
  if (typeof createdAt === "number" && createdAt > 0) return createdAt;
  return 0;
}

function messageTimestampMs(message) {
  const ms = rawMessageTimestampMs(message);
  if (ms > 0) return ms;
  if (typeof message.createdAt === "number" && message.createdAt > 0) {
    return message.createdAt;
  }
  return 0;
}

function compareMessages(a, b) {
  const delta = messageTimestampMs(a) - messageTimestampMs(b);
  if (delta !== 0) return delta;
  const aOrder =
    typeof a.sendOrder === "number" ? a.sendOrder : Number.MAX_SAFE_INTEGER;
  const bOrder =
    typeof b.sendOrder === "number" ? b.sendOrder : Number.MAX_SAFE_INTEGER;
  if (aOrder !== bOrder) return aOrder - bOrder;
  const aKey = String(a.clientId ?? a.id ?? "");
  const bKey = String(b.clientId ?? b.id ?? "");
  return aKey.localeCompare(bKey);
}

function createPendingMessage(params) {
  return {
    id: params.clientId,
    clientId: params.clientId,
    text: params.text,
    senderId: params.senderId,
    imageurl: params.imageurl,
    sendStatus: "sending",
    createdAt: params.createdAt ?? Date.now(),
    sendOrder: params.sendOrder,
  };
}

function pendingMatchesServer(pending, server, windowMs = 120000) {
  if (pending.senderId !== server.senderId) return false;
  if (pending.text.trim() !== server.text.trim()) return false;
  const serverMs = rawMessageTimestampMs(server);
  if (!serverMs) return true;
  const pendingMs =
    typeof pending.createdAt === "number" ? pending.createdAt : Date.now();
  return Math.abs(serverMs - pendingMs) <= windowMs;
}

function stampClientIdsFromPending(serverMessages, pendingMessages) {
  if (!pendingMessages.length) return serverMessages;

  const matchedServerIds = new Set();
  const stamps = new Map();

  for (const pending of pendingMessages) {
    if (pending.sendStatus === "failed") continue;
    const server = serverMessages.find(
      (row) =>
        !matchedServerIds.has(row.id) && pendingMatchesServer(pending, row)
    );
    if (!server) continue;
    matchedServerIds.add(server.id);
    stamps.set(server.id, {
      clientId: pending.clientId,
      createdAt: pending.createdAt ?? Date.now(),
      sendOrder: pending.sendOrder,
    });
  }

  if (stamps.size === 0) return serverMessages;

  return serverMessages.map((message) => {
    const stamp = stamps.get(message.id);
    if (!stamp) return message;
    return {
      ...message,
      clientId: stamp.clientId,
      createdAt: stamp.createdAt,
      sendOrder: stamp.sendOrder ?? message.sendOrder,
    };
  });
}

function matchedPendingClientIds(serverMessages, pendingMessages) {
  const matched = new Set();
  const matchedServerIds = new Set();

  for (const pending of pendingMessages) {
    if (pending.sendStatus === "failed") continue;
    const server = serverMessages.find(
      (row) =>
        !matchedServerIds.has(row.id) && pendingMatchesServer(pending, row)
    );
    if (!server) continue;
    matchedServerIds.add(server.id);
    matched.add(pending.clientId);
  }

  return matched;
}

/** Dedupe by id; later entries win; preserve first-seen order (no resort). */
function dedupeByIdPreserveOrder(messages) {
  const byId = new Map();
  const order = [];

  for (const message of messages) {
    if (!message?.id) continue;
    if (!byId.has(message.id)) order.push(message.id);
    byId.set(message.id, message);
  }

  return order.map((id) => byId.get(id));
}

function dedupeMergedMessages(messages) {
  const byId = dedupeByIdPreserveOrder(messages);
  const serverClientIds = new Set(
    byId
      .filter(
        (message) =>
          message.clientId && !String(message.id).startsWith("pending-")
      )
      .map((message) => message.clientId)
  );
  const seenClientIds = new Set();

  return byId.filter((message) => {
    if (!message.clientId) return true;
    if (
      String(message.id).startsWith("pending-") &&
      serverClientIds.has(message.clientId)
    ) {
      return false;
    }
    if (seenClientIds.has(message.clientId)) return false;
    seenClientIds.add(message.clientId);
    return true;
  });
}

function mergeMessages(serverMessages, pendingMessages) {
  if (!pendingMessages.length) return serverMessages;

  const stampedServer = stampClientIdsFromPending(serverMessages, pendingMessages);
  const matchedIds = matchedPendingClientIds(serverMessages, pendingMessages);
  const stampedClientIds = new Set(
    stampedServer
      .map((message) => message.clientId)
      .filter((clientId) => typeof clientId === "string" && clientId.length > 0)
  );

  const unmatchedPending = pendingMessages.filter((pending) => {
    if (pending.sendStatus === "failed") return true;
    if (matchedIds.has(pending.clientId)) return false;
    if (stampedClientIds.has(pending.clientId)) return false;
    return true;
  });

  if (!unmatchedPending.length) return dedupeMergedMessages(stampedServer);

  return dedupeMergedMessages([...stampedServer, ...unmatchedPending]);
}

function pruneAcknowledgedPending(serverMessages, pendingMessages) {
  if (!pendingMessages.length) return pendingMessages;
  const matchedIds = matchedPendingClientIds(serverMessages, pendingMessages);
  return pendingMessages.filter((pending) => {
    if (pending.sendStatus === "failed") return true;
    return !matchedIds.has(pending.clientId);
  });
}

function findModeratedPendingRemovals(
  prevPending,
  nextPending,
  recentlySentClientIds,
  withinMs = 15000
) {
  const removed = [];
  const now = Date.now();
  for (const prev of prevPending) {
    if (prev.sendStatus !== "sending") continue;
    if (!recentlySentClientIds.has(prev.clientId)) continue;
    const stillPending = nextPending.some((p) => p.clientId === prev.clientId);
    if (stillPending) continue;
    const age = now - (typeof prev.createdAt === "number" ? prev.createdAt : now);
    if (age <= withinMs) removed.push(prev.clientId);
  }
  return removed;
}

function reverseMessagePage(page) {
  return [...page].reverse();
}

/** Keep one row per message id; later entries win; sorted for cold loads. */
function dedupeMessagesById(messages) {
  const byId = new Map();
  for (const message of messages) {
    if (!message?.id) continue;
    byId.set(message.id, message);
  }
  return [...byId.values()].sort(compareMessages);
}

/**
 * Merge paginated history with the live listener window without re-sorting
 * confirmed messages. `latestWindow` order (Firestore asc) wins for the tail.
 */
function mergeMessagePages(stored, latestWindow) {
  if (!stored.length) return latestWindow;
  if (!latestWindow.length) return stored;

  const latestById = new Map(latestWindow.map((message) => [message.id, message]));
  const prefix = stored.filter((message) => !latestById.has(message.id));

  return dedupeByIdPreserveOrder([...prefix, ...latestWindow]);
}

module.exports = {
  MESSAGE_PAGE_SIZE,
  createPendingMessage,
  pendingMatchesServer,
  mergeMessages,
  pruneAcknowledgedPending,
  findModeratedPendingRemovals,
  reverseMessagePage,
  messageTimestampMs,
  dedupeMessagesById,
  dedupeByIdPreserveOrder,
  mergeMessagePages,
  compareMessages,
};
