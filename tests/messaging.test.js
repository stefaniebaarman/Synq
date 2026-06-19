const {
  mergeMessages,
  pendingMatchesServer,
  createPendingMessage,
  findModeratedPendingRemovals,
  reverseMessagePage,
  MESSAGE_PAGE_SIZE,
  dedupeMessagesById,
  mergeMessagePages,
  compareMessages,
} = require("../src/lib/chatMessagesCore.js");

describe("chatMessages", () => {
  test("mergeMessages keeps failed pending rows", () => {
    const server = [
      { id: "1", text: "hi", senderId: "a", createdAt: 1000 },
    ];
    const pending = [
      {
        id: "pending-1",
        clientId: "pending-1",
        text: "failed msg",
        senderId: "b",
        sendStatus: "failed",
        createdAt: 2000,
      },
    ];
    const merged = mergeMessages(server, pending);
    expect(merged).toHaveLength(2);
    expect(merged[1].text).toBe("failed msg");
  });

  test("mergeMessages drops matched sending pending rows", () => {
    const server = [
      { id: "1", text: "hello", senderId: "u1", createdAt: 5000 },
    ];
    const pending = [
      {
        id: "pending-1",
        clientId: "pending-1",
        text: "hello",
        senderId: "u1",
        sendStatus: "sending",
        createdAt: 4990,
      },
    ];
    const merged = mergeMessages(server, pending);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe("1");
    expect(merged[0].clientId).toBe("pending-1");
  });

  test("pendingMatchesServer matches text and sender", () => {
    const pending = createPendingMessage({
      clientId: "p1",
      text: "Test",
      senderId: "u1",
    });
    expect(
      pendingMatchesServer(pending, {
        id: "s1",
        text: "Test",
        senderId: "u1",
        createdAt: pending.createdAt + 100,
      })
    ).toBe(true);
  });

  test("compareMessages sort is stable across repeated sorts", () => {
    const rows = [
      { id: "s1", text: "a", senderId: "u1", createdAt: 1000 },
      {
        id: "pending-2",
        clientId: "pending-2",
        text: "c",
        senderId: "u1",
        sendStatus: "sending",
        createdAt: 3000,
        sendOrder: 2,
      },
      {
        id: "pending-1",
        clientId: "pending-1",
        text: "b",
        senderId: "u1",
        sendStatus: "sending",
        createdAt: 2000,
        sendOrder: 1,
      },
    ];
    const first = [...rows].sort(compareMessages);
    const second = [...rows].sort(compareMessages);
    expect(first.map((m) => m.id)).toEqual(["s1", "pending-1", "pending-2"]);
    expect(second.map((m) => m.id)).toEqual(first.map((m) => m.id));
  });

  test("mergeMessages keeps rapid pending sends in queue order", () => {
    const server = [{ id: "s0", text: "start", senderId: "u1", createdAt: 1000 }];
    const pending = [
      {
        id: "pending-1",
        clientId: "pending-1",
        text: "one",
        senderId: "u1",
        sendStatus: "sending",
        createdAt: 2000,
        sendOrder: 1,
      },
      {
        id: "pending-2",
        clientId: "pending-2",
        text: "two",
        senderId: "u1",
        sendStatus: "sending",
        createdAt: 2001,
        sendOrder: 2,
      },
    ];
    const merged = mergeMessages(server, pending);
    expect(merged.map((m) => m.text)).toEqual(["start", "one", "two"]);
  });

  test("mergeMessages keeps rapid sends ordered when server createdAt is missing", () => {
    const server = [
      { id: "s1", text: "first", senderId: "u1" },
      { id: "s2", text: "second", senderId: "u1", createdAt: 5000 },
    ];
    const pending = [
      {
        id: "pending-1",
        clientId: "pending-1",
        text: "second",
        senderId: "u1",
        sendStatus: "sending",
        createdAt: 5010,
      },
    ];
    const merged = mergeMessages(server, pending);
    expect(merged.map((m) => m.text)).toEqual(["first", "second"]);
    expect(merged[1].clientId).toBe("pending-1");
  });

  test("mergeMessages matches duplicate text sends one-to-one in order", () => {
    const server = [
      { id: "s1", text: "hey", senderId: "u1", createdAt: 1000 },
      { id: "s2", text: "hey", senderId: "u1", createdAt: 2000 },
    ];
    const pending = [
      {
        id: "pending-1",
        clientId: "pending-1",
        text: "hey",
        senderId: "u1",
        sendStatus: "sending",
        createdAt: 990,
      },
      {
        id: "pending-2",
        clientId: "pending-2",
        text: "hey",
        senderId: "u1",
        sendStatus: "sending",
        createdAt: 1990,
      },
    ];
    const merged = mergeMessages(server, pending);
    expect(merged).toHaveLength(2);
    expect(merged[0].clientId).toBe("pending-1");
    expect(merged[1].clientId).toBe("pending-2");
  });

  test("mergeMessages never keeps pending and stamped server with same clientId", () => {
    const server = [
      { id: "s1", text: "hello", senderId: "u1", createdAt: 5000 },
    ];
    const pending = [
      {
        id: "pending-1",
        clientId: "pending-1",
        text: "hello",
        senderId: "u1",
        sendStatus: "sending",
        createdAt: 4990,
      },
    ];
    const merged = mergeMessages(server, pending);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe("s1");
    expect(merged[0].clientId).toBe("pending-1");
  });

  test("findModeratedPendingRemovals detects vanished sends", () => {
    const prev = [
      {
        id: "pending-x",
        clientId: "pending-x",
        text: "bad",
        senderId: "u1",
        sendStatus: "sending",
        createdAt: Date.now(),
      },
    ];
    const removed = findModeratedPendingRemovals(
      prev,
      [],
      new Set(["pending-x"])
    );
    expect(removed).toEqual(["pending-x"]);
  });

  test("reverseMessagePage orders oldest first", () => {
    const page = [
      { id: "2", text: "b", senderId: "a", createdAt: 2000 },
      { id: "1", text: "a", senderId: "a", createdAt: 1000 },
    ];
    const ordered = reverseMessagePage(page);
    expect(ordered.map((m) => m.id)).toEqual(["1", "2"]);
  });

  test("MESSAGE_PAGE_SIZE is 50", () => {
    expect(MESSAGE_PAGE_SIZE).toBe(50);
  });

  test("dedupeMessagesById removes duplicate Firestore ids", () => {
    const dupes = dedupeMessagesById([
      { id: "abc", text: "old", senderId: "u1", createdAt: 1000 },
      { id: "abc", text: "new", senderId: "u1", createdAt: 1000 },
      { id: "def", text: "other", senderId: "u1", createdAt: 2000 },
    ]);
    expect(dupes).toHaveLength(2);
    expect(dupes.find((m) => m.id === "abc")?.text).toBe("new");
  });

  test("mergeMessagePages keeps latest listener window order", () => {
    const stored = [
      { id: "1", text: "a", senderId: "u1", createdAt: 1000 },
      { id: "2", text: "b", senderId: "u1", createdAt: 2000 },
    ];
    const latest = [
      { id: "1", text: "a", senderId: "u1", createdAt: 1000 },
      { id: "2", text: "b updated", senderId: "u1", createdAt: 2000 },
      { id: "3", text: "c", senderId: "u1", createdAt: 3000 },
    ];
    const merged = mergeMessagePages(stored, latest);
    expect(merged.map((m) => m.id)).toEqual(["1", "2", "3"]);
    expect(merged.find((m) => m.id === "2")?.text).toBe("b updated");
  });

  test("mergeMessagePages keeps older history without duplicate ids", () => {
    const merged = mergeMessagePages(
      [
        { id: "1", text: "a", senderId: "u1", createdAt: 1000 },
        { id: "2", text: "b", senderId: "u1", createdAt: 2000 },
      ],
      [
        { id: "2", text: "b updated", senderId: "u1", createdAt: 2000 },
        { id: "3", text: "c", senderId: "u1", createdAt: 3000 },
      ]
    );
    expect(merged.map((m) => m.id)).toEqual(["1", "2", "3"]);
    expect(merged.find((m) => m.id === "2")?.text).toBe("b updated");
  });
});
