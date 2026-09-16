const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const {
  onDocumentCreated,
  onDocumentUpdated,
  onDocumentWritten,
} = require("firebase-functions/v2/firestore");
const axios = require("axios");
const admin = require("firebase-admin");
const { logError, logWarn, logInfo } = require("./serverLog");
const { registerModerationExports } = require("./moderation");
const { handleUserEventsChange, matchesPlanEvent, findHostPlanIndex } = require("./openPlanSync");
const {
  buildSuggestionCacheKey,
  readSuggestionListCache,
  writeSuggestionListCache,
  readVenueCache,
  writeVenueCache,
} = require("./synqSuggestionsCache");
const {
  PHONE_HASHES,
  normalizePhoneE164,
  hashPhoneE164,
  deletePhoneHashesForUid,
  upsertPhoneHashForUid,
} = require("./phoneHashes");
const { createReengagement } = require("./reengagement");

if (admin.apps.length === 0) {
    admin.initializeApp();
}

/** Populated after Synq status helpers exist (see below). */
let reengagement = null;

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

async function reserveUniqueCommunityShareCode(db, maxAttempts = 25) {
  for (let i = 0; i < maxAttempts; i += 1) {
    const code = randomInviteCode();
    const snap = await db
      .collection("communityGroups")
      .where("shareCode", "==", code)
      .limit(1)
      .get();
    if (snap.empty) return code;
  }
  throw new HttpsError("resource-exhausted", "Could not reserve community share code.");
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

async function groupIdForCommunityShareCode(db, rawCode) {
  const code = String(rawCode || "").trim().toUpperCase();
  if (!code) return null;
  const snap = await db
    .collection("communityGroups")
    .where("shareCode", "==", code)
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
    const afterSnap = event.data.after;
    const after = afterSnap?.exists ? afterSnap.data() : null;
    if (!after) return;

    // Keep friend-discovery search fields in sync (legacy accounts often lack them).
    try {
      const searchFields = buildUserSearchFields(after);
      const needsSearchSync =
        after.displayNameLower !== searchFields.displayNameLower ||
        after.searchNameLower !== searchFields.searchNameLower ||
        (searchFields.emailLower
          ? after.emailLower !== searchFields.emailLower
          : false);
      if (needsSearchSync && (searchFields.displayNameLower || searchFields.emailLower)) {
        await afterSnap.ref.update(searchFields);
      }
    } catch (e) {
      logError("onUserSearchFieldsSync", e, { userId });
    }

    const token = after.pushToken;
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
exports.submitFeedback = moderation.submitFeedback;
exports.blockUser = moderation.blockUser;
exports.unblockUser = moderation.unblockUser;
exports.listBlockedUsers = moderation.listBlockedUsers;
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
            const userRef = admin.firestore().collection("users").doc(recipientId);
            // Combined/merged source threads are hidden only for the merger; a new
            // message should bring the thread back into their inbox.
            await userRef.set(
                { hiddenChatIds: admin.firestore.FieldValue.arrayRemove(chatId) },
                { merge: true }
            );

            const userDoc = await userRef.get();
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
                "New message";
            const isPoll = messageData.type === "poll";
            const question = String(messageData.text || "").trim();
            const body = isPoll
                ? (question ? `Poll: ${question}` : "New poll")
                : messageData.text;
            await axios.post("https://exp.host/--/api/v2/push/send", {
                to: token,
                sound: "default",
                title: senderName,
                body,
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

/** Notify the poll author when someone else casts or changes a vote. */
exports.onPollVote = onDocumentUpdated(
  {
    document: "chats/{chatId}/messages/{messageId}",
    region: "us-central1",
  },
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    if (!after || after.type !== "poll") return;

    const { chatId, messageId } = event.params;
    const senderId = String(after.senderId ?? "").trim();
    if (!senderId) return;

    const beforeVotes =
      before && before.pollVotes && typeof before.pollVotes === "object"
        ? before.pollVotes
        : {};
    const afterVotes =
      after.pollVotes && typeof after.pollVotes === "object" ? after.pollVotes : {};

    const changedVoterIds = Object.keys(afterVotes).filter((uid) => {
      const next = afterVotes[uid];
      if (!Number.isInteger(next) || next < 0) return false;
      const prev = beforeVotes[uid];
      return prev !== next;
    });
    if (changedVoterIds.length === 0) return;

    let chatData = {};
    try {
      const chatDoc = await admin.firestore().collection("chats").doc(chatId).get();
      if (!chatDoc.exists) return;
      chatData = chatDoc.data() || {};
    } catch (e) {
      logError("onPollVote_chat_read", e, { chatId });
      return;
    }

    const question = String(after.text || "").trim().slice(0, 120);
    const options = Array.isArray(after.pollOptions) ? after.pollOptions : [];

    for (const voterId of changedVoterIds) {
      const vid = String(voterId || "").trim();
      if (!vid || vid === senderId) continue;

      try {
        const authorDoc = await admin.firestore().collection("users").doc(senderId).get();
        const voterDoc = await admin.firestore().collection("users").doc(vid).get();
        const authorToken = authorDoc.data()?.pushToken;
        if (!authorToken) continue;

        const voterToken = voterDoc.data()?.pushToken || null;
        if (voterToken && authorToken === voterToken) {
          logWarn("onPollVote_skip_same_device_token", {
            chatId,
            messageId,
          });
          continue;
        }

        let voterName =
          chatData.participantNames?.[vid] ||
          voterDoc.data()?.displayName ||
          "Someone";
        voterName = String(voterName).trim() || "Someone";

        const optionIndex = afterVotes[vid];
        const optionText = String(options[optionIndex] ?? "").trim();
        const title = `${voterName} voted on your poll`;
        let body = title;
        if (optionText && question) {
          body = `${optionText} · ${question}${question.length >= 120 ? "…" : ""}`;
        } else if (optionText) {
          body = optionText;
        } else if (question) {
          body = `${question}${question.length >= 120 ? "…" : ""}`;
        }

        await axios.post("https://exp.host/--/api/v2/push/send", {
          to: authorToken,
          sound: "default",
          title,
          body,
          data: {
            type: "poll_vote",
            chatId: String(chatId),
            messageId: String(messageId),
          },
        });
      } catch (err) {
        logError("onPollVote_push", err, { chatId, messageId });
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
      await deleteCollectionInChunks(
        db,
        db.collection("users").doc(uid).collection("communityGroupInvites"),
        400
      );
      await deleteCollectionInChunks(
        db,
        db.collection("users").doc(uid).collection("blocked"),
        400
      );

      // Leave or delete community groups this user belongs to / owns.
      const communitySnap = await db
        .collection("communityGroups")
        .where("memberIds", "array-contains", uid)
        .get();
      for (const groupDoc of communitySnap.docs) {
        const data = groupDoc.data() || {};
        const memberIds = Array.isArray(data.memberIds)
          ? data.memberIds.map(String).filter(Boolean)
          : [];
        const isCreator = String(data.creatorId || "") === uid;
        const postsRef = groupDoc.ref.collection("posts");
        const plansRef = groupDoc.ref.collection("plans");
        if (isCreator || memberIds.filter((id) => id !== uid).length === 0) {
          await deleteCollectionInChunks(db, postsRef, 400);
          await deleteCollectionInChunks(db, plansRef, 400);
          await deleteCollectionInChunks(db, groupDoc.ref.collection("invites"), 400);
          await groupDoc.ref.delete().catch(() => {});
        } else {
          const nextMembers = memberIds.filter((id) => id !== uid);
          const previews =
            data.memberPreviews && typeof data.memberPreviews === "object"
              ? { ...data.memberPreviews }
              : {};
          delete previews[uid];
          const authorPosts = await postsRef.where("authorId", "==", uid).get();
          const batch = db.batch();
          authorPosts.docs.forEach((d) => batch.delete(d.ref));
          batch.update(groupDoc.ref, {
            memberIds: nextMembers,
            memberPreviews: previews,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          await batch.commit().catch(() => {});
        }
      }

      try {
        await deletePhoneHashesForUid(db, uid);
      } catch (phoneHashErr) {
        logWarn("deleteMyAccount_phoneHashes", { uid, message: phoneHashErr?.message });
      }
      const bucket = admin.storage().bucket();
      await Promise.allSettled([
        bucket.file(`profiles/${uid}`).delete(),
        bucket.file(`profileShareCards/${uid}/card.png`).delete(),
      ]);
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

      // Remove the chat doc first so inbox listeners update immediately.
      // Message docs are orphaned until the chunked cleanup below finishes.
      await chatRef.delete();

      await Promise.all([
        deleteCollectionInChunks(db, chatRef.collection("messages"), 400),
        ...participants.map((participantUid) =>
          db
            .collection("users")
            .doc(participantUid)
            .update({
              pinnedChatIds: admin.firestore.FieldValue.arrayRemove(chatId),
            })
            .catch(() => {})
        ),
      ]);

      return { ok: true };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logError("deleteChat", error, { uid, chatId });
      throw new HttpsError("internal", error?.message || "Failed to delete chat.");
    }
  }
);

/**
 * Combines two chats the caller participates in into one group thread.
 * Admin SDK bypasses friendship-only create rules so community / legacy
 * co-participants can still be merged when the user is already in both threads.
 */
exports.mergeChats = onCall(
  { region: "us-central1", invoker: "public" },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Must be logged in.");
    }
    const uid = request.auth.uid;
    const chatIdA = String(request.data?.chatIdA || "").trim();
    const chatIdB = String(request.data?.chatIdB || "").trim();
    if (!chatIdA || !chatIdB || chatIdA === chatIdB) {
      throw new HttpsError("invalid-argument", "Two different chat ids are required.");
    }

    const db = admin.firestore();

    try {
      const [snapA, snapB, userSnap] = await Promise.all([
        db.collection("chats").doc(chatIdA).get(),
        db.collection("chats").doc(chatIdB).get(),
        db.collection("users").doc(uid).get(),
      ]);
      if (!snapA.exists || !snapB.exists) {
        throw new HttpsError("not-found", "One of those conversations is no longer available.");
      }

      const dataA = snapA.data() || {};
      const dataB = snapB.data() || {};
      const participantsA = Array.isArray(dataA.participants)
        ? dataA.participants.map((id) => String(id || "").trim()).filter(Boolean)
        : [];
      const participantsB = Array.isArray(dataB.participants)
        ? dataB.participants.map((id) => String(id || "").trim()).filter(Boolean)
        : [];
      if (!participantsA.includes(uid) || !participantsB.includes(uid)) {
        throw new HttpsError("permission-denied", "Not a chat participant.");
      }

      const mergedParticipants = [
        ...new Set([...participantsA, ...participantsB]),
      ].sort();
      if (mergedParticipants.length < 2 || mergedParticipants.length > 15) {
        throw new HttpsError("invalid-argument", "Invalid participant count for group chat.");
      }

      const samePeople =
        participantsA.length === participantsB.length &&
        [...participantsA].sort().every((id, i) => id === [...participantsB].sort()[i]);
      if (samePeople) {
        throw new HttpsError(
          "failed-precondition",
          "These conversations already include the same people."
        );
      }

      const namesA =
        dataA.participantNames && typeof dataA.participantNames === "object"
          ? dataA.participantNames
          : {};
      const namesB =
        dataB.participantNames && typeof dataB.participantNames === "object"
          ? dataB.participantNames
          : {};
      const imagesA =
        dataA.participantImages && typeof dataA.participantImages === "object"
          ? dataA.participantImages
          : {};
      const imagesB =
        dataB.participantImages && typeof dataB.participantImages === "object"
          ? dataB.participantImages
          : {};

      const participantNames = {};
      const participantImages = {};
      const missingProfileUids = [];
      for (const participantUid of mergedParticipants) {
        const name = String(namesA[participantUid] || namesB[participantUid] || "").trim();
        const image = String(imagesA[participantUid] || imagesB[participantUid] || "").trim();
        participantNames[participantUid] = name;
        participantImages[participantUid] = image;
        if (!name || !image) missingProfileUids.push(participantUid);
      }

      if (missingProfileUids.length) {
        const profileSnaps = await Promise.all(
          missingProfileUids.map((id) => db.collection("users").doc(id).get())
        );
        profileSnaps.forEach((profileSnap, index) => {
          const participantUid = missingProfileUids[index];
          if (!profileSnap.exists) return;
          const profile = profileSnap.data() || {};
          if (!participantNames[participantUid]) {
            participantNames[participantUid] = String(profile.displayName || "").trim();
          }
          if (!participantImages[participantUid]) {
            participantImages[participantUid] = String(profile.imageurl || "").trim();
          }
        });
      }

      const myDisplayName =
        String(participantNames[uid] || userSnap.data()?.displayName || "").trim() ||
        "Someone";
      const firstName = myDisplayName.split(/\s+/)[0] || "Someone";
      const systemText = `${firstName} combined two conversations`;

      const groupIdA = String(dataA.communityGroupId || "").trim();
      const groupIdB = String(dataB.communityGroupId || "").trim();
      const sharedCommunityGroupId =
        groupIdA && groupIdA === groupIdB ? groupIdA : "";

      const chatPayload = {
        participants: mergedParticipants,
        participantNames,
        participantImages,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastMessage: systemText,
        lastMessageSenderId: uid,
        mergedFrom: [chatIdA, chatIdB],
      };
      if (sharedCommunityGroupId) {
        chatPayload.communityGroupId = sharedCommunityGroupId;
      }

      const chatRef = await db.collection("chats").add(chatPayload);
      await chatRef.collection("messages").add({
        text: systemText,
        senderId: uid,
        type: "system",
        imageurl: String(
          participantImages[uid] || userSnap.data()?.imageurl || ""
        ).trim(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { ok: true, chatId: chatRef.id, reused: false };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logError("mergeChats", error, { uid, chatIdA, chatIdB });
      throw new HttpsError("internal", error?.message || "Failed to combine chats.");
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
      const protocol = String(req.headers["x-forwarded-proto"] || "https")
        .split(",")[0]
        .trim();
      const host = String(req.headers.host || "new-synq-main.web.app").trim();
      const shareUrl = `${protocol}://${host}/u/${encodeURIComponent(code)}`;
      const ogImageTags = ogImage
        ? `<meta property="og:image" content="${escapeHtml(ogImage)}" />
    <meta property="og:image:width" content="320" />
    <meta property="og:image:height" content="380" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:image" content="${escapeHtml(ogImage)}" />`
        : `<meta name="twitter:card" content="summary" />`;

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
    <meta property="og:url" content="${escapeHtml(shareUrl)}" />
    ${ogImageTags}
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

/** Normalize ambassador codes: uppercase, allow A-Z 0-9 hyphen. */
function normalizeAmbassadorCode(raw) {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "");
}

function isValidAmbassadorCodeShape(code) {
  return /^[A-Z0-9][A-Z0-9-]{1,31}$/.test(code);
}

function extractAmbassadorCodeFromPath(pathname) {
  const match = String(pathname || "").match(/\/a\/([^/?#]+)/i);
  if (!match) return "";
  return normalizeAmbassadorCode(decodeURIComponent(match[1] || ""));
}

async function ambassadorDocForCode(db, rawCode) {
  const code = normalizeAmbassadorCode(rawCode);
  if (!code || !isValidAmbassadorCodeShape(code)) return null;
  const snap = await db
    .collection("ambassadors")
    .where("code", "==", code)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ref: doc.ref, data: doc.data() || {} };
}

function looksLikeBotRequest(req) {
  const ua = String(req.headers["user-agent"] || "").toLowerCase();
  if (!ua) return true;
  if (
    /bot|crawl|spider|slurp|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|preview|embedly|quora|pinterest|discordbot|slackbot/i.test(
      ua
    )
  ) {
    return true;
  }
  const dest = String(req.headers["sec-fetch-dest"] || "").toLowerCase();
  if (dest === "image" || dest === "style" || dest === "script" || dest === "font") {
    return true;
  }
  return false;
}

/** HTML landing page for ambassador referral links (`/a/{code}`). */
exports.ambassadorSharePageHttp = onRequest(
  { region: "us-central1" },
  async (req, res) => {
    const code = extractAmbassadorCodeFromPath(req.path);
    if (!code || !isValidAmbassadorCodeShape(code)) {
      res.status(404).send("Not found");
      return;
    }

    try {
      const db = admin.firestore();
      const ambassador = await ambassadorDocForCode(db, code);
      if (!ambassador || String(ambassador.data.status || "") !== "active") {
        res.status(404).send("This referral link is no longer available.");
        return;
      }

      if (!looksLikeBotRequest(req)) {
        try {
          await ambassador.ref.update({
            clickCount: admin.firestore.FieldValue.increment(1),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        } catch (e) {
          logError("ambassadorSharePageHttp_click", e, { code, ambassadorId: ambassador.id });
        }
      }

      const deepLink = `synq://a/${encodeURIComponent(code)}`;
      const clipboardPayload = `SYNQ-A:${code}`;
      const iosStore =
        "https://apps.apple.com/us/app/synq-see-whos-free/id6757319173";
      const playReferrer = encodeURIComponent(
        `utm_source=ambassador&utm_medium=referral&utm_content=${code}&ambassador=${code}`
      );
      const androidStore = `https://play.google.com/store/apps/details?id=com.stefaniebaarman.synq&referrer=${playReferrer}`;
      const protocol = String(req.headers["x-forwarded-proto"] || "https")
        .split(",")[0]
        .trim();
      const host = String(req.headers.host || "join.synqapp.com").trim();
      const shareUrl = `${protocol}://${host}/a/${encodeURIComponent(code)}`;
      const displayName = String(ambassador.data.displayName || "a Synq ambassador").trim();

      res.set("Cache-Control", "no-store");
      res.status(200).send(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Join Synq</title>
    <meta property="og:title" content="Join Synq" />
    <meta property="og:description" content="Get Synq via ${escapeHtml(displayName)}." />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${escapeHtml(shareUrl)}" />
    <meta name="twitter:card" content="summary" />
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
        var clipboardPayload = ${JSON.stringify(clipboardPayload)};
        var ua = navigator.userAgent || "";
        var isIOS = /iPad|iPhone|iPod/i.test(ua);
        var isAndroid = /Android/i.test(ua);
        var storeUrl = isIOS ? iosStore : isAndroid ? androidStore : iosStore;
        var storeLink = document.getElementById("store-link");
        if (storeLink) storeLink.href = storeUrl;
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(clipboardPayload).catch(function () {});
          }
        } catch (e) {}
        window.location.replace(deepLink);
        window.setTimeout(function () {
          window.location.replace(storeUrl);
        }, 1200);
      })();
    </script>
  </body>
</html>`);
    } catch (e) {
      logError("ambassadorSharePageHttp", e, { code });
      res.status(500).send("Something went wrong.");
    }
  }
);

/** First-touch ambassador signup attribution (no friend request). */
exports.claimAmbassadorReferral = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Must be logged in.");
    }
    const uid = String(request.auth.uid || "").trim();
    const code = normalizeAmbassadorCode(request.data?.code);
    const methodRaw = String(request.data?.method || "manual").trim().toLowerCase();
    const allowedMethods = new Set([
      "universal_link",
      "clipboard",
      "play_referrer",
      "manual",
    ]);
    const method = allowedMethods.has(methodRaw) ? methodRaw : "manual";

    if (!code || !isValidAmbassadorCodeShape(code)) {
      throw new HttpsError("invalid-argument", "Invalid ambassador code.");
    }

    const db = admin.firestore();
    const userRef = db.collection("users").doc(uid);
    const attributionRef = db.collection("ambassadorAttributions").doc(uid);

    const result = await db.runTransaction(async (tx) => {
      const ambassadorQuery = db
        .collection("ambassadors")
        .where("code", "==", code)
        .limit(1);
      const [userSnap, attributionSnap, ambassadorSnap] = await Promise.all([
        tx.get(userRef),
        tx.get(attributionRef),
        tx.get(ambassadorQuery),
      ]);

      if (!userSnap.exists) {
        throw new HttpsError("failed-precondition", "User profile missing.");
      }

      const userData = userSnap.data() || {};
      if (userData.referredByAmbassadorId) {
        return {
          ok: true,
          status: "already_attributed",
          ambassadorId: String(userData.referredByAmbassadorId),
          code: String(userData.referredByAmbassadorCode || ""),
        };
      }
      if (attributionSnap.exists) {
        const prev = attributionSnap.data() || {};
        return {
          ok: true,
          status: "already_attributed",
          ambassadorId: String(prev.ambassadorId || ""),
          code: String(prev.code || ""),
        };
      }

      if (ambassadorSnap.empty) {
        throw new HttpsError("failed-precondition", "Ambassador code not found.");
      }
      const ambDoc = ambassadorSnap.docs[0];
      const ambData = ambDoc.data() || {};
      if (String(ambData.status || "") !== "active") {
        throw new HttpsError("failed-precondition", "Ambassador link is disabled.");
      }

      const ambassadorId = ambDoc.id;
      const now = admin.firestore.FieldValue.serverTimestamp();
      tx.set(
        userRef,
        {
          referredByAmbassadorId: ambassadorId,
          referredByAmbassadorCode: code,
          referredAt: now,
        },
        { merge: true }
      );
      tx.set(attributionRef, {
        ambassadorId,
        code,
        method,
        createdAt: now,
      });
      tx.update(ambDoc.ref, {
        signupCount: admin.firestore.FieldValue.increment(1),
        updatedAt: now,
      });

      return {
        ok: true,
        status: "attributed",
        ambassadorId,
        code,
      };
    });

    return result;
  }
);

exports.getOrCreateCommunityShareCode = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Must be logged in.");
    }
    const uid = String(request.auth.uid || "").trim();
    const groupId = String(request.data?.groupId || "").trim();
    if (!groupId) {
      throw new HttpsError("invalid-argument", "groupId is required.");
    }
    const db = admin.firestore();
    const groupRef = db.collection("communityGroups").doc(groupId);
    const groupSnap = await groupRef.get();
    if (!groupSnap.exists) {
      throw new HttpsError("not-found", "Community not found.");
    }
    const data = groupSnap.data() || {};
    const memberIds = Array.isArray(data.memberIds) ? data.memberIds : [];
    if (!memberIds.includes(uid)) {
      throw new HttpsError("permission-denied", "Join this community to share it.");
    }
    const existing = String(data.shareCode || "").trim().toUpperCase();
    if (existing) {
      return { shareCode: existing };
    }
    const shareCode = await reserveUniqueCommunityShareCode(db);
    await groupRef.set(
      {
        shareCode,
        shareCodeCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return { shareCode };
  }
);

/** Admin-backed member cards so co-members see names/photos without N user getDocs. */
exports.syncCommunityMemberPreviews = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Must be logged in.");
    }
    const uid = String(request.auth.uid || "").trim();
    const groupId = String(request.data?.groupId || "").trim();
    if (!groupId) {
      throw new HttpsError("invalid-argument", "groupId is required.");
    }

    const db = admin.firestore();
    const groupRef = db.collection("communityGroups").doc(groupId);
    const groupSnap = await groupRef.get();
    if (!groupSnap.exists) {
      throw new HttpsError("not-found", "Community not found.");
    }

    const data = groupSnap.data() || {};
    const memberIds = Array.isArray(data.memberIds)
      ? [
          ...new Set(
            data.memberIds
              .map((id) => String(id || "").trim())
              .filter(Boolean)
          ),
        ]
      : [];
    if (!memberIds.includes(uid)) {
      throw new HttpsError(
        "permission-denied",
        "Join this community to view members."
      );
    }

    const existing =
      data.memberPreviews && typeof data.memberPreviews === "object"
        ? { ...data.memberPreviews }
        : {};
    const previews = {};

    for (let i = 0; i < memberIds.length; i += 40) {
      const chunk = memberIds.slice(i, i + 40);
      const refs = chunk.map((id) => db.collection("users").doc(id));
      const snaps = await db.getAll(...refs);
      snaps.forEach((snap, index) => {
        const memberId = chunk[index];
        const prev = existing[memberId] || {};
        if (!snap.exists) {
          const displayName = String(prev.displayName || "").trim() || "Member";
          const imageurl = String(prev.imageurl || "").trim();
          previews[memberId] = {
            displayName,
            ...(imageurl ? { imageurl } : {}),
          };
          return;
        }
        const user = snap.data() || {};
        const displayName =
          String(user.displayName || "").trim() ||
          String(prev.displayName || "").trim() ||
          "Member";
        const imageurl =
          String(user.imageurl || "").trim() ||
          String(prev.imageurl || "").trim();
        previews[memberId] = {
          displayName,
          ...(imageurl ? { imageurl } : {}),
        };
      });
    }

    await groupRef.set(
      {
        memberPreviews: previews,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return { memberPreviews: previews };
  }
);

/** Creator removes a member (client rules freeze memberIds to self-join/leave only). */
exports.removeCommunityGroupMember = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Must be logged in.");
    }
    const uid = String(request.auth.uid || "").trim();
    const groupId = String(request.data?.groupId || "").trim();
    const memberId = String(request.data?.memberId || "").trim();
    if (!groupId || !memberId) {
      throw new HttpsError("invalid-argument", "groupId and memberId are required.");
    }
    if (memberId === uid) {
      throw new HttpsError(
        "invalid-argument",
        "Leave the community instead of removing yourself."
      );
    }

    const db = admin.firestore();
    const groupRef = db.collection("communityGroups").doc(groupId);
    const groupSnap = await groupRef.get();
    if (!groupSnap.exists) {
      throw new HttpsError("not-found", "Community not found.");
    }

    const data = groupSnap.data() || {};
    const creatorId = String(data.creatorId || "").trim();
    if (creatorId !== uid) {
      throw new HttpsError("permission-denied", "Only the admin can remove members.");
    }
    if (memberId === creatorId) {
      throw new HttpsError("invalid-argument", "Cannot remove the community admin.");
    }

    const memberIds = Array.isArray(data.memberIds)
      ? [
          ...new Set(
            data.memberIds
              .map((id) => String(id || "").trim())
              .filter(Boolean)
          ),
        ]
      : [];
    if (!memberIds.includes(memberId)) {
      return { ok: true, memberIds };
    }

    const nextMemberIds = memberIds.filter((id) => id !== memberId);
    const previews =
      data.memberPreviews && typeof data.memberPreviews === "object"
        ? { ...data.memberPreviews }
        : {};
    delete previews[memberId];

    const batch = db.batch();
    batch.update(groupRef, {
      memberIds: nextMemberIds,
      memberPreviews: previews,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    batch.set(
      db.collection("users").doc(memberId),
      {
        communityGroupIds: admin.firestore.FieldValue.arrayRemove(groupId),
      },
      { merge: true }
    );
    // Drop any pending invite for this user into this group.
    batch.delete(
      db.collection("users").doc(memberId).collection("communityGroupInvites").doc(groupId)
    );
    batch.delete(
      groupRef.collection("invites").doc(memberId)
    );
    await batch.commit();

    return { ok: true, memberIds: nextMemberIds };
  }
);

/** Creator deletes a community and clears members' communityGroupIds. */
exports.deleteCommunityGroup = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Must be logged in.");
    }
    const uid = String(request.auth.uid || "").trim();
    const groupId = String(request.data?.groupId || "").trim();
    if (!groupId) {
      throw new HttpsError("invalid-argument", "groupId is required.");
    }

    const db = admin.firestore();
    const groupRef = db.collection("communityGroups").doc(groupId);
    const groupSnap = await groupRef.get();
    if (!groupSnap.exists) {
      return { ok: true };
    }

    const data = groupSnap.data() || {};
    if (String(data.creatorId || "").trim() !== uid) {
      throw new HttpsError("permission-denied", "Only the admin can delete this community.");
    }

    const memberIds = Array.isArray(data.memberIds)
      ? [
          ...new Set(
            data.memberIds
              .map((id) => String(id || "").trim())
              .filter(Boolean)
          ),
        ]
      : [];

    // Delete invites + plans/posts in chunks is heavy; mirror client cover delete separately.
    const invitesSnap = await groupRef.collection("invites").limit(200).get();
    let batch = db.batch();
    let ops = 0;
    const commitBatch = async () => {
      if (ops === 0) return;
      await batch.commit();
      batch = db.batch();
      ops = 0;
    };

    for (const inviteDoc of invitesSnap.docs) {
      batch.delete(inviteDoc.ref);
      ops += 1;
      if (ops >= 400) await commitBatch();
    }

    for (const memberId of memberIds) {
      batch.set(
        db.collection("users").doc(memberId),
        {
          communityGroupIds: admin.firestore.FieldValue.arrayRemove(groupId),
        },
        { merge: true }
      );
      batch.delete(
        db.collection("users").doc(memberId).collection("communityGroupInvites").doc(groupId)
      );
      ops += 2;
      if (ops >= 400) await commitBatch();
    }

    batch.delete(groupRef);
    ops += 1;
    await commitBatch();

    return { ok: true };
  }
);

/** Public lookup for community share links (`/c/{shareCode}`). */
exports.resolveCommunityShareCodeHttp = onRequest(
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
      const groupId = await groupIdForCommunityShareCode(admin.firestore(), code);
      if (!groupId) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      res.status(200).json({ groupId, shareCode: code });
    } catch (e) {
      logError("resolveCommunityShareCodeHttp", e, { code });
      res.status(500).json({ error: "internal" });
    }
  }
);

function extractCommunityShareCodeFromPath(pathname) {
  const match = String(pathname || "").match(/\/c\/([^/?#]+)/i);
  return match ? decodeURIComponent(match[1] || "").trim().toUpperCase() : "";
}

/** HTML landing page for /c/{shareCode} with Open Graph preview. */
exports.communitySharePageHttp = onRequest(
  { region: "us-central1" },
  async (req, res) => {
    const code = extractCommunityShareCodeFromPath(req.path);
    if (!code) {
      res.status(404).send("Not found");
      return;
    }

    try {
      const db = admin.firestore();
      const groupId = await groupIdForCommunityShareCode(db, code);
      if (!groupId) {
        res.status(404).send("This community link is no longer available.");
        return;
      }

      const groupSnap = await db.collection("communityGroups").doc(groupId).get();
      const group = groupSnap.exists ? groupSnap.data() || {} : {};
      const name = String(group.name || "").trim() || "Community";
      const about = String(group.about || "").trim();
      const location = String(group.location || "").trim();
      const category = String(group.category || "").trim();
      const ogImage = String(group.coverPhotoUrl || group.coverPhotoThumbUrl || "").trim();
      const descriptionParts = [
        about || "Join this community on Synq.",
        [category, location].filter(Boolean).join(" · "),
      ].filter(Boolean);
      const description = descriptionParts.join(" ");

      const deepLink = `synq://c/${encodeURIComponent(code)}`;
      const iosStore =
        "https://apps.apple.com/us/app/synq-see-whos-free/id6757319173";
      const androidStore =
        "https://play.google.com/store/search?q=Synq&c=apps";
      const protocol = String(req.headers["x-forwarded-proto"] || "https")
        .split(",")[0]
        .trim();
      const host = String(req.headers.host || "new-synq-main.web.app").trim();
      const shareUrl = `${protocol}://${host}/c/${encodeURIComponent(code)}`;
      const ogTitle = `Join ${name} on Synq`;
      const ogImageTags = ogImage
        ? `<meta property="og:image" content="${escapeHtml(ogImage)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:image" content="${escapeHtml(ogImage)}" />`
        : `<meta name="twitter:card" content="summary" />`;

      res.set("Cache-Control", "public, max-age=60");
      res.status(200).send(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(ogTitle)}</title>
    <meta property="og:title" content="${escapeHtml(ogTitle)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${escapeHtml(shareUrl)}" />
    ${ogImageTags}
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
      <p>Opening ${escapeHtml(name)}…</p>
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
      logError("communitySharePageHttp", e, { code });
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
  const city = typeof data.city === "string" ? data.city.trim() : "";
  const state = typeof data.state === "string" ? data.state.trim() : "";
  const locationDisplay =
    typeof data.locationDisplay === "string" && data.locationDisplay.trim()
      ? data.locationDisplay.trim()
      : city && state
        ? `${city}, ${state}`
        : city || "";
  const interests = Array.isArray(data.interests)
    ? data.interests
        .filter((item) => typeof item === "string" && item.trim())
        .map((item) => item.trim())
        .slice(0, 40)
    : [];
  return {
    id: doc.id,
    displayName: data.displayName || "User",
    imageurl: data.imageurl || null,
    firstName: data.firstName || "",
    lastName: data.lastName || "",
    email: data.email || null,
    city,
    state,
    locationDisplay,
    interests,
  };
}

function discoveryUserPayload(fields, extra = {}) {
  return {
    id: fields.id,
    displayName: fields.displayName,
    imageurl: fields.imageurl,
    email: fields.email,
    city: fields.city,
    state: fields.state,
    locationDisplay: fields.locationDisplay,
    interests: fields.interests,
    ...extra,
  };
}

function buildUserSearchFields(data) {
  const displayName = String(data.displayName || "").trim();
  const firstName = String(data.firstName || "").trim();
  const lastName = String(data.lastName || "").trim();
  const email = String(data.email || "").trim().toLowerCase();
  const fullName = `${firstName} ${lastName}`.trim();
  const displayNameLower = (displayName || fullName)
    .toLowerCase()
    .replace(/\s+/g, " ");
  const searchNameLower = (fullName || displayName)
    .toLowerCase()
    .replace(/\s+/g, " ");
  return {
    displayNameLower,
    searchNameLower,
    emailLower: email,
  };
}

function pushSearchUser(users, seen, exclude, userDoc, extra = {}) {
  if (seen.has(userDoc.id) || exclude.has(userDoc.id)) return;
  const fields = publicUserFields(userDoc);
  seen.add(userDoc.id);
  users.push(discoveryUserPayload(fields, extra));
}

function userMatchesSearchQuery(data, query) {
  if (!query) return false;
  const displayName = normalizeSearchText(data.displayName || "");
  const firstName = normalizeSearchText(data.firstName || "");
  const lastName = normalizeSearchText(data.lastName || "");
  const fullName = normalizeSearchText(`${firstName} ${lastName}`);
  const displayNameLower = normalizeSearchText(data.displayNameLower || displayName);
  const searchNameLower = normalizeSearchText(data.searchNameLower || fullName || displayName);
  return (
    displayName.includes(query) ||
    fullName.includes(query) ||
    firstName.includes(query) ||
    lastName.includes(query) ||
    displayNameLower.includes(query) ||
    searchNameLower.includes(query)
  );
}

async function assertCallableRateLimit(db, uid, key, windowMs, maxCalls) {
  const ref = db.collection("users").doc(uid).collection("rateLimits").doc(key);
  const now = Date.now();
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data() || {};
    const windowStart = Number(data.windowStart || 0);
    const count = Number(data.count || 0);
    if (!windowStart || now - windowStart > windowMs) {
      tx.set(ref, { windowStart: now, count: 1 });
      return;
    }
    if (count >= maxCalls) {
      throw new HttpsError(
        "resource-exhausted",
        "Too many requests. Try again in a few minutes."
      );
    }
    tx.set(ref, { windowStart, count: count + 1 }, { merge: true });
  });
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
    const friendIds = myFriendsSnap.docs.map((d) => d.id);
    const friendSet = new Set(friendIds);
    // Only exclude self — existing friends stay in results with isFriend.
    const exclude = new Set([myId]);

    const users = [];
    const seen = new Set();

    const pushDoc = (userDoc) => {
      pushSearchUser(users, seen, exclude, userDoc, {
        isFriend: friendSet.has(userDoc.id),
      });
    };

    // Always include matching friends (substring), even if denormalized
    // search fields are missing on older accounts.
    for (let i = 0; i < friendIds.length && users.length < 30; i += 10) {
      const chunk = friendIds.slice(i, i + 10);
      const snaps = await db.getAll(...chunk.map((id) => db.collection("users").doc(id)));
      for (const userDoc of snaps) {
        if (!userDoc.exists) continue;
        if (!userMatchesSearchQuery(userDoc.data() || {}, query)) continue;
        pushDoc(userDoc);
        if (users.length >= 30) break;
      }
    }

    const prefixSnap = await db
      .collection("users")
      .where("displayNameLower", ">=", query)
      .where("displayNameLower", "<=", `${query}\uf8ff`)
      .limit(40)
      .get();

    for (const userDoc of prefixSnap.docs) {
      if (users.length >= 30) break;
      pushDoc(userDoc);
    }

    if (query.includes("@") && users.length < 30) {
      const emailSnap = await db
        .collection("users")
        .where("emailLower", "==", query)
        .limit(5)
        .get();
      for (const userDoc of emailSnap.docs) {
        if (users.length >= 30) break;
        pushDoc(userDoc);
      }
    }

    if (users.length < 30 && query.length >= 2) {
      const searchSnap = await db
        .collection("users")
        .where("searchNameLower", ">=", query)
        .where("searchNameLower", "<=", `${query}\uf8ff`)
        .limit(20)
        .get();
      for (const userDoc of searchSnap.docs) {
        if (users.length >= 30) break;
        pushDoc(userDoc);
      }
    }

    // Legacy fallback: many older accounts never got displayNameLower /
    // searchNameLower, so prefix queries miss them. Page through users,
    // match in memory, and backfill fields when we find a hit.
    if (users.length < 30 && query.length >= 2) {
      const backfillBatch = db.batch();
      let backfillCount = 0;
      let lastDoc = null;
      let pages = 0;
      const maxPages = 15; // up to ~4500 accounts

      while (users.length < 30 && pages < maxPages) {
        let legacyQuery = db
          .collection("users")
          .orderBy(admin.firestore.FieldPath.documentId())
          .limit(300);
        if (lastDoc) legacyQuery = legacyQuery.startAfter(lastDoc);
        const legacySnap = await legacyQuery.get();
        if (legacySnap.empty) break;
        pages += 1;
        lastDoc = legacySnap.docs[legacySnap.docs.length - 1];

        for (const userDoc of legacySnap.docs) {
          if (users.length >= 30) break;
          if (seen.has(userDoc.id) || exclude.has(userDoc.id)) continue;
          const data = userDoc.data() || {};
          if (!userMatchesSearchQuery(data, query)) continue;
          pushDoc(userDoc);
          const fields = buildUserSearchFields(data);
          if (
            fields.displayNameLower &&
            (data.displayNameLower !== fields.displayNameLower ||
              data.searchNameLower !== fields.searchNameLower ||
              (fields.emailLower && data.emailLower !== fields.emailLower))
          ) {
            backfillBatch.update(userDoc.ref, fields);
            backfillCount += 1;
          }
        }
        if (legacySnap.size < 300) break;
      }

      if (backfillCount > 0) {
        try {
          await backfillBatch.commit();
          logInfo("searchUsersForFriend_backfill", { count: backfillCount });
        } catch (e) {
          logError("searchUsersForFriend_backfill", e, {});
        }
      }
    }

    users.sort((a, b) => {
      if (a.isFriend !== b.isFriend) return a.isFriend ? -1 : 1;
      return String(a.displayName || "").localeCompare(String(b.displayName || ""));
    });

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
    await assertCallableRateLimit(db, myId, "getSuggestedFriends", 60 * 60 * 1000, 20);
    const myFriendsSnap = await db
      .collection("users")
      .doc(myId)
      .collection("friends")
      .get();
    const myFriendIds = myFriendsSnap.docs.map((d) => d.id).slice(0, 40);
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
          return discoveryUserPayload(fields, { mutualCount });
        })
      )
    ).filter(Boolean);

    return { users };
  }
);

/** Index the caller's Auth phone number for contact matching. */
exports.syncMyPhoneHash = onCall(
  { region: "us-central1", secrets: ["PHONE_LOOKUP_SECRET"] },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Must be logged in.");
    }
    const uid = String(request.auth.uid || "").trim();
    try {
      const phone = await upsertPhoneHashForUid(uid);
      return { ok: true, hasPhone: !!phone };
    } catch (err) {
      logError("syncMyPhoneHash", err, { uid });
      throw new HttpsError("internal", "Could not sync phone lookup.");
    }
  }
);

/**
 * Match uploaded contact phone numbers to Synq users.
 * Client sends normalized E.164 phones; hashes stay server-side.
 */
exports.matchContacts = onCall(
  { region: "us-central1", secrets: ["PHONE_LOOKUP_SECRET"] },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Must be logged in.");
    }
    const myId = String(request.auth.uid || "").trim();
    const db = admin.firestore();

    // Per-chunk calls; client caches scans for 30m so reopening the sheet does not hit this.
    await assertCallableRateLimit(db, myId, "matchContacts", 60 * 60 * 1000, 60);

    const rawPhones = Array.isArray(request.data?.phones) ? request.data.phones : [];
    if (rawPhones.length === 0) {
      return { users: [] };
    }
    if (rawPhones.length > 150) {
      throw new HttpsError(
        "invalid-argument",
        "Too many phone numbers. Send at most 150 per request."
      );
    }

    // Ensure caller's own hash is present when they have an Auth phone.
    try {
      await upsertPhoneHashForUid(myId);
    } catch (syncErr) {
      logWarn("matchContacts_sync_self", { myId, message: syncErr?.message });
    }

    const normalized = [];
    const seenPhone = new Set();
    for (const raw of rawPhones) {
      const e164 = normalizePhoneE164(raw);
      if (!e164 || seenPhone.has(e164)) continue;
      seenPhone.add(e164);
      normalized.push(e164);
    }

    const myFriendsSnap = await db.collection("users").doc(myId).collection("friends").get();
    const exclude = new Set([myId, ...myFriendsSnap.docs.map((d) => d.id)]);

    const users = [];
    const seenUid = new Set();

    // Batch get hash docs (Firestore getAll max 100 / call — chunk).
    const hashEntries = normalized
      .map((phone) => ({ phone, hash: hashPhoneE164(phone) }))
      .filter((e) => e.hash);

    for (let i = 0; i < hashEntries.length; i += 100) {
      const chunk = hashEntries.slice(i, i + 100);
      const refs = chunk.map((e) => db.collection(PHONE_HASHES).doc(e.hash));
      const hashSnaps = await db.getAll(...refs);
      const phoneByUid = new Map();
      for (let j = 0; j < hashSnaps.length; j += 1) {
        const snap = hashSnaps[j];
        if (!snap.exists) continue;
        const uid = String(snap.data()?.uid || "").trim();
        if (!uid || exclude.has(uid) || seenUid.has(uid)) continue;
        seenUid.add(uid);
        phoneByUid.set(uid, chunk[j].phone);
      }
      if (phoneByUid.size === 0) continue;

      const userRefs = [...phoneByUid.keys()].map((uid) => db.collection("users").doc(uid));
      const userSnaps = await db.getAll(...userRefs);
      for (const userSnap of userSnaps) {
        if (!userSnap.exists) continue;
        const fields = publicUserFields(userSnap);
        users.push(
          discoveryUserPayload(fields, {
            phone: phoneByUid.get(userSnap.id) || null,
          })
        );
      }
    }

    users.sort((a, b) =>
      String(a.displayName || "").localeCompare(String(b.displayName || ""))
    );
    return { users };
  }
);

/** Public city/interests preview for profiles the client cannot fully read yet. */
exports.getPublicProfilePreview = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Must be logged in.");
    }
    const myId = String(request.auth.uid || "").trim();
    const uid = String(request.data?.uid || "").trim();
    if (!uid) {
      throw new HttpsError("invalid-argument", "Missing profile id.");
    }
    if (uid === myId) {
      throw new HttpsError("invalid-argument", "Cannot preview your own profile.");
    }

    const db = admin.firestore();
    await assertCallableRateLimit(db, myId, "getPublicProfilePreview", 60 * 1000, 40);

    const snap = await db.collection("users").doc(uid).get();
    if (!snap.exists) {
      throw new HttpsError("not-found", "Profile not found.");
    }
    return { user: discoveryUserPayload(publicUserFields(snap)) };
  }
);

/** Keep phoneHashes in sync when a phone Auth user is created. */
const functionsV1 = require("firebase-functions/v1");
exports.onAuthUserCreatedPhoneHash = functionsV1
  .runWith({ secrets: ["PHONE_LOOKUP_SECRET"] })
  .auth.user()
  .onCreate(async (user) => {
    try {
      if (!user?.uid || !user.phoneNumber) return;
      await upsertPhoneHashForUid(user.uid);
    } catch (err) {
      logError("onAuthUserCreatedPhoneHash", err, { uid: user?.uid });
    }
  });

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
      return { ok: true, status: "already_friends", fromUid };
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
      return { ok: true, status: "request_exists", fromUid };
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
    return { ok: true, status: "request_created", fromUid };
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

        if (reengagement) {
            void reengagement.enqueueFriendRequestReminder(userId, requestId);
        }

        await axios.post("https://exp.host/--/api/v2/push/send", {
            to: token,
            sound: "default",
            title: "New Synq request",
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
            title: "Community invite",
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

/** Notify community admin when a member submits a post for approval. */
exports.onCommunityGroupPostCreated = onDocumentCreated(
  {
    document: "communityGroups/{groupId}/posts/{postId}",
    region: "us-central1",
  },
  async (event) => {
    const post = event.data?.data();
    if (!post) return;
    if (String(post.status || "").trim() !== "pending") return;

    const { groupId, postId } = event.params;
    const authorId = String(post.authorId || "").trim();
    const authorName =
      String(post.authorDisplayName || "").trim() || "A member";
    const preview = String(post.body || "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 80);

    try {
      const db = admin.firestore();
      const groupSnap = await db.collection("communityGroups").doc(groupId).get();
      if (!groupSnap.exists) return;
      const group = groupSnap.data() || {};
      const creatorId = String(group.creatorId || "").trim();
      const groupName = String(group.name || "").trim() || "your community";
      if (!creatorId || creatorId === authorId) return;

      const notifId = `community_post_approval_${groupId}_${postId}`.slice(0, 1400);
      await writeInAppNotification(creatorId, notifId, {
        type: "community_post_approval",
        fromUserId: authorId,
        groupId,
        postId,
        groupName,
        title: "Please review a post",
        body: `${authorName} submitted a post in ${groupName}`,
        postPreview: preview || null,
      });

      const adminSnap = await db.collection("users").doc(creatorId).get();
      const token = adminSnap.data()?.pushToken;
      if (!token) return;

      let authorPushToken = null;
      if (authorId) {
        const authorSnap = await db.collection("users").doc(authorId).get();
        authorPushToken = authorSnap.data()?.pushToken || null;
      }
      if (authorPushToken && token === authorPushToken) {
        logWarn("onCommunityGroupPostCreated_skip_same_device_token", {
          groupId,
          postId,
          creatorId,
          authorId,
        });
        return;
      }

      await axios.post("https://exp.host/--/api/v2/push/send", {
        to: token,
        sound: "default",
        title: "Please review a post",
        body: `${authorName} submitted a post in ${groupName}`,
        data: {
          type: "community_post_approval",
          groupId: String(groupId),
          postId: String(postId),
          fromUserId: authorId || undefined,
        },
      });
    } catch (error) {
      logError("onCommunityGroupPostCreated", error, { groupId, postId });
    }
  }
);

/** Notify author when a post is approved/rejected; clear admin approval notifications. */
exports.onCommunityGroupPostReviewed = onDocumentUpdated(
  {
    document: "communityGroups/{groupId}/posts/{postId}",
    region: "us-central1",
  },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;
    const prevStatus = String(before.status || "").trim();
    const nextStatus = String(after.status || "").trim();
    if (prevStatus !== "pending") return;
    if (nextStatus !== "approved" && nextStatus !== "rejected") return;

    const { groupId, postId } = event.params;
    const authorId = String(after.authorId || "").trim();
    const db = admin.firestore();

    try {
      const groupSnap = await db.collection("communityGroups").doc(groupId).get();
      const group = groupSnap.exists ? groupSnap.data() || {} : {};
      const creatorId = String(group.creatorId || "").trim();
      const groupName = String(group.name || "").trim() || "your community";

      const approvalNotifId = `community_post_approval_${groupId}_${postId}`.slice(
        0,
        1400
      );
      if (creatorId) {
        await db
          .collection("users")
          .doc(creatorId)
          .collection("notifications")
          .doc(approvalNotifId)
          .delete()
          .catch(() => {});
      }

      if (!authorId || authorId === creatorId) {
        if (nextStatus === "rejected") {
          await event.data.after.ref.delete().catch(() => {});
        }
        return;
      }

      const notifId = `community_post_${nextStatus}_${groupId}_${postId}`.slice(
        0,
        1400
      );
      const approved = nextStatus === "approved";
      await writeInAppNotification(authorId, notifId, {
        type: approved ? "community_post_approved" : "community_post_rejected",
        fromUserId: creatorId || null,
        groupId,
        postId,
        groupName,
        title: approved ? "Post approved" : "Post not approved",
        body: approved
          ? `Your post is now live in ${groupName}.`
          : `Your post in ${groupName} was not approved.`,
      });

      const authorSnap = await db.collection("users").doc(authorId).get();
      const token = authorSnap.data()?.pushToken;
      if (token) {
        await axios.post("https://exp.host/--/api/v2/push/send", {
          to: token,
          sound: "default",
          title: approved ? "Post approved" : "Post not approved",
          body: approved
            ? `Your post is now live in ${groupName}.`
            : `Your post in ${groupName} was not approved.`,
          data: {
            type: approved
              ? "community_post_approved"
              : "community_post_rejected",
            groupId: String(groupId),
            postId: String(postId),
          },
        });
      }

      if (nextStatus === "rejected") {
        await event.data.after.ref.delete().catch(() => {});
      }
    } catch (error) {
      logError("onCommunityGroupPostReviewed", error, { groupId, postId });
    }
  }
);

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

/** True when Firestore still says available but the 12h window (or startedAt) has lapsed. */
function isAvailableButExpired(userData) {
  if (!userData || typeof userData !== "object") return false;
  if (String(userData.status || "").trim().toLowerCase() !== "available") return false;
  return !isSynqActive(userData);
}

/**
 * Expire-on-read: clear stale `available` rows so raw status queries stay honest
 * between scheduled expireStaleSynq runs.
 */
async function expireSynqOnRead(db, uid, userData) {
  if (!uid || !isAvailableButExpired(userData)) return false;
  try {
    await db.collection("users").doc(uid).update({
      status: "inactive",
      memo: "",
      ...synqBroadcastClearFields,
    });
    logInfo("expireSynqOnRead", { uid });
    return true;
  } catch (e) {
    logError("expireSynqOnRead", e, { uid });
    return false;
  }
}

const { isRecipientInSynqVisibleTo } = require("./synqBroadcastCore");

const synqBroadcastClearFields = {
  synqBroadcastMode: admin.firestore.FieldValue.delete(),
  synqBroadcastGroupIds: admin.firestore.FieldValue.delete(),
  synqVisibleTo: admin.firestore.FieldValue.delete(),
};

reengagement = createReengagement({
  admin,
  axios,
  onSchedule,
  isSynqActive,
  writeInAppNotification,
  logError,
  logWarn,
  logInfo,
});
exports.processReengagementQueue = reengagement.processReengagementQueue;
exports.runPrimeTimeReengagement = reengagement.runPrimeTimeReengagement;

/**
 * Deactivates Synq for users past the window (server-side, no app open required).
 * Indexed query only — legacy full scans removed to avoid thousands of reads/run.
 */
exports.expireStaleSynq = onSchedule(
  {
    schedule: "every 30 minutes",
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
    } catch (e) {
      logError("expireStaleSynq", e, {});
    }
  }
);

/**
 * Propagate open-plan interest, host field edits (title/time/location), and cascade plan deletions.
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
          ? `${firstNameFromDisplay(joinerName)} is going to your plan ${planTitle}`
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
      title: "Request accepted! ✨",
      body: `${accepterData?.displayName || "A user"} added you on Synq`,
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
      title: "Request accepted! ✨",
      body: `${accepterData?.displayName || "A user"} added you on Synq`,
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
    await expireSynqOnRead(db, callerUid, callerData);
    throw new HttpsError("failed-precondition", "Activate Synq first to ask if a friend is free.");
  }

  if (isSynqActive(recipientData)) {
    throw new HttpsError("failed-precondition", "This friend is already active.");
  }
  await expireSynqOnRead(db, toUserId, recipientData);

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
  const planTitleHint = String(request.data?.planTitle || "").trim();
  const planDateHint = String(request.data?.planDate || "").trim();
  const planTimeHint = String(request.data?.planTime || "").trim();
  const planLocationHint = String(request.data?.planLocation || "").trim();
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
  let hostPlan = hostEvents.find((e) => String(e?.id || "").trim() === eventId);
  if (!hostPlan && planTitleHint && planDateHint) {
    const idx = findHostPlanIndex(
      hostEvents,
      {
        title: planTitleHint,
        date: planDateHint,
        time: planTimeHint,
        location: planLocationHint,
        planHostUid: hostUid,
      },
      hostUid
    );
    if (idx >= 0) hostPlan = hostEvents[idx];
  }
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
    if (idx === -1 && planTitleHint && planDateHint) {
      const hintIdx = findHostPlanIndex(
        events,
        {
          title: planTitleHint,
          date: planDateHint,
          time: planTimeHint,
          location: planLocationHint,
          planHostUid: hostUid,
        },
        hostUid
      );
      if (hintIdx >= 0) {
        const row = { ...(events[hintIdx] || {}) };
        if (!String(row.id || "").trim()) row.id = eventId;
        if (!String(row.planHostUid || "").trim()) row.planHostUid = hostUid;
        events[hintIdx] = row;
      }
    }
    const resolvedIdx =
      idx >= 0
        ? idx
        : events.findIndex((e) => String(e?.id || "").trim() === eventId);
    let planIdx = resolvedIdx;
    if (planIdx === -1 && planTitleHint && planDateHint) {
      planIdx = findHostPlanIndex(
        events,
        {
          title: planTitleHint,
          date: planDateHint,
          time: planTimeHint,
          location: planLocationHint,
          planHostUid: hostUid,
        },
        hostUid
      );
    }
    if (planIdx === -1) return;
    const plan = { ...(events[planIdx] || {}) };
    if (!String(plan.id || "").trim()) plan.id = eventId;
    if (!String(plan.planHostUid || "").trim()) plan.planHostUid = hostUid;
    const nextInvited = collectInvitedIds(plan);
    nextInvited.add(toUserId);
    plan.planInvitedIds = [...nextInvited];
    events[planIdx] = plan;
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
    if (wasActive === isActive) {
      // Status still "available" but past window — heal on this write path.
      if (isAvailableButExpired(after)) {
        await expireSynqOnRead(admin.firestore(), activatedUserId, after);
      }
      return;
    }

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

        // Tell currently-active friends to drop this user from their Synq list immediately.
        const deactivatedPushToken = before?.pushToken || after?.pushToken || null;
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
          // Audience was based on their visibility while active (before).
          if (!isRecipientInSynqVisibleTo(recipientId, before)) continue;
          if (deactivatedPushToken && recipientToken === deactivatedPushToken) continue;

          try {
            await axios.post("https://exp.host/--/api/v2/push/send", {
              to: recipientToken,
              priority: "high",
              data: {
                type: "friend_synq_inactive",
                fromUserId: activatedUserId,
              },
            });
          } catch (pushErr) {
            logError("onFriendSynqActivated_inactive_push", pushErr, {
              activatedUserId,
              recipientId,
            });
          }
        }
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
        if (!isRecipientInSynqVisibleTo(recipientId, after)) continue;

        if (!isSynqActive(friendData)) {
          await expireSynqOnRead(admin.firestore(), recipientId, friendData);
          // Inactive recipients: maybe queue “N of your friends are free” (2+).
          if (reengagement && recipientToken) {
            if (activatedPushToken && recipientToken === activatedPushToken) {
              logWarn("onFriendSynqActivated_skip_same_device_token_inactive", {
                activatedUserId,
                recipientId,
              });
            } else {
              void reengagement.maybeEnqueueFriendsFreeDigest(recipientId, friendData);
            }
          }
          continue;
        }

        if (!recipientToken) continue;

        const synqBody = `${firstNameFromDisplay(activatedName)} is free`;
        // Always mirror in-app so active clients can discover activations in
        // realtime even when Expo push is delayed, missing, or same-device.
        try {
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
        } catch (notifErr) {
          logError("onFriendSynqActivated_notif", notifErr, {
            activatedUserId,
            recipientId,
          });
        }

        if (activatedPushToken && recipientToken === activatedPushToken) {
          logWarn("onFriendSynqActivated_skip_same_device_token", {
            activatedUserId,
            recipientId,
          });
          continue;
        }

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
const AI_SUGGESTIONS_PUBLIC_ENABLED = false;

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
            const { GoogleGenerativeAI } = require("@google/generative-ai");
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
    AI_SUGGESTIONS_PUBLIC_ENABLED
        ? {
              secrets: ["GEMINI_API_KEY", "GOOGLE_MAPS_API_KEY"],
              region: "us-central1",
              invoker: "public",
              timeoutSeconds: 120,
              memory: "512MiB",
          }
        : {
              region: "us-central1",
              invoker: "public",
              timeoutSeconds: 10,
              memory: "256MiB",
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

            const uid = String(request.auth.uid || "").trim();
            const db = admin.firestore();
            await assertCallableRateLimit(
                db,
                uid,
                "synqSuggestions",
                60 * 60 * 1000,
                12
            );

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