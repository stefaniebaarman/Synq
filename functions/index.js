const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const {
  onDocumentCreated,
  onDocumentUpdated,
  onDocumentWritten,
} = require("firebase-functions/v2/firestore");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require("axios");
const admin = require("firebase-admin");
const { logError, logWarn, logInfo } = require("./serverLog");
const { registerModerationExports } = require("./moderation");
const { handleUserEventsChange, matchesPlanEvent } = require("./openPlanSync");
const {
  buildSuggestionCacheKey,
  readSuggestionListCache,
  writeSuggestionListCache,
  readVenueCache,
  writeVenueCache,
} = require("./synqSuggestionsCache");

if (admin.apps.length === 0) {
    admin.initializeApp();
}

async function deleteCollectionInChunks(db, colRef, chunkSize = 400) {
  while (true) {
    const snap = await colRef.limit(chunkSize).get();
    if (snap.empty) break;

    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

const INVITE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const INVITE_CODE_LENGTH = 7;

function randomInviteCode(length = INVITE_CODE_LENGTH) {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    const idx = Math.floor(Math.random() * INVITE_CODE_ALPHABET.length);
    out += INVITE_CODE_ALPHABET[idx];
  }
  return out;
}

async function reserveUniqueInviteCode(db, maxAttempts = 25) {
  for (let i = 0; i < maxAttempts; i += 1) {
    const code = randomInviteCode();
    const snap = await db
      .collection("users")
      .where("inviteCode", "==", code)
      .limit(1)
      .get();
    if (snap.empty) return code;
  }
  throw new HttpsError("resource-exhausted", "Could not reserve invite code.");
}

async function friendIdForInviteCode(db, rawCode) {
  const code = String(rawCode || "").trim().toUpperCase();
  if (!code) return null;
  const snap = await db
    .collection("users")
    .where("inviteCode", "==", code)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return snap.docs[0].id;
}

/**
 * Expo push tokens identify a device+install, not a user. If two accounts log in on
 * the same phone, both user docs can end up with the same token — then "notify the
 * recipient" delivers to the sender's device. When a user saves a token, remove it
 * from every other profile so only one uid owns it.
 */
exports.onUserPushTokenWrite = onDocumentWritten(
  {
    document: "users/{userId}",
    region: "us-central1",
  },
  async (event) => {
    const userId = event.params.userId;
    const after = event.data.after?.exists ? event.data.after.data() : null;
    const token = after?.pushToken;
    if (!token || typeof token !== "string") return;

    try {
      const dupes = await admin
        .firestore()
        .collection("users")
        .where("pushToken", "==", token)
        .get();

      if (dupes.size <= 1) return;

      const batch = admin.firestore().batch();
      let cleared = 0;
      dupes.docs.forEach((d) => {
        if (d.id !== userId) {
          batch.update(d.ref, {
            pushToken: admin.firestore.FieldValue.delete(),
          });
          cleared += 1;
        }
      });
      if (cleared > 0) {
        await batch.commit();
        logInfo("onUserPushTokenWrite_cleared_dupes", {
          userId,
          cleared,
        });
      }
    } catch (e) {
      logError("onUserPushTokenWrite", e, { userId });
    }
  }
);

const moderation = registerModerationExports();
exports.filterMessageOnCreate = moderation.filterMessageOnCreate;
exports.submitReport = moderation.submitReport;
exports.blockUser = moderation.blockUser;
exports.unblockUser = moderation.unblockUser;
exports.moderateContent = moderation.moderateContent;
exports.checkOpenModerationReports = moderation.checkOpenModerationReports;

exports.onMessageSent = onDocumentCreated({
    document: "chats/{chatId}/messages/{messageId}",
    region: "us-central1"
}, async (event) => {
    const messageSnapshot = event.data;
    if (!messageSnapshot) return;
    const messageData = messageSnapshot.data();
    const { chatId } = event.params;

    try {
        const chatDoc = await admin.firestore().collection("chats").doc(chatId).get();
        if (!chatDoc.exists) return;

        const chatData = chatDoc.data();
        const senderId = String(messageData.senderId ?? "").trim();
        if (!senderId) {
            logWarn("onMessageSent_missing_senderId", { chatId });
            return;
        }

        const recipientIds = [
            ...new Set(
                (chatData.participants || [])
                    .map((id) => String(id ?? "").trim())
                    .filter((id) => id && id !== senderId)
            ),
        ];

        const senderDoc = await admin.firestore().collection("users").doc(senderId).get();
        const senderPushToken = senderDoc.data()?.pushToken || null;

        /** One Expo push per device token per invocation (duplicate UIDs or stale same-token rows). */
        const sentTokens = new Set();

        for (const recipientId of recipientIds) {
            const userDoc = await admin.firestore().collection("users").doc(recipientId).get();
            const userData = userDoc.data();
            const token = userData?.pushToken;

            if (!token) continue;

            if (senderPushToken && token === senderPushToken) {
                logWarn("onMessageSent_skip_same_device_token", {
                    chatId,
                    recipientId,
                });
                continue;
            }

            if (sentTokens.has(token)) {
                logInfo("onMessageSent_skip_duplicate_token", {
                    chatId,
                    recipientId,
                });
                continue;
            }
            sentTokens.add(token);

            const senderName =
                chatData.participantNames?.[senderId] ||
                chatData.participantNames?.[messageData.senderId] ||
                "New Message";
            await axios.post("https://exp.host/--/api/v2/push/send", {
                to: token,
                sound: "default",
                title: senderName,
                body: messageData.text,
                data: {
                    chatId: String(chatId),
                    messageId: String(event.params.messageId ?? ""),
                    type: "message",
                },
            });
        }
    } catch (error) {
        logError("onMessageSent", error, { chatId });
    }
});

/** Notify the message author when someone else hearts their message. */
exports.onMessageReaction = onDocumentUpdated(
  {
    document: "chats/{chatId}/messages/{messageId}",
    region: "us-central1",
  },
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    if (!after) return;

    const { chatId, messageId } = event.params;
    const beforeR = (before && before.reactions) || {};
    const afterR = after.reactions || {};

    const senderId = String(after.senderId ?? "").trim();
    if (!senderId) return;

    const newHeartUserIds = Object.keys(afterR).filter(
      (uid) => afterR[uid] === "heart" && beforeR[uid] !== "heart"
    );
    if (newHeartUserIds.length === 0) return;

    let chatData = {};
    try {
      const chatDoc = await admin.firestore().collection("chats").doc(chatId).get();
      if (!chatDoc.exists) return;
      chatData = chatDoc.data() || {};
    } catch (e) {
      logError("onMessageReaction_chat_read", e, { chatId });
      return;
    }

    const messageText = String(after.text || "").slice(0, 120);

    for (const reactorId of newHeartUserIds) {
      const rid = String(reactorId || "").trim();
      if (!rid || rid === senderId) continue;

      try {
        const authorDoc = await admin.firestore().collection("users").doc(senderId).get();
        const reactorDoc = await admin.firestore().collection("users").doc(rid).get();
        const authorToken = authorDoc.data()?.pushToken;
        if (!authorToken) continue;

        const reactorToken = reactorDoc.data()?.pushToken || null;
        if (reactorToken && authorToken === reactorToken) {
          logWarn("onMessageReaction_skip_same_device_token", {
            chatId,
            messageId,
          });
          continue;
        }

        let reactorName =
          chatData.participantNames?.[rid] ||
          reactorDoc.data()?.displayName ||
          "Someone";
        reactorName = String(reactorName).trim() || "Someone";

        const body = messageText
          ? `${reactorName} liked: ${messageText}${messageText.length >= 120 ? "…" : ""}`
          : `${reactorName} liked your message`;

        await axios.post("https://exp.host/--/api/v2/push/send", {
          to: authorToken,
          sound: "default",
          title: `${reactorName} liked your message`,
          body,
          data: {
            type: "message_reaction",
            chatId: String(chatId),
            messageId: String(messageId),
          },
        });
      } catch (err) {
        logError("onMessageReaction_push", err, { chatId, messageId });
      }
    }
  }
);

exports.deleteMyAccount = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Must be logged in.");
    }
    const uid = request.auth.uid;
    const db = admin.firestore();

    try {
      const myFriendsRef = db.collection("users").doc(uid).collection("friends");
      const myFriendsSnap = await myFriendsRef.get();
      const friendIds = myFriendsSnap.docs.map((d) => d.id);

      for (let i = 0; i < friendIds.length; i += 400) {
        const chunk = friendIds.slice(i, i + 400);
        const batch = db.batch();

        chunk.forEach((fid) => {
          batch.delete(db.collection("users").doc(fid).collection("friends").doc(uid));
          batch.delete(db.collection("users").doc(uid).collection("friends").doc(fid));
        });

        await batch.commit();
      }

      const chatsSnap = await db
        .collection("chats")
        .where("participants", "array-contains", uid)
        .get();

      for (const chatDoc of chatsSnap.docs) {
        const chatId = chatDoc.id;
        const msgsRef = db.collection("chats").doc(chatId).collection("messages");
        await deleteCollectionInChunks(db, msgsRef, 400);
        await db.collection("chats").doc(chatId).delete();
      }
      await deleteCollectionInChunks(db, db.collection("users").doc(uid).collection("friendRequests"), 400);
      await deleteCollectionInChunks(db, db.collection("users").doc(uid).collection("outgoingFriendRequests"), 400);
      await deleteCollectionInChunks(db, db.collection("users").doc(uid).collection("notificationLocks"), 400);
      await deleteCollectionInChunks(db, db.collection("users").doc(uid).collection("notifications"), 400);
      await deleteCollectionInChunks(db, db.collection("users").doc(uid).collection("friendGroups"), 400);
      await db.collection("users").doc(uid).delete();
      await admin.auth().deleteUser(uid);

      return { ok: true };
    } catch (error) {
      logError("deleteMyAccount", error, { uid });
      throw new HttpsError("internal", error?.message || "Failed to delete account.");
    }
  }
);

exports.deleteChat = onCall(
  { region: "us-central1", invoker: "public" },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Must be logged in.");
    }
    const uid = request.auth.uid;
    const chatId = request.data?.chatId;
    if (!chatId || typeof chatId !== "string") {
      throw new HttpsError("invalid-argument", "Invalid chat id.");
    }

    const db = admin.firestore();
    const chatRef = db.collection("chats").doc(chatId);

    try {
      const chatSnap = await chatRef.get();
      if (!chatSnap.exists) {
        throw new HttpsError("not-found", "Chat not found.");
      }

      const participants = Array.isArray(chatSnap.data()?.participants)
        ? chatSnap.data().participants.filter(Boolean)
        : [];
      if (!participants.includes(uid)) {
        throw new HttpsError("permission-denied", "Not a chat participant.");
      }

      await deleteCollectionInChunks(
        db,
        chatRef.collection("messages"),
        400
      );
      await chatRef.delete();

      await Promise.all(
        participants.map((participantUid) =>
          db
            .collection("users")
            .doc(participantUid)
            .update({
              pinnedChatIds: admin.firestore.FieldValue.arrayRemove(chatId),
            })
            .catch(() => {})
        )
      );

      return { ok: true };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logError("deleteChat", error, { uid, chatId });
      throw new HttpsError("internal", error?.message || "Failed to delete chat.");
    }
  }
);

/** Removes friendship on both sides and clears pending friend requests in both directions. */
exports.removeFriendMutual = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Must be logged in.");
    }
    const uid = request.auth.uid;
    const otherUid = request.data?.otherUid;
    if (!otherUid || typeof otherUid !== "string" || otherUid === uid) {
      throw new HttpsError("invalid-argument", "Invalid friend id.");
    }
    const db = admin.firestore();
    const batch = db.batch();
    batch.delete(db.collection("users").doc(uid).collection("friends").doc(otherUid));
    batch.delete(db.collection("users").doc(otherUid).collection("friends").doc(uid));
    batch.delete(db.collection("users").doc(uid).collection("friendRequests").doc(otherUid));
    batch.delete(db.collection("users").doc(otherUid).collection("friendRequests").doc(uid));
    batch.delete(db.collection("users").doc(uid).collection("outgoingFriendRequests").doc(otherUid));
    batch.delete(db.collection("users").doc(otherUid).collection("outgoingFriendRequests").doc(uid));
    await batch.commit();

    const pruneFriendFromGroups = async (ownerUid, removedFriendId) => {
      const groupsSnap = await db
        .collection("users")
        .doc(ownerUid)
        .collection("friendGroups")
        .get();
      if (groupsSnap.empty) return;

      const pruneBatch = db.batch();
      let pruneWrites = 0;
      groupsSnap.docs.forEach((groupDoc) => {
        const memberIds = Array.isArray(groupDoc.data()?.memberIds)
          ? groupDoc.data().memberIds.map((id) => String(id || "").trim()).filter(Boolean)
          : [];
        if (!memberIds.includes(removedFriendId)) return;
        pruneBatch.update(groupDoc.ref, {
          memberIds: memberIds.filter((id) => id !== removedFriendId),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        pruneWrites += 1;
      });
      if (pruneWrites > 0) {
        await pruneBatch.commit();
      }
    };

    await Promise.all([
      pruneFriendFromGroups(uid, otherUid),
      pruneFriendFromGroups(otherUid, uid),
    ]);

    return { ok: true };
  }
);

/** Returns current user's invite code; creates one if missing. */
exports.getOrCreateInviteCode = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Must be logged in.");
    }
    const uid = String(request.auth.uid || "").trim();
    const db = admin.firestore();
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      throw new HttpsError("failed-precondition", "User profile not found.");
    }
    const existing = String(userSnap.data()?.inviteCode || "").trim().toUpperCase();
    if (existing) {
      return { inviteCode: existing };
    }
    const inviteCode = await reserveUniqueInviteCode(db);
    await userRef.set(
      {
        inviteCode,
        inviteCodeCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return { inviteCode };
  }
);

/** Public lookup for masked profile share links (`/u/{inviteCode}`). */
exports.resolveProfileShareCodeHttp = onRequest(
  { region: "us-central1", cors: true },
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }
    const code = String(req.query.code || "").trim().toUpperCase();
    if (!code) {
      res.status(400).json({ error: "invalid_code" });
      return;
    }
    try {
      const friendId = await friendIdForInviteCode(admin.firestore(), code);
      if (!friendId) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      res.status(200).json({ friendId, inviteCode: code });
    } catch (e) {
      logError("resolveProfileShareCodeHttp", e, { code });
      res.status(500).json({ error: "internal" });
    }
  }
);

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function extractProfileShareCodeFromPath(pathname) {
  const match = String(pathname || "").match(/\/u\/([^/?#]+)/i);
  return match ? decodeURIComponent(match[1] || "").trim().toUpperCase() : "";
}

async function profileShareCardImageUrl(friendId) {
  const bucket = admin.storage().bucket();
  const objectPath = `profileShareCards/${friendId}/card.png`;
  const file = bucket.file(objectPath);
  const [exists] = await file.exists();
  if (!exists) return "";
  const [metadata] = await file.getMetadata();
  const token = metadata.metadata?.firebaseStorageDownloadTokens;
  if (typeof token === "string" && token.trim()) {
    return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(objectPath)}?alt=media&token=${encodeURIComponent(token.trim())}`;
  }
  const [signedUrl] = await file.getSignedUrl({
    action: "read",
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });
  return signedUrl || "";
}

/** HTML landing page for /u/{inviteCode} with Open Graph card preview. */
exports.profileSharePageHttp = onRequest(
  { region: "us-central1" },
  async (req, res) => {
    const code = extractProfileShareCodeFromPath(req.path);
    if (!code) {
      res.status(404).send("Not found");
      return;
    }

    try {
      const db = admin.firestore();
      const friendId = await friendIdForInviteCode(db, code);
      if (!friendId) {
        res.status(404).send("This profile link is no longer available.");
        return;
      }

      let ogImage = "";
      try {
        ogImage = await profileShareCardImageUrl(friendId);
      } catch (e) {
        logError("profileSharePageHttp_card_image", e, { friendId, code });
      }

      const deepLink = `synq://friend-profile?friendId=${encodeURIComponent(friendId)}`;
      const iosStore =
        "https://apps.apple.com/us/app/synq-see-whos-free/id6757319173";
      const androidStore =
        "https://play.google.com/store/search?q=Synq&c=apps";
      const ogImageTag = ogImage
        ? `<meta property="og:image" content="${escapeHtml(ogImage)}" />`
        : "";

      res.set("Cache-Control", "public, max-age=60");
      res.status(200).send(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Join me on Synq!</title>
    <meta property="og:title" content="Join me on Synq!" />
    <meta property="og:description" content="Connect with me on Synq." />
    <meta property="og:type" content="website" />
    ${ogImageTag}
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        background: #090a0b;
        color: #f5f5f5;
        text-align: center;
        padding: 24px;
      }
      a { color: #7c5cff; }
    </style>
  </head>
  <body>
    <div>
      <p>Opening Synq…</p>
      <p><a id="store-link" href="#">Get Synq in the app store</a></p>
    </div>
    <script>
      (function () {
        var deepLink = ${JSON.stringify(deepLink)};
        var iosStore = ${JSON.stringify(iosStore)};
        var androidStore = ${JSON.stringify(androidStore)};
        var ua = navigator.userAgent || "";
        var isIOS = /iPad|iPhone|iPod/i.test(ua);
        var isAndroid = /Android/i.test(ua);
        var storeUrl = isIOS ? iosStore : isAndroid ? androidStore : iosStore;
        var storeLink = document.getElementById("store-link");
        if (storeLink) storeLink.href = storeUrl;
        window.location.replace(deepLink);
        window.setTimeout(function () {
          window.location.replace(storeUrl);
        }, 1200);
      })();
    </script>
  </body>
</html>`);
    } catch (e) {
      logError("profileSharePageHttp", e, { code });
      res.status(500).send("Something went wrong.");
    }
  }
);

function normalizeSearchText(str) {
  return String(str || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function publicUserFields(doc) {
  const data = doc.data() || {};
  return {
    id: doc.id,
    displayName: data.displayName || "User",
    imageurl: data.imageurl || null,
    firstName: data.firstName || "",
    lastName: data.lastName || "",
    email: data.email || null,
  };
}

/** Friend discovery search (server-side; clients cannot list /users). */
exports.searchUsersForFriend = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Must be logged in.");
    }
    const myId = String(request.auth.uid || "").trim();
    const query = normalizeSearchText(request.data?.query);
    if (!query) {
      return { users: [] };
    }

    const db = admin.firestore();
    const myFriendsSnap = await db
      .collection("users")
      .doc(myId)
      .collection("friends")
      .get();
    const exclude = new Set(myFriendsSnap.docs.map((d) => d.id));
    exclude.add(myId);

    const usersSnap = await db.collection("users").get();
    const users = [];

    for (const userDoc of usersSnap.docs) {
      if (exclude.has(userDoc.id)) continue;
      const fields = publicUserFields(userDoc);
      const displayName = normalizeSearchText(fields.displayName);
      const fullName = normalizeSearchText(
        `${fields.firstName} ${fields.lastName}`
      );
      const email = normalizeSearchText(fields.email);
      const matches =
        displayName.includes(query) ||
        fullName.includes(query) ||
        email.includes(query);
      if (!matches) continue;
      users.push({
        id: fields.id,
        displayName: fields.displayName,
        imageurl: fields.imageurl,
        email: fields.email,
      });
      if (users.length >= 30) break;
    }

    return { users };
  }
);

/** People-you-may-know via mutual friends (server-side). */
exports.getSuggestedFriends = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Must be logged in.");
    }
    const myId = String(request.auth.uid || "").trim();
    const db = admin.firestore();

    const myFriendsSnap = await db
      .collection("users")
      .doc(myId)
      .collection("friends")
      .get();
    const myFriendIds = myFriendsSnap.docs.map((d) => d.id);
    const exclude = new Set([...myFriendIds, myId]);
    const mutualCounts = new Map();

    await Promise.all(
      myFriendIds.map(async (friendId) => {
        const theirFriendsSnap = await db
          .collection("users")
          .doc(friendId)
          .collection("friends")
          .get();
        theirFriendsSnap.docs.forEach((d) => {
          const uid = d.id;
          if (exclude.has(uid)) return;
          mutualCounts.set(uid, (mutualCounts.get(uid) || 0) + 1);
        });
      })
    );

    const ranked = [...mutualCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    const users = (
      await Promise.all(
        ranked.map(async ([uid, mutualCount]) => {
          const snap = await db.collection("users").doc(uid).get();
          if (!snap.exists) return null;
          const fields = publicUserFields(snap);
          return {
            id: fields.id,
            displayName: fields.displayName,
            imageurl: fields.imageurl,
            mutualCount,
          };
        })
      )
    ).filter(Boolean);

    return { users };
  }
);

/** Accepts invite-link attribution and creates a safe friend request to inviter. */
exports.acceptInviteFromLink = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Must be logged in.");
    }
    const toUid = String(request.auth.uid || "").trim();
    const fromUidInput = String(request.data?.fromUid || "").trim();
    const inviteCode = String(request.data?.inviteCode || "")
      .trim()
      .toUpperCase();

    const db = admin.firestore();
    let fromUid = fromUidInput;
    if (!fromUid) {
      if (!inviteCode) {
        throw new HttpsError("invalid-argument", "Missing inviter id or invite code.");
      }
      const inviterByCodeSnap = await db
        .collection("users")
        .where("inviteCode", "==", inviteCode)
        .limit(1)
        .get();
      if (inviterByCodeSnap.empty) {
        throw new HttpsError("failed-precondition", "Invite code no longer exists.");
      }
      fromUid = inviterByCodeSnap.docs[0].id;
    }
    if (fromUid === toUid) {
      throw new HttpsError("invalid-argument", "Cannot invite yourself.");
    }

    const inviterRef = db.collection("users").doc(fromUid);
    const recipientRef = db.collection("users").doc(toUid);
    const recipientToInviterReqRef = inviterRef.collection("friendRequests").doc(toUid);
    const inviterToRecipientReqRef = recipientRef.collection("friendRequests").doc(fromUid);
    const inviterFriendRef = inviterRef.collection("friends").doc(toUid);
    const recipientFriendRef = recipientRef.collection("friends").doc(fromUid);
    const inviteLogRef = db.collection("invites").doc(`${fromUid}_${toUid}`);

    const [
      inviterSnap,
      recipientSnap,
      recipientToInviterReqSnap,
      inviterToRecipientReqSnap,
      inviterFriendSnap,
      recipientFriendSnap,
    ] = await Promise.all([
      inviterRef.get(),
      recipientRef.get(),
      recipientToInviterReqRef.get(),
      inviterToRecipientReqRef.get(),
      inviterFriendRef.get(),
      recipientFriendRef.get(),
    ]);

    if (!inviterSnap.exists) {
      throw new HttpsError("failed-precondition", "Inviter no longer exists.");
    }
    if (!recipientSnap.exists) {
      throw new HttpsError("failed-precondition", "Recipient profile missing.");
    }

    const alreadyFriends = inviterFriendSnap.exists || recipientFriendSnap.exists;
    if (alreadyFriends) {
      await inviteLogRef.set(
        {
          fromUid,
          toUid,
          inviteCode: inviteCode || null,
          status: "already_friends",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return { ok: true, status: "already_friends" };
    }

    if (recipientToInviterReqSnap.exists || inviterToRecipientReqSnap.exists) {
      await inviteLogRef.set(
        {
          fromUid,
          toUid,
          inviteCode: inviteCode || null,
          status: "request_exists",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return { ok: true, status: "request_exists" };
    }

    const recipientData = recipientSnap.data() || {};
    const senderName = String(
      recipientData.displayName || request.auth.token.name || "Someone"
    ).trim() || "Someone";
    const senderImageUrl =
      typeof recipientData.imageurl === "string" ? recipientData.imageurl : null;

    const batch = db.batch();
    batch.set(recipientToInviterReqRef, {
      from: toUid,
      to: fromUid,
      senderName,
      senderImageUrl,
      source: "invite_link",
      status: "pending",
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    batch.set(
      inviteLogRef,
      {
        fromUid,
        toUid,
        inviteCode: inviteCode || null,
        status: "request_created",
        source: "invite_link",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    await batch.commit();
    return { ok: true, status: "request_created" };
  }
);

exports.onFriendRequestSent = onDocumentCreated({
    document: "users/{userId}/friendRequests/{requestId}",
    region: "us-central1"
}, async (event) => {
    const requestData = event.data.data();
    const { userId, requestId } = event.params;

    try {
        const recipientDoc = await admin.firestore().collection("users").doc(userId).get();
        const recipientData = recipientDoc.data();
        const senderDoc = await admin.firestore().collection("users").doc(requestId).get();
        const senderPushToken = senderDoc.data()?.pushToken || null;

        const token = recipientData?.pushToken;
        if (!token) return;

        if (senderPushToken && token === senderPushToken) {
            logWarn("onFriendRequestSent_skip_same_device_token", {
                userId,
                requestId,
            });
            return;
        }

        const senderName = requestData.senderName || "A user";

        await axios.post("https://exp.host/--/api/v2/push/send", {
            to: token,
            sound: "default",
            title: "New Friend Request 🤝",
            body: `${senderName} wants to Synq with you!`,
            data: {
                type: "friend_request",
                fromUserId: String(requestId),
            },
        });
    } catch (error) {
        logError("onFriendRequestSent", error, { userId, requestId });
    }
});

exports.onCommunityGroupInviteCreated = onDocumentCreated({
    document: "users/{userId}/communityGroupInvites/{groupId}",
    region: "us-central1",
}, async (event) => {
    const inviteData = event.data?.data();
    if (!inviteData) return;

    const { userId, groupId } = event.params;

    try {
        const recipientDoc = await admin.firestore().collection("users").doc(userId).get();
        const recipientData = recipientDoc.data();
        const token = recipientData?.pushToken;
        if (!token) return;

        const inviterId = String(inviteData.fromUserId || "").trim();
        let inviterPushToken = null;
        if (inviterId) {
            const inviterDoc = await admin.firestore().collection("users").doc(inviterId).get();
            inviterPushToken = inviterDoc.data()?.pushToken || null;
        }

        if (inviterPushToken && token === inviterPushToken) {
            logWarn("onCommunityGroupInviteCreated_skip_same_device_token", {
                userId,
                groupId,
                inviterId,
            });
            return;
        }

        const inviterName =
            String(inviteData.fromUserName || "").trim() || "A friend";
        const groupName =
            String(inviteData.groupName || "").trim() || "a community group";

        await axios.post("https://exp.host/--/api/v2/push/send", {
            to: token,
            sound: "default",
            title: "Group invite",
            body: `${inviterName} invited you to join ${groupName}`,
            data: {
                type: "community_group_invite",
                groupId: String(groupId),
                fromUserId: inviterId || undefined,
            },
        });
    } catch (error) {
        logError("onCommunityGroupInviteCreated", error, { userId, groupId });
    }
});

function collectInvitedIds(e) {
  const ids = new Set();
  if (Array.isArray(e?.planInvitedIds)) {
    e.planInvitedIds.forEach((id) => {
      const s = String(id || "").trim();
      if (s) ids.add(s);
    });
  }
  return ids;
}

function collectJoinedIds(e) {
  const ids = new Set();
  if (Array.isArray(e?.joinedFromIds)) {
    e.joinedFromIds.forEach((id) => {
      const s = String(id || "").trim();
      if (s) ids.add(s);
    });
  }
  const j = String(e?.joinedFromId || "").trim();
  if (j) ids.add(j);
  return ids;
}

function eventMatchKey(e) {
  return `${String(e?.title || "").trim().toLowerCase()}|${String(e?.date || "").trim()}`;
}

function findBeforeEvent(beforeEvents, afterEvent) {
  const aid = String(afterEvent?.id || "").trim();
  if (aid) {
    const b = beforeEvents.find((x) => String(x?.id || "").trim() === aid);
    if (b) return b;
  }
  const k = eventMatchKey(afterEvent);
  return beforeEvents.find((x) => eventMatchKey(x) === k);
}

function firstNameFromDisplay(name) {
  return String(name || "").trim().split(/\s+/)[0] || "Someone";
}

/** Persists an in-app notification for the notifications screen (admin-only writes). */
async function writeInAppNotification(recipientUid, docId, fields) {
  const notifRef = admin
    .firestore()
    .collection("users")
    .doc(recipientUid)
    .collection("notifications")
    .doc(docId);
  await notifRef.set(
    {
      ...fields,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

function friendSynqActiveNotifId(activatedUserId, recipientId) {
  return `synq_active_${activatedUserId}_${recipientId}`.slice(0, 1400);
}

/** Removes "friend activated Synq" in-app notifications when that friend goes inactive. */
async function clearFriendSynqActiveNotifications(activatedUserId, recipientIds) {
  const db = admin.firestore();
  for (const recipientId of recipientIds) {
    try {
      const notifCol = db.collection("users").doc(recipientId).collection("notifications");
      const canonicalId = friendSynqActiveNotifId(activatedUserId, recipientId);
      await notifCol.doc(canonicalId).delete().catch(() => {});

      const legacySnap = await notifCol.where("fromUserId", "==", activatedUserId).get();
      if (legacySnap.empty) continue;

      let batch = db.batch();
      let n = 0;
      for (const doc of legacySnap.docs) {
        if (doc.data()?.type !== "friend_synq_active") continue;
        if (doc.id === canonicalId) continue;
        batch.delete(doc.ref);
        n += 1;
        if (n >= 500) {
          await batch.commit();
          batch = db.batch();
          n = 0;
        }
      }
      if (n > 0) await batch.commit();
    } catch (err) {
      logError("clearFriendSynqActiveNotifications", err, {
        activatedUserId,
        recipientId,
      });
    }
  }
}

/** Must match app `EXPIRATION_HOURS` in constants/Variables.ts */
const SYNQ_EXPIRATION_HOURS = 12;
const SYNQ_EXPIRATION_MS = SYNQ_EXPIRATION_HOURS * 60 * 60 * 1000;

function synqStartedAtMillis(userData) {
  const t = userData?.synqStartedAt;
  if (!t) return null;
  if (typeof t.toMillis === "function") return t.toMillis();
  if (typeof t._seconds === "number") return t._seconds * 1000;
  return null;
}

function isSynqActive(userData) {
  if (!userData || typeof userData !== "object") return false;
  if (String(userData.status || "").trim().toLowerCase() !== "available") return false;
  const ms = synqStartedAtMillis(userData);
  if (ms == null) return false;
  return Date.now() - ms <= SYNQ_EXPIRATION_MS;
}

const { isRecipientInSynqVisibleTo } = require("./synqBroadcastCore");

const synqBroadcastClearFields = {
  synqBroadcastMode: admin.firestore.FieldValue.delete(),
  synqBroadcastGroupIds: admin.firestore.FieldValue.delete(),
  synqVisibleTo: admin.firestore.FieldValue.delete(),
};

/**
 * Deactivates Synq for users past the window (server-side, no app open required).
 * Also clears legacy rows that are still `available` but missing `synqStartedAt`.
 */
exports.expireStaleSynq = onSchedule(
  {
    schedule: "every 60 minutes",
    region: "us-central1",
    timeZone: "Etc/UTC",
  },
  async () => {
    const db = admin.firestore();
    const cutoffTs = admin.firestore.Timestamp.fromMillis(Date.now() - SYNQ_EXPIRATION_MS);
    const deactivatePayload = {
      status: "inactive",
      memo: "",
      ...synqBroadcastClearFields,
    };

    try {
      const expiredByTime = await db
        .collection("users")
        .where("status", "==", "available")
        .where("synqStartedAt", "<", cutoffTs)
        .get();

      if (!expiredByTime.empty) {
        let batch = db.batch();
        let n = 0;
        for (const doc of expiredByTime.docs) {
          batch.update(doc.ref, deactivatePayload);
          n += 1;
          if (n >= 500) {
            await batch.commit();
            batch = db.batch();
            n = 0;
          }
        }
        if (n > 0) await batch.commit();
        logInfo("expireStaleSynq_by_age", {
          count: expiredByTime.size,
        });
      }

      const FieldPath = admin.firestore.FieldPath;
      let lastDoc = null;
      let legacyTotal = 0;
      let reads = 0;
      const maxLegacyReads = 8000;

      while (reads < maxLegacyReads) {
        let q = db
          .collection("users")
          .where("status", "==", "available")
          .orderBy(FieldPath.documentId())
          .limit(500);
        if (lastDoc) q = q.startAfter(lastDoc);
        const page = await q.get();
        if (page.empty) break;
        reads += page.size;

        const refs = page.docs.filter((d) => !d.data().synqStartedAt).map((d) => d.ref);
        if (refs.length) {
          let lb = db.batch();
          let c = 0;
          for (const ref of refs) {
            lb.update(ref, deactivatePayload);
            legacyTotal += 1;
            c += 1;
            if (c >= 500) {
              await lb.commit();
              lb = db.batch();
              c = 0;
            }
          }
          if (c > 0) await lb.commit();
        }

        lastDoc = page.docs[page.docs.length - 1];
        if (page.size < 500) break;
      }

      if (legacyTotal) {
        logInfo("expireStaleSynq_legacy_missing_started_at", {
          count: legacyTotal,
        });
      }
    } catch (e) {
      logError("expireStaleSynq", e, {});
    }
  }
);

/**
 * Propagate open-plan interest to hosts and cascade plan deletions to interested friends.
 * Clients cannot write other users' calendars (firestore.rules); this runs with admin access.
 */
exports.syncOpenPlanEvents = onDocumentUpdated(
  {
    document: "users/{userId}",
    region: "us-central1",
  },
  async (event) => {
    const userId = event.params.userId;
    const before = event.data.before.data() || {};
    const after = event.data.after.data() || {};
    const beforeEvents = Array.isArray(before.events) ? before.events : [];
    const afterEvents = Array.isArray(after.events) ? after.events : [];

    try {
      await handleUserEventsChange(admin.firestore(), userId, beforeEvents, afterEvents);
    } catch (e) {
      logError("syncOpenPlanEvents", e, { userId });
    }
  }
);

/** When a friend’s id is added to a hosted open plan, notify the host. */
exports.onOpenPlanInterest = onDocumentUpdated(
  {
    document: "users/{userId}",
    region: "us-central1",
  },
  async (event) => {
    const hostUid = event.params.userId;
    const before = event.data.before.data() || {};
    const after = event.data.after.data() || {};
    const beforeEvents = Array.isArray(before.events) ? before.events : [];
    const afterEvents = Array.isArray(after.events) ? after.events : [];

    const hostDocRef = admin.firestore().collection("users").doc(hostUid);
    let hostPushToken = after.pushToken;
    if (!hostPushToken) {
      try {
        const snap = await hostDocRef.get();
        hostPushToken = snap.data()?.pushToken;
      } catch (e) {
        logError("onOpenPlanInterest_host_token", e, { hostUid });
        return;
      }
    }
    if (!hostPushToken) return;

    for (const ev of afterEvents) {
      if (String(ev?.planHostUid || "").trim() !== hostUid) continue;

      const beforeEv = findBeforeEvent(beforeEvents, ev);
      const beforeIds = beforeEv ? collectJoinedIds(beforeEv) : new Set();
      const afterIds = collectJoinedIds(ev);

      for (const joinerId of afterIds) {
        if (joinerId === hostUid) continue;
        if (beforeIds.has(joinerId)) continue;

        const eventId = String(ev?.id || eventMatchKey(ev)).replace(/[/\s]/g, "_");
        const lockId = `plan_interest_${hostUid}_${joinerId}_${eventId}`.slice(0, 1400);
        const lockRef = hostDocRef.collection("notificationLocks").doc(lockId);

        const alreadySent = await lockRef.get();
        if (alreadySent.exists) continue;

        let joinerName = "Someone";
        let joinerPushToken = null;
        try {
          const joinerDoc = await admin.firestore().collection("users").doc(joinerId).get();
          if (joinerDoc.exists) {
            const jd = joinerDoc.data();
            joinerName = jd?.displayName || joinerName;
            joinerPushToken = jd?.pushToken || null;
          }
        } catch (e) {
          logError("onOpenPlanInterest_joiner_profile", e, { hostUid, joinerId });
        }

        const planTitle = String(ev?.title || "").trim();
        const body = planTitle
          ? `${firstNameFromDisplay(joinerName)} is going to ${planTitle}`
          : `${firstNameFromDisplay(joinerName)} is going to your plan`;

        const eventIdForClient =
          String(ev?.id || "").trim() ||
          String(eventMatchKey(ev)).replace(/[/\s]/g, "_");

        if (joinerPushToken && hostPushToken === joinerPushToken) {
          logWarn("onOpenPlanInterest_skip_same_device_token", {
            hostUid,
            joinerId,
          });
          continue;
        }

        try {
          await axios.post("https://exp.host/--/api/v2/push/send", {
            to: hostPushToken,
            sound: "default",
            title: "Open plan",
            body,
            data: {
              type: "open_plan_interest",
              planHostUid: hostUid,
              fromUserId: joinerId,
              eventId: eventIdForClient,
              notificationId: lockId,
            },
          });
          await lockRef.set({
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            type: "open_plan_interest",
            joinerId,
            planTitle: planTitle || null,
          });
          await writeInAppNotification(hostUid, lockId, {
            type: "open_plan_interest",
            fromUserId: joinerId,
            eventId: eventIdForClient,
            planHostUid: hostUid,
            planTitle: planTitle || null,
            title: "Open plan",
            body,
          });
        } catch (error) {
          logError("onOpenPlanInterest_push", error, { hostUid, joinerId });
        }
      }
    }
  }
);

/** When someone joins a community plan, notify the creator and other goers. */
exports.onCommunityPlanGoing = onDocumentUpdated(
  {
    document: "communityGroups/{groupId}/plans/{planId}",
    region: "us-central1",
  },
  async (event) => {
    const { groupId, planId } = event.params;
    const before = event.data.before.data() || {};
    const after = event.data.after.data() || {};
    const beforeIds = new Set(
      (Array.isArray(before.goingMemberIds) ? before.goingMemberIds : [])
        .map((id) => String(id || "").trim())
        .filter(Boolean)
    );
    const afterIds = (Array.isArray(after.goingMemberIds) ? after.goingMemberIds : [])
      .map((id) => String(id || "").trim())
      .filter(Boolean);
    const newJoiners = afterIds.filter((id) => !beforeIds.has(id));
    if (newJoiners.length === 0) return;

    const creatorId = String(after.creatorId || before.creatorId || "").trim();
    const planTitle = String(after.title || before.title || "").trim();
    const groupName = await admin
      .firestore()
      .collection("communityGroups")
      .doc(groupId)
      .get()
      .then((snap) => (snap.exists ? String(snap.data()?.name || "").trim() : ""))
      .catch(() => "");

    for (const joinerId of newJoiners) {
      let joinerName = "Someone";
      let joinerPushToken = null;
      try {
        const joinerDoc = await admin.firestore().collection("users").doc(joinerId).get();
        if (joinerDoc.exists) {
          const jd = joinerDoc.data();
          joinerName = jd?.displayName || joinerName;
          joinerPushToken = jd?.pushToken || null;
        }
      } catch (e) {
        logError("onCommunityPlanGoing_joiner_profile", e, { groupId, planId, joinerId });
      }

      const recipients = new Set(
        [creatorId, ...afterIds].filter((id) => id && id !== joinerId)
      );

      for (const recipientId of recipients) {
        const lockId =
          `community_plan_join_${groupId}_${planId}_${joinerId}_${recipientId}`.slice(0, 1400);
        const lockRef = admin
          .firestore()
          .collection("users")
          .doc(recipientId)
          .collection("notificationLocks")
          .doc(lockId);
        const alreadySent = await lockRef.get();
        if (alreadySent.exists) continue;

        let recipientPushToken = null;
        try {
          const recipientDoc = await admin.firestore().collection("users").doc(recipientId).get();
          if (recipientDoc.exists) {
            recipientPushToken = recipientDoc.data()?.pushToken || null;
          }
        } catch (e) {
          logError("onCommunityPlanGoing_recipient_profile", e, {
            groupId,
            planId,
            recipientId,
          });
        }

        const title = groupName || "Community plan";
        const body = planTitle
          ? `${firstNameFromDisplay(joinerName)} is in for ${planTitle}`
          : `${firstNameFromDisplay(joinerName)} joined a plan`;

        if (recipientPushToken && joinerPushToken && recipientPushToken === joinerPushToken) {
          logWarn("onCommunityPlanGoing_skip_same_device_token", {
            recipientId,
            joinerId,
          });
          continue;
        }

        if (recipientPushToken) {
          try {
            await axios.post("https://exp.host/--/api/v2/push/send", {
              to: recipientPushToken,
              sound: "default",
              title,
              body,
              data: {
                type: "community_plan_join",
                groupId,
                planId,
                fromUserId: joinerId,
                notificationId: lockId,
              },
            });
          } catch (pushErr) {
            logError("onCommunityPlanGoing_push", pushErr, {
              groupId,
              planId,
              recipientId,
              joinerId,
            });
          }
        }

        try {
          await lockRef.set({
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            type: "community_plan_join",
            groupId,
            planId,
            joinerId,
            planTitle: planTitle || null,
          });
          await writeInAppNotification(recipientId, lockId, {
            type: "community_plan_join",
            groupId,
            planId,
            fromUserId: joinerId,
            planTitle: planTitle || null,
            groupName: groupName || null,
            title,
            body,
          });
        } catch (notifErr) {
          logError("onCommunityPlanGoing_in_app", notifErr, {
            groupId,
            planId,
            recipientId,
            joinerId,
          });
        }
      }
    }
  }
);

exports.onFriendAccepted = onDocumentCreated({
  document: "users/{userId}/friends/{friendId}",
  region: "us-central1",
}, async (event) => {
  const { userId, friendId } = event.params;

  const friendSnap = event.data;
  if (!friendSnap) return;

  const friendDocData = friendSnap.data() || {};

  if (friendDocData.notifyOnCreate !== true) {
    logInfo("onFriendAccepted_skip_no_notify", {
      userId,
      friendId,
    });
    return;
  }

  const notifId = `${userId}_accepted_${friendId}`; 
  const notifRef = admin
    .firestore()
    .collection("users")
    .doc(friendId)
    .collection("notificationLocks")
    .doc(notifId);

  const alreadySent = await notifRef.get();
  if (alreadySent.exists) {
    logInfo("onFriendAccepted_skip_duplicate", { userId, friendId });
    return;
  }

  try {
    const friendUserDoc = await admin.firestore().collection("users").doc(friendId).get();
    const friendUserData = friendUserDoc.data();

    const accepterDoc = await admin.firestore().collection("users").doc(userId).get();
    const accepterData = accepterDoc.data();

    if (!friendUserData?.pushToken) return;

    const accepterToken = accepterData?.pushToken || null;
    if (accepterToken && friendUserData.pushToken === accepterToken) {
      logWarn("onFriendAccepted_skip_same_device_token", {
        userId,
        friendId,
      });
      return;
    }

    await axios.post("https://exp.host/--/api/v2/push/send", {
      to: friendUserData.pushToken,
      sound: "default",
      title: "Request Accepted! ✨",
      body: `${accepterData?.displayName || "A user"} accepted your friend request.`,
      data: { type: "friend_accepted", fromUserId: userId },
    });

    await notifRef.set({
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      from: userId,
      to: friendId,
      type: "friend_accepted",
    });

    await writeInAppNotification(friendId, notifId, {
      type: "friend_accepted",
      fromUserId: userId,
      title: "Request Accepted! ✨",
      body: `${accepterData?.displayName || "A user"} accepted your friend request.`,
    });
  } catch (error) {
    logError("onFriendAccepted", error, { userId, friendId });
  }
});

const SYNQ_NUDGE_COOLDOWN_MS = 4 * 60 * 60 * 1000;

/** Lets an active user ask an inactive friend if they're free. */
exports.sendSynqNudge = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Must be logged in.");
  }

  const callerUid = request.auth.uid;
  const toUserId = String(request.data?.toUserId || "").trim();
  if (!toUserId || toUserId === callerUid) {
    throw new HttpsError("invalid-argument", "Invalid recipient.");
  }

  const db = admin.firestore();
  const friendSnap = await db
    .collection("users")
    .doc(callerUid)
    .collection("friends")
    .doc(toUserId)
    .get();
  if (!friendSnap.exists) {
    throw new HttpsError("permission-denied", "You can only ask friends.");
  }

  const [callerDoc, recipientDoc] = await Promise.all([
    db.collection("users").doc(callerUid).get(),
    db.collection("users").doc(toUserId).get(),
  ]);

  if (!recipientDoc.exists) {
    throw new HttpsError("not-found", "User not found.");
  }

  const callerData = callerDoc.data() || {};
  const recipientData = recipientDoc.data() || {};

  if (!isSynqActive(callerData)) {
    throw new HttpsError("failed-precondition", "Activate Synq first to ask if a friend is free.");
  }

  if (isSynqActive(recipientData)) {
    throw new HttpsError("failed-precondition", "This friend is already active.");
  }

  const lockId = `synq_nudge_${callerUid}_${toUserId}`.slice(0, 1400);
  const lockRef = db.collection("users").doc(toUserId).collection("notificationLocks").doc(lockId);
  const lockSnap = await lockRef.get();
  if (lockSnap.exists) {
    const t = lockSnap.data()?.createdAt;
    let lockMs = null;
    if (t && typeof t.toMillis === "function") lockMs = t.toMillis();
    else if (t && typeof t._seconds === "number") lockMs = t._seconds * 1000;
    if (lockMs != null && Date.now() - lockMs < SYNQ_NUDGE_COOLDOWN_MS) {
      throw new HttpsError(
        "resource-exhausted",
        "You can ask this friend again in a few hours."
      );
    }
  }

  const callerName = String(callerData.displayName || "Your friend").trim() || "Your friend";
  const nudgeBody = `${firstNameFromDisplay(callerName)} wants to know if you're free right now`;
  const recipientToken = recipientData.pushToken || null;
  const callerToken = callerData.pushToken || null;

  if (recipientToken && callerToken && recipientToken === callerToken) {
    logWarn("sendSynqNudge_skip_same_device_token", { callerUid, toUserId });
  } else if (recipientToken) {
    try {
      await axios.post("https://exp.host/--/api/v2/push/send", {
        to: recipientToken,
        sound: "default",
        title: "Are you free?",
        body: nudgeBody,
        data: {
          type: "synq_nudge",
          fromUserId: callerUid,
        },
      });
    } catch (pushErr) {
      logError("sendSynqNudge_push", pushErr, { callerUid, toUserId });
      throw new HttpsError("internal", "Could not send notification.");
    }
  }

  await lockRef.set({
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    type: "synq_nudge",
    fromUserId: callerUid,
  });

  await writeInAppNotification(toUserId, lockId, {
    type: "synq_nudge",
    fromUserId: callerUid,
    title: "Are you free?",
    body: nudgeBody,
  });

  return { ok: true };
});

function planInviteNotifId(hostUid, recipientUid, eventId) {
  const safeEventId = String(eventId || "")
    .trim()
    .replace(/[/\s]/g, "_");
  return `plan_invite_${hostUid}_${recipientUid}_${safeEventId}`.slice(0, 1400);
}

function planInviteBody(hostDisplayName, planTitle) {
  const fn = firstNameFromDisplay(hostDisplayName);
  const title = String(planTitle || "").trim();
  return title
    ? `${fn} wants you to join their plan ${title}`
    : `${fn} wants you to join their plan`;
}

/** Host invites a friend to join one of their open plans. */
exports.sendPlanInvite = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Must be logged in.");
  }

  const hostUid = request.auth.uid;
  const toUserId = String(request.data?.toUserId || "").trim();
  const eventId = String(request.data?.eventId || "").trim();
  if (!toUserId || toUserId === hostUid) {
    throw new HttpsError("invalid-argument", "Invalid recipient.");
  }
  if (!eventId) {
    throw new HttpsError("invalid-argument", "Missing plan id.");
  }

  const db = admin.firestore();
  const friendSnap = await db
    .collection("users")
    .doc(hostUid)
    .collection("friends")
    .doc(toUserId)
    .get();
  if (!friendSnap.exists) {
    throw new HttpsError("permission-denied", "You can only invite friends.");
  }

  const [hostDoc, recipientDoc] = await Promise.all([
    db.collection("users").doc(hostUid).get(),
    db.collection("users").doc(toUserId).get(),
  ]);

  if (!hostDoc.exists) {
    throw new HttpsError("failed-precondition", "Your profile is missing.");
  }
  if (!recipientDoc.exists) {
    throw new HttpsError("not-found", "Friend not found.");
  }

  const hostData = hostDoc.data() || {};
  const recipientData = recipientDoc.data() || {};
  const hostEvents = Array.isArray(hostData.events) ? hostData.events : [];
  const hostPlan = hostEvents.find((e) => String(e?.id || "").trim() === eventId);
  if (!hostPlan) {
    throw new HttpsError("not-found", "Plan not found.");
  }
  if (String(hostPlan?.planHostUid || hostUid).trim() !== hostUid) {
    throw new HttpsError("permission-denied", "You can only invite friends to your own plans.");
  }

  const planTarget = { ...hostPlan, planHostUid: hostUid };
  const recipientEvents = Array.isArray(recipientData.events) ? recipientData.events : [];
  if (recipientEvents.some((e) => matchesPlanEvent(e, planTarget, recipientEvents))) {
    throw new HttpsError("failed-precondition", "This friend already has this plan.");
  }

  const hostJoinedIds = collectJoinedIds(hostPlan);
  if (hostJoinedIds.has(toUserId)) {
    throw new HttpsError("failed-precondition", "This friend is already on this plan.");
  }

  const invitedIds = collectInvitedIds(hostPlan);
  if (invitedIds.has(toUserId)) {
    return { ok: true, alreadyInvited: true };
  }

  const planTitle = String(hostPlan.title || "").trim();
  const hostName = String(hostData.displayName || "Your friend").trim() || "Your friend";
  const body = planInviteBody(hostName, planTitle);
  const notifId = planInviteNotifId(hostUid, toUserId, eventId);
  const recipientToken = recipientData.pushToken || null;
  const hostToken = hostData.pushToken || null;

  if (recipientToken && hostToken && recipientToken === hostToken) {
    logWarn("sendPlanInvite_skip_same_device_token", { hostUid, toUserId });
  } else if (recipientToken) {
    try {
      await axios.post("https://exp.host/--/api/v2/push/send", {
        to: recipientToken,
        sound: "default",
        title: "Plan invite",
        body,
        data: {
          type: "plan_invite",
          fromUserId: hostUid,
          eventId,
          planHostUid: hostUid,
          notificationId: notifId,
        },
      });
    } catch (pushErr) {
      logError("sendPlanInvite_push", pushErr, { hostUid, toUserId, eventId });
    }
  }

  const lockRef = db.collection("users").doc(toUserId).collection("notificationLocks").doc(notifId);
  await lockRef.set({
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    type: "plan_invite",
    fromUserId: hostUid,
    eventId,
    planHostUid: hostUid,
    planTitle: planTitle || null,
  });

  await writeInAppNotification(toUserId, notifId, {
    type: "plan_invite",
    fromUserId: hostUid,
    eventId,
    planHostUid: hostUid,
    planTitle: planTitle || null,
    planDate: String(hostPlan.date || "").trim() || null,
    planTime: String(hostPlan.time || "").trim() || null,
    planLocation: String(hostPlan.location || "").trim() || null,
    title: "Plan invite",
    body,
  });

  const hostRef = db.collection("users").doc(hostUid);
  await db.runTransaction(async (t) => {
    const hostSnap = await t.get(hostRef);
    if (!hostSnap.exists) return;
    const hostDataTx = hostSnap.data() || {};
    const events = Array.isArray(hostDataTx.events) ? [...hostDataTx.events] : [];
    const idx = events.findIndex((e) => String(e?.id || "").trim() === eventId);
    if (idx === -1) return;
    const plan = { ...(events[idx] || {}) };
    const nextInvited = collectInvitedIds(plan);
    nextInvited.add(toUserId);
    plan.planInvitedIds = [...nextInvited];
    events[idx] = plan;
    t.update(hostRef, { events });
  });

  return { ok: true };
});

/** Host revokes a pending plan invite before the friend accepts. */
exports.revokePlanInvite = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Must be logged in.");
  }

  const hostUid = request.auth.uid;
  const toUserId = String(request.data?.toUserId || "").trim();
  const eventId = String(request.data?.eventId || "").trim();
  if (!toUserId || toUserId === hostUid) {
    throw new HttpsError("invalid-argument", "Invalid recipient.");
  }
  if (!eventId) {
    throw new HttpsError("invalid-argument", "Missing plan id.");
  }

  const db = admin.firestore();
  const hostRef = db.collection("users").doc(hostUid);
  const hostSnap = await hostRef.get();
  if (!hostSnap.exists) {
    throw new HttpsError("not-found", "Plan not found.");
  }

  const hostData = hostSnap.data() || {};
  const events = Array.isArray(hostData.events) ? hostData.events : [];
  const planIdx = events.findIndex((e) => String(e?.id || "").trim() === eventId);
  if (planIdx === -1) {
    throw new HttpsError("not-found", "Plan not found.");
  }

  const plan = events[planIdx] || {};
  if (String(plan?.planHostUid || hostUid).trim() !== hostUid) {
    throw new HttpsError("permission-denied", "You can only manage invites on your own plans.");
  }

  const invitedIds = collectInvitedIds(plan);
  if (!invitedIds.has(toUserId)) {
    return { ok: true, alreadyRevoked: true };
  }

  const notifId = planInviteNotifId(hostUid, toUserId, eventId);
  const notifRef = db.collection("users").doc(toUserId).collection("notifications").doc(notifId);
  const lockRef = db.collection("users").doc(toUserId).collection("notificationLocks").doc(notifId);

  await db.runTransaction(async (t) => {
    const snap = await t.get(hostRef);
    if (!snap.exists) return;
    const data = snap.data() || {};
    const evs = Array.isArray(data.events) ? [...data.events] : [];
    const idx = evs.findIndex((e) => String(e?.id || "").trim() === eventId);
    if (idx === -1) return;
    const row = { ...(evs[idx] || {}) };
    const nextInvited = collectInvitedIds(row);
    nextInvited.delete(toUserId);
    row.planInvitedIds = [...nextInvited];
    evs[idx] = row;
    t.update(hostRef, { events: evs });
  });

  await Promise.allSettled([notifRef.delete(), lockRef.delete()]);
  return { ok: true };
});

/** Accept a plan invite and add the plan to the recipient's open plans. */
exports.acceptPlanInvite = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Must be logged in.");
  }

  const recipientUid = request.auth.uid;
  const notificationId = String(request.data?.notificationId || "").trim();
  if (!notificationId) {
    throw new HttpsError("invalid-argument", "Missing invite id.");
  }

  const db = admin.firestore();
  const notifRef = db
    .collection("users")
    .doc(recipientUid)
    .collection("notifications")
    .doc(notificationId);
  const notifSnap = await notifRef.get();
  if (!notifSnap.exists) {
    throw new HttpsError("not-found", "Invite no longer available.");
  }

  const notif = notifSnap.data() || {};
  if (notif.type !== "plan_invite") {
    throw new HttpsError("failed-precondition", "Invalid invite.");
  }

  const hostUid = String(notif.planHostUid || notif.fromUserId || "").trim();
  const eventId = String(notif.eventId || "").trim();
  if (!hostUid || !eventId) {
    throw new HttpsError("failed-precondition", "Invite is missing plan details.");
  }

  const [hostDoc, recipientDoc] = await Promise.all([
    db.collection("users").doc(hostUid).get(),
    db.collection("users").doc(recipientUid).get(),
  ]);

  if (!hostDoc.exists) {
    throw new HttpsError("not-found", "This plan was removed.");
  }
  if (!recipientDoc.exists) {
    throw new HttpsError("failed-precondition", "Your profile is missing.");
  }

  const hostEvents = Array.isArray(hostDoc.data()?.events) ? hostDoc.data().events : [];
  const hostPlan = hostEvents.find((e) => String(e?.id || "").trim() === eventId);
  if (!hostPlan) {
    throw new HttpsError("not-found", "This plan was removed.");
  }

  const hostName = String(hostDoc.data()?.displayName || "Friend").trim() || "Friend";
  const joinerName = String(recipientDoc.data()?.displayName || "Friend").trim() || "Friend";
  const planTarget = { ...hostPlan, planHostUid: hostUid };
  let recipientEvents = Array.isArray(recipientDoc.data()?.events)
    ? [...recipientDoc.data().events]
    : [];

  const alreadyJoined = recipientEvents.some((e) =>
    matchesPlanEvent(e, planTarget, recipientEvents)
  );

  if (!alreadyJoined) {
    const sourceIds = Array.from(
      new Set([hostUid, recipientUid, ...collectJoinedIds(hostPlan)].map(String).filter(Boolean))
    );
    const sourceNames = Array.from(new Set([hostName, joinerName].filter(Boolean)));

    const newEvent = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: String(hostPlan.title || "").trim(),
      date: String(hostPlan.date || "").trim(),
      time: String(hostPlan.time || "").trim(),
      location: String(hostPlan.location || "").trim(),
      planHostUid: hostUid,
      joinedFromId: hostUid,
      joinedFromIds: sourceIds,
      joinedFromName: sourceNames.join(", "),
      joinedFromNames: sourceNames,
      mergedIntoExisting: false,
      joinedFromFriendUid: hostUid,
    };

    recipientEvents = [...recipientEvents, newEvent];
    await db.collection("users").doc(recipientUid).update({ events: recipientEvents });
  }

  const batch = db.batch();
  batch.delete(notifRef);
  batch.delete(
    db.collection("users").doc(recipientUid).collection("notificationLocks").doc(notificationId)
  );
  await batch.commit();

  const hostRef = db.collection("users").doc(hostUid);
  await db.runTransaction(async (t) => {
    const snap = await t.get(hostRef);
    if (!snap.exists) return;
    const data = snap.data() || {};
    const evs = Array.isArray(data.events) ? [...data.events] : [];
    const idx = evs.findIndex((e) => String(e?.id || "").trim() === eventId);
    if (idx === -1) return;
    const row = { ...(evs[idx] || {}) };
    const nextInvited = collectInvitedIds(row);
    nextInvited.delete(recipientUid);
    row.planInvitedIds = [...nextInvited];
    evs[idx] = row;
    t.update(hostRef, { events: evs });
  });

  return { ok: true, status: alreadyJoined ? "already_joined" : "joined" };
});

/** Decline a plan invite and clear the pending invite on the host's plan. */
exports.declinePlanInvite = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Must be logged in.");
  }

  const recipientUid = request.auth.uid;
  const notificationId = String(request.data?.notificationId || "").trim();
  if (!notificationId) {
    throw new HttpsError("invalid-argument", "Missing invite id.");
  }

  const db = admin.firestore();
  const notifRef = db
    .collection("users")
    .doc(recipientUid)
    .collection("notifications")
    .doc(notificationId);
  const notifSnap = await notifRef.get();
  if (!notifSnap.exists) {
    return { ok: true, alreadyDeclined: true };
  }

  const notif = notifSnap.data() || {};
  if (notif.type !== "plan_invite") {
    throw new HttpsError("failed-precondition", "Invalid invite.");
  }

  const hostUid = String(notif.planHostUid || notif.fromUserId || "").trim();
  const eventId = String(notif.eventId || "").trim();

  const batch = db.batch();
  batch.delete(notifRef);
  batch.delete(
    db.collection("users").doc(recipientUid).collection("notificationLocks").doc(notificationId)
  );
  await batch.commit();

  if (hostUid && eventId) {
    const hostRef = db.collection("users").doc(hostUid);
    await db.runTransaction(async (t) => {
      const snap = await t.get(hostRef);
      if (!snap.exists) return;
      const data = snap.data() || {};
      const evs = Array.isArray(data.events) ? [...data.events] : [];
      const idx = evs.findIndex((e) => String(e?.id || "").trim() === eventId);
      if (idx === -1) return;
      const row = { ...(evs[idx] || {}) };
      const nextInvited = collectInvitedIds(row);
      nextInvited.delete(recipientUid);
      row.planInvitedIds = [...nextInvited];
      evs[idx] = row;
      t.update(hostRef, { events: evs });
    });
  }

  return { ok: true };
});

/** Notify active friends when a friend activates Synq; clear those notifications on deactivate. */
exports.onFriendSynqActivated = onDocumentUpdated(
  {
    document: "users/{userId}",
    region: "us-central1",
  },
  async (event) => {
    const activatedUserId = event.params.userId;
    const before = event.data.before.data() || {};
    const after = event.data.after.data() || {};

    const wasActive = isSynqActive(before);
    const isActive = isSynqActive(after);
    if (wasActive === isActive) return;

    try {
      const friendsSnap = await admin
        .firestore()
        .collection("users")
        .doc(activatedUserId)
        .collection("friends")
        .get();

      if (friendsSnap.empty) return;

      const friendIds = friendsSnap.docs.map((d) => String(d.id || "").trim()).filter(Boolean);
      if (!friendIds.length) return;

      if (wasActive && !isActive) {
        await clearFriendSynqActiveNotifications(activatedUserId, friendIds);
        return;
      }

      const activatedPushToken = after?.pushToken || null;
      const activatedName = String(after?.displayName || "Your friend").trim() || "Your friend";

      const friendDocs = await Promise.all(
        friendIds.map((fid) => admin.firestore().collection("users").doc(fid).get())
      );

      for (const friendDoc of friendDocs) {
        if (!friendDoc.exists) continue;
        const friendData = friendDoc.data() || {};
        const recipientId = friendDoc.id;
        const recipientToken = friendData?.pushToken;
        if (!recipientToken) continue;
        if (!isSynqActive(friendData)) continue;
        if (!isRecipientInSynqVisibleTo(recipientId, after)) continue;

        if (activatedPushToken && recipientToken === activatedPushToken) {
          logWarn("onFriendSynqActivated_skip_same_device_token", {
            activatedUserId,
            recipientId,
          });
          continue;
        }

        const synqBody = `${firstNameFromDisplay(activatedName)} just activated Synq.`;
        try {
          await axios.post("https://exp.host/--/api/v2/push/send", {
            to: recipientToken,
            sound: "default",
            title: "Friend active on Synq",
            body: synqBody,
            data: {
              type: "friend_synq_active",
              fromUserId: activatedUserId,
            },
          });
          await writeInAppNotification(
            recipientId,
            friendSynqActiveNotifId(activatedUserId, recipientId),
            {
              type: "friend_synq_active",
              fromUserId: activatedUserId,
              title: "Friend active on Synq",
              body: synqBody,
            }
          );
        } catch (pushErr) {
          logError("onFriendSynqActivated_push", pushErr, {
            activatedUserId,
            recipientId,
          });
        }
      }
    } catch (err) {
      logError("onFriendSynqActivated", err, { activatedUserId });
    }
  }
);

const PLACES_FIELD_MASK =
    "places.displayName,places.rating,places.photos,places.shortFormattedAddress,places.formattedAddress";

/** Kill switch for client AI UI — backend returns immediately when false. */
const AI_SUGGESTIONS_PUBLIC_ENABLED = true;

const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"];

function normalizeSuggestion(raw) {
    if (!raw || typeof raw !== "object") return null;
    const name = String(raw.name || raw.title || "").trim();
    if (!name) return null;
    const location = String(raw.location || raw.address || "").trim();
    const address = String(raw.address || raw.location || "").trim();
    const imageUrl =
        typeof raw.imageUrl === "string"
            ? raw.imageUrl
            : typeof raw.imageurl === "string"
              ? raw.imageurl
              : null;
    return {
        name,
        rating: raw.rating ? String(raw.rating) : "4.0",
        imageUrl,
        location: location || address,
        address: address || location,
    };
}

function normalizeSuggestionList(list) {
    if (!Array.isArray(list)) return [];
    return list.map(normalizeSuggestion).filter(Boolean);
}

function normalizeLocationToken(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/\s*,\s*/g, ", ")
        .replace(/\s+/g, " ");
}

function venueDisplayName(venue) {
    return String(venue?.name || venue?.title || "").trim();
}

function suggestionHasStreetAddress(venue, searchLocation) {
    const address = String(venue?.address || venue?.location || "").trim();
    if (!address) return false;
    const searchNorm = normalizeLocationToken(searchLocation);
    const addressNorm = normalizeLocationToken(address);
    return addressNorm !== searchNorm && address.includes(",");
}

function suggestionHasPhoto(venue) {
    const imageUrl = venue?.imageUrl || venue?.imageurl;
    return typeof imageUrl === "string" && imageUrl.startsWith("http");
}

function needsVenueEnrichment(venue, searchLocation) {
    if (!venueDisplayName(venue)) return true;
    return !suggestionHasStreetAddress(venue, searchLocation) || !suggestionHasPhoto(venue);
}

function withLocationFallback(suggestions, location) {
    return suggestions.map((item) => ({
        ...item,
        location: item.location || item.address || location,
        address: item.address || item.location || location,
    }));
}

async function enrichSuggestionsList(suggestions, location, googleKey, db) {
    const list = Array.isArray(suggestions) ? suggestions : [];
    const normalizedInput = normalizeSuggestionList(list);
    if (list.length === 0) return [];

    const enriched = await Promise.all(
        list.map((venue) =>
            needsVenueEnrichment(venue, location)
                ? enrichVenueFromPlaces(venue, location, googleKey, db)
                : Promise.resolve(normalizeSuggestion(venue) || venue)
        )
    );
    const result = normalizeSuggestionList(enriched);
    if (result.length > 0) return result;
    if (normalizedInput.length > 0) {
        return withLocationFallback(normalizedInput, location);
    }
    return [];
}

function normalizeCategory(category) {
    const key = String(category || "").trim().toLowerCase();
    const aliases = {
        "surprise me": "restaurants, bars, and local activities",
        drinks: "bars and nightlife",
        dinner: "restaurants",
        "coffee spots": "cafes and coffee shops",
        outdoors: "parks and outdoor activities",
    };
    return aliases[key] || String(category || "local spots").trim();
}

async function generateVenueNames(geminiKey, location, interests, category) {
    const multiArea = /\band\b/i.test(String(location || ""));
    const areaPhrase = multiArea
        ? `near ${location}`
        : `in ${location}`;
    const prompt = `You are a local expert for ${location}. Based on interests: ${interests.join(
        ", "
    )}, suggest 3 real, well-known ${category} venues ${areaPhrase}. Prefer spots that are convenient for people across all of these areas. Use exact business names locals would recognize. Return ONLY a JSON array: [{"name":"Venue Name"}]`;

    let lastError;
    for (const modelName of GEMINI_MODELS) {
        try {
            const genAI = new GoogleGenerativeAI(geminiKey);
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(prompt);
            const rawText = result?.response?.text?.() || "";
            const cleaned = rawText.replace(/```json|```/g, "").trim();
            const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
            if (!jsonMatch) {
                throw new Error("Gemini returned an invalid venue list.");
            }

            const venues = JSON.parse(jsonMatch[0]);
            if (!Array.isArray(venues) || venues.length === 0) {
                throw new Error("Gemini returned no venues.");
            }
            return venues;
        } catch (error) {
            lastError = error;
            logWarn("generateVenueNames_model_failed", {
                modelName,
                message: error?.message,
            });
        }
    }

    throw lastError || new Error("Could not generate venue suggestions.");
}

function placesApiErrorDetails(err) {
    return {
        message: err?.message,
        status: err?.response?.status,
        statusText: err?.response?.statusText,
        apiMessage:
            err?.response?.data?.error?.message ||
            err?.response?.data?.error_message ||
            null,
    };
}

async function searchPlaceFromGoogle(fallbackName, location, googleKey) {
    const url = `https://places.googleapis.com/v1/places:searchText?key=${encodeURIComponent(
        googleKey
    )}`;
    const googleRes = await axios.post(
        url,
        {
            textQuery: `${fallbackName}, ${location}`,
            regionCode: "US",
        },
        {
            headers: {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": googleKey,
                "X-Goog-FieldMask": PLACES_FIELD_MASK,
            },
            timeout: 12000,
        }
    );
    return googleRes.data.places?.[0] || null;
}

async function resolvePlacePhotoUrl(photoName, googleKey) {
    if (!photoName) return null;
    const mediaUrl = `https://places.googleapis.com/v1/${photoName}/media`;
    try {
        const redirectRes = await axios.get(mediaUrl, {
            params: { maxWidthPx: 400, maxHeightPx: 400 },
            headers: { "X-Goog-Api-Key": googleKey },
            maxRedirects: 0,
            validateStatus: (status) => status === 302 || status === 200,
            timeout: 10000,
        });
        if (redirectRes.status === 302 && redirectRes.headers.location) {
            return redirectRes.headers.location;
        }
    } catch (e) {
        if (e?.response?.status === 302 && e.response.headers?.location) {
            return e.response.headers.location;
        }
        logWarn("resolvePlacePhotoUrl_redirect", { message: e?.message });
    }

    try {
        const res = await axios.get(mediaUrl, {
            params: { maxWidthPx: 400, maxHeightPx: 400, skipHttpRedirect: true },
            headers: { "X-Goog-Api-Key": googleKey },
            timeout: 10000,
        });
        if (res.data?.photoUri) {
            return res.data.photoUri;
        }
    } catch (e) {
        logWarn("resolvePlacePhotoUrl", { message: e?.message });
    }
    return null;
}

async function enrichVenueFromPlaces(venue, location, googleKey, db) {
    const fallbackName = venueDisplayName(venue);
    const base = {
        name: fallbackName,
        rating: "4.0",
        imageUrl: null,
        location: location,
        address: location,
    };
    if (!fallbackName) return base;

    if (db) {
        try {
            const cached = await readVenueCache(db, fallbackName, location);
            if (cached && !needsVenueEnrichment(cached, location)) {
                return normalizeSuggestion(cached) || cached;
            }
        } catch (e) {
            logWarn("enrichVenueFromPlaces_cache_read", { message: e?.message });
        }
    }

    let enriched = base;
    try {
        const place = await searchPlaceFromGoogle(fallbackName, location, googleKey);
        if (!place) return base;

        const resolvedName =
            place.displayName?.text || fallbackName;
        const shortAddress =
            place.shortFormattedAddress || place.formattedAddress || location;
        const fullAddress = place.formattedAddress || shortAddress || location;
        let imageUrl = await resolvePlacePhotoUrl(
            place.photos?.[0]?.name,
            googleKey
        );

        enriched = {
            name: resolvedName,
            rating: place.rating ? Number(place.rating).toFixed(1) : "4.0",
            imageUrl,
            location: shortAddress,
            address: fullAddress,
        };
    } catch (e) {
        logWarn("enrichVenueFromPlaces", {
            venue: fallbackName,
            ...placesApiErrorDetails(e),
        });
        return base;
    }

    if (db) {
        try {
            await writeVenueCache(db, fallbackName, location, enriched);
        } catch (e) {
            logWarn("enrichVenueFromPlaces_cache_write", { message: e?.message });
        }
    }

    return enriched;
}

exports.getSynqSuggestions = onCall(
    {
        secrets: ["GEMINI_API_KEY", "GOOGLE_MAPS_API_KEY"],
        region: "us-central1",
        invoker: "public",
        timeoutSeconds: 120,
        memory: "512MiB",
    },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "Must be logged in.");
        }

        try {
            if (!AI_SUGGESTIONS_PUBLIC_ENABLED) {
                throw new HttpsError(
                    "failed-precondition",
                    "Place suggestions are temporarily unavailable."
                );
            }

            const geminiKey = process.env.GEMINI_API_KEY;
            const googleKey = process.env.GOOGLE_MAPS_API_KEY;
            if (!geminiKey || !googleKey) {
                throw new HttpsError(
                    "failed-precondition",
                    "Suggestion service is not configured."
                );
            }

            const { shared, location, category } = request.data || {};
            if (!location || !category) {
                throw new HttpsError(
                    "invalid-argument",
                    "Location and category are required."
                );
            }

            const interests = Array.isArray(shared) ? shared : ["exploring new spots"];
            const normalizedCategory = normalizeCategory(category);
            const db = admin.firestore();
            const listCacheKey = buildSuggestionCacheKey(location, category, interests);

            try {
                const cachedSuggestions = await readSuggestionListCache(db, listCacheKey);
                if (cachedSuggestions) {
                    const normalizedCache =
                        normalizeSuggestionList(cachedSuggestions);
                    if (normalizedCache.length > 0) {
                        const needsRefresh = cachedSuggestions.some((venue) =>
                            needsVenueEnrichment(venue, location)
                        );
                        let suggestions = normalizedCache;
                        if (needsRefresh) {
                            try {
                                const enrichedFromCache = await enrichSuggestionsList(
                                    cachedSuggestions,
                                    location,
                                    googleKey,
                                    db
                                );
                                if (enrichedFromCache.length > 0) {
                                    suggestions = enrichedFromCache;
                                }
                            } catch (e) {
                                logWarn("getSynqSuggestions_cache_enrich", {
                                    message: e?.message,
                                });
                            }
                        }
                        logInfo("getSynqSuggestions_cache_hit", {
                            uid: request.auth.uid,
                            category,
                            location,
                            count: suggestions.length,
                            refreshed: needsRefresh,
                        });
                        if (needsRefresh && suggestions !== normalizedCache) {
                            try {
                                await writeSuggestionListCache(
                                    db,
                                    listCacheKey,
                                    suggestions
                                );
                            } catch (e) {
                                logWarn("getSynqSuggestions_cache_refresh", {
                                    message: e?.message,
                                });
                            }
                        }
                        return { suggestions, cached: true };
                    }
                }
            } catch (e) {
                logWarn("getSynqSuggestions_cache_read", { message: e?.message });
            }

            const venues = await generateVenueNames(
                geminiKey,
                location,
                interests,
                normalizedCategory
            );
            const enrichedSuggestions = await enrichSuggestionsList(
                venues,
                location,
                googleKey,
                db
            );
            const fallbackSuggestions = withLocationFallback(
                normalizeSuggestionList(venues),
                location
            );
            const suggestions =
                enrichedSuggestions.length > 0
                    ? enrichedSuggestions
                    : fallbackSuggestions;

            if (suggestions.length === 0) {
                throw new Error("No venue suggestions could be prepared.");
            }

            try {
                await writeSuggestionListCache(db, listCacheKey, suggestions);
            } catch (e) {
                logWarn("getSynqSuggestions_cache_write", { message: e?.message });
            }

            logInfo("getSynqSuggestions_fresh", {
                uid: request.auth.uid,
                category,
                location,
                count: suggestions.length,
            });

            return { suggestions, cached: false };
        } catch (error) {
            logError("getSynqSuggestions", error, { uid: request.auth?.uid });
            if (error instanceof HttpsError) throw error;
            throw new HttpsError("internal", error?.message || "Unknown error");
        }
    }
)