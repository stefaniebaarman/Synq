/**
 * Firestore security rules + critical-path flows (auth gate, DM message, friend accept).
 * Requires: `npm test` (wraps Firestore emulator via firebase emulators:exec).
 */
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require("@firebase/rules-unit-testing");
const {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
} = require("firebase/firestore");

const RULES_PATH = join(__dirname, "..", "firestore.rules");
const PROJECT_ID = "demo-synq-rules";

describe("Firestore", () => {
  let testEnv;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: readFileSync(RULES_PATH, "utf8"),
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  describe("security rules", () => {
    test("unauthenticated users cannot read arbitrary profiles (auth gate)", async () => {
      const anon = testEnv.unauthenticatedContext();
      const db = anon.firestore();
      await assertFails(getDoc(doc(db, "users", "alice")));
    });

    test("users can create and read their own profile document", async () => {
      const alice = testEnv.authenticatedContext("alice");
      const db = alice.firestore();
      await assertSucceeds(
        setDoc(doc(db, "users", "alice"), { displayName: "Alice" })
      );
      await assertSucceeds(getDoc(doc(db, "users", "alice")));
    });

    test("users cannot read another user without friendship or pending request", async () => {
      const alice = testEnv.authenticatedContext("alice");
      const bob = testEnv.authenticatedContext("bob");
      const aliceDb = alice.firestore();
      const bobDb = bob.firestore();

      await assertSucceeds(
        setDoc(doc(aliceDb, "users", "alice"), { displayName: "Alice" })
      );
      await assertSucceeds(
        setDoc(doc(bobDb, "users", "bob"), { displayName: "Bob" })
      );

      await assertFails(getDoc(doc(aliceDb, "users", "bob")));
    });

    test("friends can read each other's profiles", async () => {
      const alice = testEnv.authenticatedContext("alice");
      const bob = testEnv.authenticatedContext("bob");
      const aliceDb = alice.firestore();
      const bobDb = bob.firestore();

      await assertSucceeds(
        setDoc(doc(aliceDb, "users", "alice"), { displayName: "Alice" })
      );
      await assertSucceeds(
        setDoc(doc(bobDb, "users", "bob"), { displayName: "Bob" })
      );
      await assertSucceeds(
        setDoc(doc(aliceDb, "users", "alice", "friends", "bob"), { ok: true })
      );
      await assertSucceeds(
        setDoc(doc(bobDb, "users", "bob", "friends", "alice"), { ok: true })
      );

      await assertSucceeds(getDoc(doc(aliceDb, "users", "bob")));
      await assertSucceeds(getDoc(doc(bobDb, "users", "alice")));
    });

    test("friend requests reject self-invites and duplicates", async () => {
      const alice = testEnv.authenticatedContext("alice");
      const bob = testEnv.authenticatedContext("bob");
      const aliceDb = alice.firestore();
      const bobDb = bob.firestore();

      await assertSucceeds(
        setDoc(doc(aliceDb, "users", "alice"), { displayName: "Alice" })
      );
      await assertSucceeds(
        setDoc(doc(bobDb, "users", "bob"), { displayName: "Bob" })
      );

      await assertFails(
        setDoc(doc(aliceDb, "users", "alice", "friendRequests", "alice"), {
          from: "alice",
          to: "alice",
          senderName: "Alice",
        })
      );

      await assertSucceeds(
        setDoc(doc(aliceDb, "users", "bob", "friendRequests", "alice"), {
          from: "alice",
          to: "bob",
          senderName: "Alice",
        })
      );

      await assertFails(
        setDoc(doc(bobDb, "users", "alice", "friendRequests", "bob"), {
          from: "bob",
          to: "alice",
          senderName: "Bob",
        })
      );
    });

    test("clients cannot read or write invite attribution logs", async () => {
      const alice = testEnv.authenticatedContext("alice");
      const aliceDb = alice.firestore();
      await assertFails(
        setDoc(doc(aliceDb, "invites", "alice_bob"), {
          fromUid: "alice",
          toUid: "bob",
        })
      );
      await assertFails(getDoc(doc(aliceDb, "invites", "alice_bob")));
    });

    test("community groups are public to signed-in users", async () => {
      const alice = testEnv.authenticatedContext("alice");
      const bob = testEnv.authenticatedContext("bob");
      const aliceDb = alice.firestore();
      const bobDb = bob.firestore();

      await assertSucceeds(
        setDoc(doc(aliceDb, "users", "alice"), { displayName: "Alice" })
      );
      await assertSucceeds(
        setDoc(doc(bobDb, "users", "bob"), { displayName: "Bob" })
      );

      await assertSucceeds(
        setDoc(doc(aliceDb, "communityGroups", "cg1"), {
          name: "DC Golfers",
          nameLower: "dc golfers",
          creatorId: "alice",
          memberIds: ["alice"],
        })
      );

      await assertSucceeds(getDoc(doc(aliceDb, "communityGroups", "cg1")));
      await assertSucceeds(getDoc(doc(bobDb, "communityGroups", "cg1")));
    });

    test("community groups support optional profile metadata", async () => {
      const alice = testEnv.authenticatedContext("alice");
      const aliceDb = alice.firestore();

      await assertSucceeds(
        setDoc(doc(aliceDb, "users", "alice"), { displayName: "Alice" })
      );

      await assertSucceeds(
        setDoc(doc(aliceDb, "communityGroups", "cg2"), {
          name: "DC Volo Kickball",
          nameLower: "dc volo kickball",
          creatorId: "alice",
          memberIds: ["alice"],
          category: "Sports",
          location: "Washington, DC",
          about: "Weekly kickball league",
          coverPhotoUrl: "https://example.com/cover.jpg",
        })
      );
    });

    test("community group members can create plans", async () => {
      const alice = testEnv.authenticatedContext("alice");
      const bob = testEnv.authenticatedContext("bob");
      const aliceDb = alice.firestore();
      const bobDb = bob.firestore();

      await assertSucceeds(
        setDoc(doc(aliceDb, "users", "alice"), { displayName: "Alice" })
      );
      await assertSucceeds(
        setDoc(doc(bobDb, "users", "bob"), { displayName: "Bob" })
      );
      await assertSucceeds(
        setDoc(doc(aliceDb, "communityGroups", "cg1"), {
          name: "DC Volo Kickball",
          nameLower: "dc volo kickball",
          creatorId: "alice",
          memberIds: ["alice", "bob"],
        })
      );

      await assertSucceeds(
        setDoc(doc(bobDb, "communityGroups", "cg1", "plans", "plan1"), {
          groupId: "cg1",
          creatorId: "bob",
          creatorDisplayName: "Bob",
          title: "Kickball drop-in game tonight",
          date: "2026-06-20",
          time: "7:00 PM",
          location: "U Street",
        })
      );

      await assertSucceeds(getDoc(doc(aliceDb, "communityGroups", "cg1", "plans", "plan1")));
    });

    test("community group members can toggle going on plans", async () => {
      const alice = testEnv.authenticatedContext("alice");
      const bob = testEnv.authenticatedContext("bob");
      const aliceDb = alice.firestore();
      const bobDb = bob.firestore();

      await assertSucceeds(
        setDoc(doc(aliceDb, "users", "alice"), { displayName: "Alice" })
      );
      await assertSucceeds(
        setDoc(doc(bobDb, "users", "bob"), { displayName: "Bob" })
      );
      await assertSucceeds(
        setDoc(doc(aliceDb, "communityGroups", "cg1"), {
          name: "DC Volo Kickball",
          nameLower: "dc volo kickball",
          creatorId: "alice",
          memberIds: ["alice", "bob"],
        })
      );
      await assertSucceeds(
        setDoc(doc(bobDb, "communityGroups", "cg1", "plans", "plan1"), {
          groupId: "cg1",
          creatorId: "bob",
          creatorDisplayName: "Bob",
          title: "Kickball drop-in game tonight",
          date: "2026-06-20",
          time: "7:00 PM",
          location: "U Street",
          goingMemberIds: ["bob"],
        })
      );

      await assertSucceeds(
        updateDoc(doc(aliceDb, "communityGroups", "cg1", "plans", "plan1"), {
          goingMemberIds: ["bob", "alice"],
        })
      );
      await assertSucceeds(
        updateDoc(doc(aliceDb, "communityGroups", "cg1", "plans", "plan1"), {
          goingMemberIds: ["bob"],
        })
      );
    });

    test("non-members cannot create community group plans", async () => {
      const alice = testEnv.authenticatedContext("alice");
      const bob = testEnv.authenticatedContext("bob");
      const aliceDb = alice.firestore();
      const bobDb = bob.firestore();

      await assertSucceeds(
        setDoc(doc(aliceDb, "users", "alice"), { displayName: "Alice" })
      );
      await assertSucceeds(
        setDoc(doc(bobDb, "users", "bob"), { displayName: "Bob" })
      );
      await assertSucceeds(
        setDoc(doc(aliceDb, "communityGroups", "cg1"), {
          name: "DC Volo Kickball",
          nameLower: "dc volo kickball",
          creatorId: "alice",
          memberIds: ["alice"],
        })
      );

      await assertFails(
        setDoc(doc(bobDb, "communityGroups", "cg1", "plans", "plan1"), {
          groupId: "cg1",
          creatorId: "bob",
          creatorDisplayName: "Bob",
          title: "Kickball drop-in game tonight",
          date: "2026-06-20",
          time: "7:00 PM",
          location: "U Street",
        })
      );
    });

    test("users can join public community groups", async () => {
      const alice = testEnv.authenticatedContext("alice");
      const bob = testEnv.authenticatedContext("bob");
      const aliceDb = alice.firestore();
      const bobDb = bob.firestore();

      await assertSucceeds(
        setDoc(doc(aliceDb, "users", "alice"), { displayName: "Alice" })
      );
      await assertSucceeds(
        setDoc(doc(bobDb, "users", "bob"), { displayName: "Bob" })
      );
      await assertSucceeds(
        setDoc(doc(aliceDb, "communityGroups", "cg1"), {
          name: "DC Golfers",
          nameLower: "dc golfers",
          creatorId: "alice",
          memberIds: ["alice"],
        })
      );

      await assertSucceeds(
        updateDoc(doc(bobDb, "communityGroups", "cg1"), {
          memberIds: ["alice", "bob"],
        })
      );
    });

    test("non-creators cannot rename community groups", async () => {
      const alice = testEnv.authenticatedContext("alice");
      const bob = testEnv.authenticatedContext("bob");
      const aliceDb = alice.firestore();
      const bobDb = bob.firestore();

      await assertSucceeds(
        setDoc(doc(aliceDb, "users", "alice"), { displayName: "Alice" })
      );
      await assertSucceeds(
        setDoc(doc(bobDb, "users", "bob"), { displayName: "Bob" })
      );
      await assertSucceeds(
        setDoc(doc(aliceDb, "communityGroups", "cg1"), {
          name: "DC Golfers",
          nameLower: "dc golfers",
          creatorId: "alice",
          memberIds: ["alice", "bob"],
        })
      );

      await assertFails(
        updateDoc(doc(bobDb, "communityGroups", "cg1"), {
          name: "Hacked",
          nameLower: "hacked",
          creatorId: "alice",
          memberIds: ["alice", "bob"],
        })
      );
    });

    test("community group members can invite friends instead of adding directly", async () => {
      const alice = testEnv.authenticatedContext("alice");
      const bob = testEnv.authenticatedContext("bob");
      const aliceDb = alice.firestore();
      const bobDb = bob.firestore();

      await assertSucceeds(
        setDoc(doc(aliceDb, "users", "alice"), { displayName: "Alice" })
      );
      await assertSucceeds(
        setDoc(doc(bobDb, "users", "bob"), { displayName: "Bob" })
      );
      await assertSucceeds(
        setDoc(doc(aliceDb, "users", "alice", "friends", "bob"), { ok: true })
      );
      await assertSucceeds(
        setDoc(doc(bobDb, "users", "bob", "friends", "alice"), { ok: true })
      );
      await assertSucceeds(
        setDoc(doc(aliceDb, "communityGroups", "cg1"), {
          name: "DC Golfers",
          nameLower: "dc golfers",
          creatorId: "alice",
          memberIds: ["alice"],
        })
      );

      await assertFails(
        updateDoc(doc(aliceDb, "communityGroups", "cg1"), {
          memberIds: ["alice", "bob"],
        })
      );

      await assertSucceeds(
        setDoc(doc(aliceDb, "users", "bob", "communityGroupInvites", "cg1"), {
          groupId: "cg1",
          groupName: "DC Golfers",
          fromUserId: "alice",
          fromUserName: "Alice",
          createdAt: new Date(),
        })
      );
      await assertSucceeds(
        setDoc(doc(aliceDb, "communityGroups", "cg1", "invites", "bob"), {
          targetUserId: "bob",
          fromUserId: "alice",
          createdAt: new Date(),
        })
      );
    });

    test("invitees can accept community group invites", async () => {
      const alice = testEnv.authenticatedContext("alice");
      const bob = testEnv.authenticatedContext("bob");
      const aliceDb = alice.firestore();
      const bobDb = bob.firestore();

      await assertSucceeds(
        setDoc(doc(aliceDb, "users", "alice"), { displayName: "Alice" })
      );
      await assertSucceeds(
        setDoc(doc(bobDb, "users", "bob"), { displayName: "Bob" })
      );
      await assertSucceeds(
        setDoc(doc(aliceDb, "communityGroups", "cg1"), {
          name: "DC Golfers",
          nameLower: "dc golfers",
          creatorId: "alice",
          memberIds: ["alice"],
        })
      );
      await assertSucceeds(
        setDoc(doc(bobDb, "users", "bob", "communityGroupInvites", "cg1"), {
          groupId: "cg1",
          groupName: "DC Golfers",
          fromUserId: "alice",
          fromUserName: "Alice",
        })
      );
      await assertSucceeds(
        setDoc(doc(aliceDb, "communityGroups", "cg1", "invites", "bob"), {
          targetUserId: "bob",
          fromUserId: "alice",
        })
      );

      await assertSucceeds(
        updateDoc(doc(bobDb, "communityGroups", "cg1"), {
          memberIds: ["alice", "bob"],
        })
      );
      await assertSucceeds(
        deleteDoc(doc(bobDb, "users", "bob", "communityGroupInvites", "cg1"))
      );
      await assertSucceeds(
        deleteDoc(doc(bobDb, "communityGroups", "cg1", "invites", "bob"))
      );
    });

    test("friend groups are private to the owner", async () => {
      const alice = testEnv.authenticatedContext("alice");
      const bob = testEnv.authenticatedContext("bob");
      const aliceDb = alice.firestore();
      const bobDb = bob.firestore();

      await assertSucceeds(
        setDoc(doc(aliceDb, "users", "alice"), { displayName: "Alice" })
      );
      await assertSucceeds(
        setDoc(doc(bobDb, "users", "bob"), { displayName: "Bob" })
      );

      await assertSucceeds(
        setDoc(doc(aliceDb, "users", "alice", "friendGroups", "g1"), {
          name: "Roommates",
          memberIds: [],
          sortOrder: 1,
        })
      );

      await assertSucceeds(
        getDoc(doc(aliceDb, "users", "alice", "friendGroups", "g1"))
      );
      await assertFails(getDoc(doc(bobDb, "users", "alice", "friendGroups", "g1")));
      await assertFails(
        setDoc(doc(bobDb, "users", "alice", "friendGroups", "g1"), {
          name: "Hacked",
          memberIds: [],
        })
      );
    });

    test("only chat participants can read chat and messages", async () => {
      const alice = testEnv.authenticatedContext("alice");
      const bob = testEnv.authenticatedContext("bob");
      const eve = testEnv.authenticatedContext("eve");
      const aliceDb = alice.firestore();
      const bobDb = bob.firestore();
      const eveDb = eve.firestore();

      await assertSucceeds(
        setDoc(doc(aliceDb, "users", "alice"), { displayName: "Alice" })
      );
      await assertSucceeds(
        setDoc(doc(bobDb, "users", "bob"), { displayName: "Bob" })
      );
      await assertSucceeds(
        setDoc(doc(eveDb, "users", "eve"), { displayName: "Eve" })
      );

      await assertSucceeds(
        setDoc(doc(aliceDb, "chats", "c1"), {
          participants: ["alice", "bob"],
        })
      );

      await assertSucceeds(getDoc(doc(aliceDb, "chats", "c1")));
      await assertSucceeds(getDoc(doc(bobDb, "chats", "c1")));
      await assertSucceeds(getDoc(doc(eveDb, "chats", "c1")));
    });

    test("users cannot forge friendships on another user's list", async () => {
      const alice = testEnv.authenticatedContext("alice");
      const bob = testEnv.authenticatedContext("bob");
      const aliceDb = alice.firestore();
      const bobDb = bob.firestore();

      await assertSucceeds(
        setDoc(doc(aliceDb, "users", "alice"), { displayName: "Alice" })
      );
      await assertSucceeds(
        setDoc(doc(bobDb, "users", "bob"), { displayName: "Bob" })
      );

      await assertFails(
        setDoc(doc(bobDb, "users", "alice", "friends", "bob"), { ok: true })
      );
    });

    test("chat create requires friends among participants", async () => {
      const alice = testEnv.authenticatedContext("alice");
      const bob = testEnv.authenticatedContext("bob");
      const eve = testEnv.authenticatedContext("eve");
      const aliceDb = alice.firestore();
      const bobDb = bob.firestore();
      const eveDb = eve.firestore();

      await assertSucceeds(
        setDoc(doc(aliceDb, "users", "alice"), { displayName: "Alice" })
      );
      await assertSucceeds(
        setDoc(doc(bobDb, "users", "bob"), { displayName: "Bob" })
      );
      await assertSucceeds(
        setDoc(doc(eveDb, "users", "eve"), { displayName: "Eve" })
      );
      await assertSucceeds(
        setDoc(doc(aliceDb, "users", "alice", "friends", "bob"), { ok: true })
      );
      await assertSucceeds(
        setDoc(doc(bobDb, "users", "bob", "friends", "alice"), { ok: true })
      );

      await assertSucceeds(
        setDoc(doc(aliceDb, "chats", "dm_ab"), {
          participants: ["alice", "bob"],
        })
      );

      await assertFails(
        setDoc(doc(aliceDb, "chats", "bad_chat"), {
          participants: ["alice", "eve"],
        })
      );
    });

    test("community members can create chats without friendship when scoped to a group", async () => {
      const alice = testEnv.authenticatedContext("alice");
      const bob = testEnv.authenticatedContext("bob");
      const eve = testEnv.authenticatedContext("eve");
      const aliceDb = alice.firestore();
      const bobDb = bob.firestore();
      const eveDb = eve.firestore();

      await assertSucceeds(
        setDoc(doc(aliceDb, "users", "alice"), { displayName: "Alice" })
      );
      await assertSucceeds(
        setDoc(doc(bobDb, "users", "bob"), { displayName: "Bob" })
      );
      await assertSucceeds(
        setDoc(doc(eveDb, "users", "eve"), { displayName: "Eve" })
      );
      await assertSucceeds(
        setDoc(doc(aliceDb, "communityGroups", "cg1"), {
          name: "Run Club",
          nameLower: "run club",
          creatorId: "alice",
          memberIds: ["alice", "bob"],
        })
      );

      await assertSucceeds(
        setDoc(doc(aliceDb, "chats", "community_ab"), {
          participants: ["alice", "bob"],
          communityGroupId: "cg1",
          source: "community",
        })
      );

      await assertFails(
        setDoc(doc(aliceDb, "chats", "community_ae"), {
          participants: ["alice", "eve"],
          communityGroupId: "cg1",
          source: "community",
        })
      );
    });

    test("messages are create-only except reactions", async () => {
      const alice = testEnv.authenticatedContext("alice");
      const bob = testEnv.authenticatedContext("bob");
      const aliceDb = alice.firestore();
      const bobDb = bob.firestore();

      await assertSucceeds(
        setDoc(doc(aliceDb, "users", "alice"), { displayName: "Alice" })
      );
      await assertSucceeds(
        setDoc(doc(bobDb, "users", "bob"), { displayName: "Bob" })
      );
      await assertSucceeds(
        setDoc(doc(aliceDb, "users", "alice", "friends", "bob"), { ok: true })
      );
      await assertSucceeds(
        setDoc(doc(bobDb, "users", "bob", "friends", "alice"), { ok: true })
      );
      await assertSucceeds(
        setDoc(doc(aliceDb, "chats", "dm_ab"), {
          participants: ["alice", "bob"],
        })
      );
      await assertSucceeds(
        setDoc(doc(aliceDb, "chats", "dm_ab", "messages", "m1"), {
          senderId: "alice",
          text: "hey",
        })
      );

      await assertFails(
        updateDoc(doc(bobDb, "chats", "dm_ab", "messages", "m1"), {
          text: "tampered",
        })
      );
      await assertFails(
        deleteDoc(doc(aliceDb, "chats", "dm_ab", "messages", "m1"))
      );
      await assertSucceeds(
        updateDoc(doc(bobDb, "chats", "dm_ab", "messages", "m1"), {
          reactions: { bob: "heart" },
        })
      );
    });
  });

  describe("critical paths", () => {
    test("message: friends exchange DMs in a shared chat", async () => {
      const alice = testEnv.authenticatedContext("alice");
      const bob = testEnv.authenticatedContext("bob");
      const aliceDb = alice.firestore();
      const bobDb = bob.firestore();

      await setDoc(doc(aliceDb, "users", "alice"), { displayName: "Alice" });
      await setDoc(doc(bobDb, "users", "bob"), { displayName: "Bob" });
      await setDoc(doc(aliceDb, "users", "alice", "friends", "bob"), {
        ok: true,
      });
      await setDoc(doc(bobDb, "users", "bob", "friends", "alice"), {
        ok: true,
      });

      await setDoc(doc(aliceDb, "chats", "dm_ab"), {
        participants: ["alice", "bob"],
      });

      await assertSucceeds(
        setDoc(doc(aliceDb, "chats", "dm_ab", "messages", "m1"), {
          senderId: "alice",
          text: "hey",
        })
      );

      await assertSucceeds(
        getDoc(doc(bobDb, "chats", "dm_ab", "messages", "m1"))
      );
    });

    test("friend accept: incoming request then mutual friend docs", async () => {
      const alice = testEnv.authenticatedContext("alice");
      const bob = testEnv.authenticatedContext("bob");
      const aliceDb = alice.firestore();
      const bobDb = bob.firestore();

      await setDoc(doc(aliceDb, "users", "alice"), { displayName: "Alice" });
      await setDoc(doc(bobDb, "users", "bob"), { displayName: "Bob" });

      await assertSucceeds(
        setDoc(doc(bobDb, "users", "alice", "friendRequests", "bob"), {
          from: "bob",
          to: "alice",
          senderName: "Bob",
        })
      );

      await assertSucceeds(
        deleteDoc(doc(aliceDb, "users", "alice", "friendRequests", "bob"))
      );

      await assertSucceeds(
        setDoc(doc(aliceDb, "users", "alice", "friends", "bob"), { ok: true })
      );
      await assertSucceeds(
        setDoc(doc(bobDb, "users", "bob", "friends", "alice"), { ok: true })
      );

      await assertSucceeds(getDoc(doc(aliceDb, "users", "bob")));
    });

    test("users can manage their own blocked list", async () => {
      const alice = testEnv.authenticatedContext("alice");
      const aliceDb = alice.firestore();

      await assertSucceeds(
        setDoc(doc(aliceDb, "users", "alice"), { displayName: "Alice" })
      );
      await assertSucceeds(
        setDoc(doc(aliceDb, "users", "alice", "blocked", "bob"), {
          blockedAt: new Date().toISOString(),
        })
      );
      await assertSucceeds(getDoc(doc(aliceDb, "users", "alice", "blocked", "bob")));
    });

    test("users cannot read another user's blocked list", async () => {
      const alice = testEnv.authenticatedContext("alice");
      const bob = testEnv.authenticatedContext("bob");
      const aliceDb = alice.firestore();
      const bobDb = bob.firestore();

      await assertSucceeds(
        setDoc(doc(aliceDb, "users", "alice"), { displayName: "Alice" })
      );
      await assertSucceeds(
        setDoc(doc(aliceDb, "users", "alice", "blocked", "bob"), {
          blockedAt: new Date().toISOString(),
        })
      );

      await assertFails(getDoc(doc(bobDb, "users", "alice", "blocked", "bob")));
    });

    test("clients cannot write to moderationQueue", async () => {
      const alice = testEnv.authenticatedContext("alice");
      const aliceDb = alice.firestore();

      await assertSucceeds(
        setDoc(doc(aliceDb, "users", "alice"), { displayName: "Alice" })
      );

      await assertFails(
        setDoc(doc(aliceDb, "moderationQueue", "r1"), {
          reporterId: "alice",
          status: "open",
        })
      );
    });
  });
});
