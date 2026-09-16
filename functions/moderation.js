const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const axios = require("axios");
const { containsObjectionableContent } = (() => {
  try {
    return require("./contentFilter");
  } catch {
    return require("./contentFilter.example");
  }
})();
const { logError, logInfo, logWarn } = require("./serverLog");

const MODERATION_EMAIL_TO = "synqapp@gmail.com";
const MODERATION_SECRETS = ["MODERATION_EMAIL_API_KEY"];

function moderationFromAddress() {
  return process.env.MODERATION_EMAIL_FROM || "Synq Moderation <onboarding@resend.dev>";
}

async function sendModerationEmail(subject, body) {
  const apiKey = process.env.MODERATION_EMAIL_API_KEY;
  if (!apiKey) {
    logWarn("moderation_email_skipped_no_api_key", { subject });
    return false;
  }
  try {
    const res = await axios.post(
      "https://api.resend.com/emails",
      {
        from: moderationFromAddress(),
        to: [MODERATION_EMAIL_TO],
        subject,
        text: body,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
    );
    logInfo("moderation_email_sent", { subject, id: res.data?.id });
    return true;
  } catch (e) {
    const resendMessage =
      e?.response?.data?.message || e?.response?.data?.error || e?.message;
    logError("moderation_email_failed", e, {
      subject,
      to: MODERATION_EMAIL_TO,
      from: moderationFromAddress(),
      resendMessage,
      status: e?.response?.status,
    });
    return false;
  }
}

async function enqueueModerationItem(db, item) {
  const ref = await db.collection("moderationQueue").add({
    status: "open",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    ...item,
  });
  return ref.id;
}

function labelFromProfileFields({ displayName, email, phone, uid }) {
  const parts = [];
  if (displayName) parts.push(displayName);
  if (email) parts.push(email);
  if (phone) parts.push(phone);
  const summary = parts.length ? parts.join(" · ") : "Unknown user";
  return `${summary} (uid: ${uid})`;
}

async function formatUserLabel(db, uid) {
  const id = String(uid || "").trim();
  if (!id) return "—";
  if (id === "system") return "system (automated)";

  try {
    const [docSnap, authUser] = await Promise.all([
      db.collection("users").doc(id).get(),
      admin
        .auth()
        .getUser(id)
        .catch(() => null),
    ]);
    const data = docSnap.exists ? docSnap.data() || {} : {};
    return labelFromProfileFields({
      displayName: String(data.displayName || authUser?.displayName || "").trim(),
      email: String(data.email || authUser?.email || "").trim(),
      phone: String(authUser?.phoneNumber || data.phone || "").trim(),
      uid: id,
    });
  } catch (e) {
    logWarn("moderation_user_lookup_failed", { uid: id, err: String(e?.message || e) });
    return `uid: ${id}`;
  }
}

async function resolveReporterLabel(db, item) {
  const id = String(item.reporterId || "").trim();
  if (!id || id === "system") return formatUserLabel(db, id);

  const name = String(item.reporterName || "").trim();
  const email = String(item.reporterEmail || "").trim();
  const phone = String(item.reporterPhone || "").trim();
  if (name || email || phone) {
    return labelFromProfileFields({
      displayName: name,
      email,
      phone,
      uid: id,
    });
  }
  return formatUserLabel(db, id);
}

function formatReportedUserLabel(reportedUserId) {
  const id = String(reportedUserId || "").trim();
  if (!id) return "—";
  if (id.startsWith("_general")) {
    return "General safety report (no specific profile)";
  }
  return id;
}

function buildDedupeSuffix(reportedUserId, contentType, reason, details, messageId, contentId) {
  if (messageId || contentId) return messageId || contentId;
  // General safety reports (no profile): allow a new open report per reason + details snippet.
  if (String(reportedUserId).startsWith("_general")) {
    const snippet = String(details || "").trim().slice(0, 80);
    return `${reason}:${snippet}`;
  }
  return "";
}

async function notifyModerationQueueItem(db, queueId, item) {
  const reporterLabel = await resolveReporterLabel(db, item);
  const reportedId = item.reportedUserId || "—";
  const reportedLabel = String(reportedId).startsWith("_general")
    ? formatReportedUserLabel(reportedId)
    : await formatUserLabel(db, reportedId);

  logInfo("moderation_notify", { queueId, reporterLabel, reportedLabel });

  const lines = [
    `Queue ID: ${queueId}`,
    `Type: ${item.kind || item.contentType || "unknown"}`,
    `Reporter: ${reporterLabel}`,
    `Reported user: ${reportedLabel}`,
    `Reason: ${item.reason || "—"}`,
    `Content type: ${item.contentType || "—"}`,
    `Chat: ${item.chatId || "—"}`,
    `Message: ${item.messageId || "—"}`,
    ...(item.preview
      ? [`Flagged content: ${item.preview}`]
      : []),
    `Details: ${item.details || "—"}`,
  ];
  return sendModerationEmail(
    `[Synq] Moderation: ${item.kind || item.contentType || "report"}`,
    lines.join("\n")
  );
}

async function removeFriendMutualInternal(db, uid, friendId) {
  const batch = db.batch();
  batch.delete(db.doc(`users/${uid}/friends/${friendId}`));
  batch.delete(db.doc(`users/${friendId}/friends/${uid}`));
  batch.delete(db.doc(`users/${uid}/friendRequests/${friendId}`));
  batch.delete(db.doc(`users/${friendId}/friendRequests/${uid}`));
  batch.delete(db.doc(`users/${uid}/outgoingFriendRequests/${friendId}`));
  batch.delete(db.doc(`users/${friendId}/outgoingFriendRequests/${uid}`));
  await batch.commit();
}

function registerModerationExports() {
  const db = admin.firestore();

  // No secrets on this hot path — enqueue only; scheduled job emails open items.
  const filterMessageOnCreate = onDocumentCreated(
    {
      document: "chats/{chatId}/messages/{messageId}",
      region: "us-central1",
    },
    async (event) => {
      const snap = event.data;
      if (!snap) return;
      const data = snap.data();
      const optionText = Array.isArray(data?.pollOptions)
        ? data.pollOptions.map((option) => String(option || "")).join(" ")
        : "";
      const text = [String(data?.text || ""), optionText].filter(Boolean).join(" ");
      const { chatId, messageId } = event.params;
      const senderId = String(data?.senderId || "").trim();

      if (senderId) {
        try {
          const chatSnap = await db.doc(`chats/${chatId}`).get();
          const participants = Array.isArray(chatSnap.data()?.participants)
            ? chatSnap.data().participants.map((id) => String(id || "").trim()).filter(Boolean)
            : [];
          for (const participantId of participants) {
            if (!participantId || participantId === senderId) continue;
            const blockedSnap = await db
              .doc(`users/${participantId}/blocked/${senderId}`)
              .get();
            if (blockedSnap.exists) {
              await snap.ref.delete();
              logInfo("onMessageBlockedRecipient", { chatId, messageId, senderId, participantId });
              return;
            }
          }
        } catch (e) {
          logWarn("onMessageBlockCheck", { chatId, messageId, err: String(e?.message || e) });
        }
      }

      if (!text || !containsObjectionableContent(text)) return;
      try {
        await snap.ref.delete();
        await enqueueModerationItem(db, {
          kind: "auto_filtered",
          contentType: "message",
          reportedUserId: String(data.senderId || ""),
          reporterId: "system",
          chatId,
          messageId,
          reason: "auto_filter",
          preview: text.slice(0, 200),
          emailPending: true,
        });
        logInfo("onMessageContentFilter_enqueued", { chatId, messageId });
      } catch (e) {
        logError("onMessageContentFilter", e, { chatId, messageId });
      }
    }
  );

  const submitReport = onCall(
    { region: "us-central1", secrets: MODERATION_SECRETS },
    async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in.");
    const reporterId = request.auth.uid;
    const authToken = request.auth.token || {};
    let reporterName = String(authToken.name || "").trim();
    let reporterEmail = String(authToken.email || "").trim();
    let reporterPhone = String(authToken.phone_number || "").trim();
    if (!reporterName || !reporterEmail) {
      try {
        const reporterSnap = await db.collection("users").doc(reporterId).get();
        if (reporterSnap.exists) {
          const profile = reporterSnap.data() || {};
          if (!reporterName) reporterName = String(profile.displayName || "").trim();
          if (!reporterEmail) reporterEmail = String(profile.email || "").trim();
          if (!reporterPhone) reporterPhone = String(profile.phone || "").trim();
        }
      } catch (e) {
        logWarn("submitReport_reporter_profile_lookup", {
          reporterId,
          err: String(e?.message || e),
        });
      }
    }
    const {
      reportedUserId,
      contentType,
      reason,
      details,
      chatId,
      messageId,
      contentId,
    } = request.data || {};

    if (!reportedUserId || !contentType || !reason) {
      throw new HttpsError("invalid-argument", "Missing required report fields.");
    }

    const dedupeKey = `${reporterId}:${reportedUserId}:${contentType}:${buildDedupeSuffix(
      reportedUserId,
      contentType,
      reason,
      details,
      messageId,
      contentId
    )}`;
    const recent = await db
      .collection("moderationQueue")
      .where("dedupeKey", "==", dedupeKey)
      .where("status", "==", "open")
      .limit(1)
      .get();
    if (!recent.empty) {
      logInfo("submitReport_duplicate", {
        queueId: recent.docs[0].id,
        dedupeKey,
      });
      return { ok: true, duplicate: true, queueId: recent.docs[0].id, emailSent: false };
    }

    const queueId = await enqueueModerationItem(db, {
      kind: "user_report",
      reporterId,
      reporterName: reporterName || null,
      reporterEmail: reporterEmail || null,
      reporterPhone: reporterPhone || null,
      reportedUserId,
      contentType,
      reason,
      details: String(details || "").slice(0, 1000),
      chatId: chatId || null,
      messageId: messageId || null,
      contentId: contentId || null,
      dedupeKey,
    });
    const emailSent = await notifyModerationQueueItem(db, queueId, {
      kind: "user_report",
      reporterId,
      reporterName,
      reporterEmail,
      reporterPhone,
      reportedUserId,
      contentType,
      reason,
      details,
      chatId,
      messageId,
    });
    return { ok: true, queueId, emailSent };
    }
  );

  const blockUser = onCall(
    { region: "us-central1", secrets: MODERATION_SECRETS },
    async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in.");
    const blockerId = request.auth.uid;
    const blockedUserId = String(request.data?.blockedUserId || "").trim();
    if (!blockedUserId || blockedUserId === blockerId) {
      throw new HttpsError("invalid-argument", "Invalid user to block.");
    }

    let blockedDisplayName = "User";
    let blockedImageUrl = "";
    try {
      const blockedUserSnap = await db.doc(`users/${blockedUserId}`).get();
      if (blockedUserSnap.exists) {
        const data = blockedUserSnap.data() || {};
        blockedDisplayName =
          String(data.displayName || "").trim() || blockedDisplayName;
        blockedImageUrl = String(data.imageurl || "").trim();
      }
    } catch (e) {
      logWarn("blockUser_lookup", { blockerId, blockedUserId, err: String(e) });
    }

    await db.doc(`users/${blockerId}/blocked/${blockedUserId}`).set({
      blockedAt: admin.firestore.FieldValue.serverTimestamp(),
      source: request.data?.source || "manual",
      displayName: blockedDisplayName,
      ...(blockedImageUrl ? { imageurl: blockedImageUrl } : {}),
    });

    try {
      await removeFriendMutualInternal(db, blockerId, blockedUserId);
    } catch (e) {
      logWarn("blockUser_remove_friend", { blockerId, blockedUserId, err: String(e) });
    }

    const queueId = await enqueueModerationItem(db, {
      kind: "block",
      reporterId: blockerId,
      reportedUserId: blockedUserId,
      contentType: "user",
      reason: "block",
      details: request.data?.details || null,
    });
    await notifyModerationQueueItem(db, queueId, {
      kind: "block",
      reporterId: blockerId,
      reportedUserId: blockedUserId,
      reason: "block",
    });

    return { ok: true, queueId };
    }
  );

  const unblockUser = onCall({ region: "us-central1" }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in.");
    const blockerId = request.auth.uid;
    const blockedUserId = String(request.data?.blockedUserId || "").trim();
    if (!blockedUserId) throw new HttpsError("invalid-argument", "Invalid user.");
    await db.doc(`users/${blockerId}/blocked/${blockedUserId}`).delete();
    return { ok: true };
  });

  /** Resolve names/photos for the caller's blocked list (Admin read; may backfill). */
  const listBlockedUsers = onCall({ region: "us-central1" }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in.");
    const blockerId = request.auth.uid;
    const blockedSnap = await db.collection(`users/${blockerId}/blocked`).get();
    if (blockedSnap.empty) {
      return { users: [] };
    }

    const docs = blockedSnap.docs;
    const ids = docs.map((d) => d.id);
    const userRefs = ids.map((id) => db.doc(`users/${id}`));
    const userSnaps = userRefs.length ? await db.getAll(...userRefs) : [];

    const users = [];
    const batch = db.batch();
    let batchWrites = 0;

    for (let i = 0; i < docs.length; i += 1) {
      const blockedDoc = docs[i];
      const prev = blockedDoc.data() || {};
      const userSnap = userSnaps[i];
      const userData = userSnap?.exists ? userSnap.data() || {} : {};
      const displayName =
        String(userData.displayName || "").trim() ||
        String(prev.displayName || "").trim() ||
        "User";
      const imageurl =
        String(userData.imageurl || "").trim() ||
        String(prev.imageurl || "").trim() ||
        "";

      users.push({
        id: blockedDoc.id,
        displayName,
        ...(imageurl ? { imageurl } : {}),
      });

      if (
        prev.displayName !== displayName ||
        (imageurl && prev.imageurl !== imageurl)
      ) {
        batch.set(
          blockedDoc.ref,
          {
            displayName,
            ...(imageurl ? { imageurl } : {}),
          },
          { merge: true }
        );
        batchWrites += 1;
      }
    }

    if (batchWrites > 0) {
      await batch.commit().catch((e) => {
        logWarn("listBlockedUsers_backfill", { blockerId, err: String(e) });
      });
    }

    users.sort((a, b) =>
      String(a.displayName).localeCompare(String(b.displayName), undefined, {
        sensitivity: "base",
      })
    );
    return { users };
  });

  const moderateContent = onCall({ region: "us-central1" }, async (request) => {
      if (!request.auth?.token?.admin) {
        throw new HttpsError("permission-denied", "Admin only.");
      }
      const { queueId, action, targetUserId, chatId, messageId } = request.data || {};
      if (!action) throw new HttpsError("invalid-argument", "Missing action.");

      if (action === "remove_message" && chatId && messageId) {
        await db.doc(`chats/${chatId}/messages/${messageId}`).delete();
      }

      if (action === "suspend_user" && targetUserId) {
        await db.doc(`users/${targetUserId}`).set(
          { suspended: true, suspendedAt: admin.firestore.FieldValue.serverTimestamp() },
          { merge: true }
        );
      }

      if (action === "dismiss_report" && queueId) {
        await db.doc(`moderationQueue/${queueId}`).set(
          {
            status: "dismissed",
            actionedAt: admin.firestore.FieldValue.serverTimestamp(),
            actionedBy: request.auth.uid,
          },
          { merge: true }
        );
      } else if (queueId) {
        await db.doc(`moderationQueue/${queueId}`).set(
          {
            status: "actioned",
            actionedAt: admin.firestore.FieldValue.serverTimestamp(),
            actionedBy: request.auth.uid,
            action,
          },
          { merge: true }
        );
      }

      return { ok: true };
    }
  );

  const checkOpenModerationReports = onSchedule(
    {
      schedule: "every day 09:00",
      region: "us-central1",
      secrets: MODERATION_SECRETS,
    },
    async () => {
      // Email auto-filtered items that skipped Secret Manager on the hot message path.
      const pendingEmailSnap = await db
        .collection("moderationQueue")
        .where("status", "==", "open")
        .where("emailPending", "==", true)
        .limit(40)
        .get();

      for (const docSnap of pendingEmailSnap.docs) {
        const item = docSnap.data() || {};
        try {
          await notifyModerationQueueItem(db, docSnap.id, item);
          await docSnap.ref.set(
            {
              emailPending: false,
              emailedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        } catch (e) {
          logWarn("checkOpenModerationReports_pending_email", {
            queueId: docSnap.id,
            err: String(e?.message || e),
          });
        }
      }

      const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000);
      const snap = await db
        .collection("moderationQueue")
        .where("status", "==", "open")
        .where("createdAt", "<", cutoff)
        .limit(50)
        .get();

      if (snap.empty) {
        if (!pendingEmailSnap.empty) {
          logInfo("checkOpenModerationReports_pending_emailed", {
            count: pendingEmailSnap.size,
          });
        }
        return;
      }

      const ids = snap.docs.map((d) => d.id).join(", ");
      await sendModerationEmail(
        `[Synq] ${snap.size} moderation item(s) open > 24h`,
        `Review in Firebase Console → moderationQueue.\nIDs: ${ids}`
      );
      logInfo("checkOpenModerationReports_escalation", { count: snap.size });
    }
  );

  const submitFeedback = onCall(
    { region: "us-central1", secrets: MODERATION_SECRETS },
    async (request) => {
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "Must be logged in.");
      }

      const uid = request.auth.uid;
      const authToken = request.auth.token || {};
      const type = String(request.data?.type || "").trim();
      const message = String(request.data?.message || "").trim();
      const platform = String(request.data?.platform || "").trim();

      const allowedTypes = new Set(["Feedback", "Bug", "Feature request", "Other"]);
      if (!allowedTypes.has(type)) {
        throw new HttpsError("invalid-argument", "Invalid feedback type.");
      }
      if (message.length < 10) {
        throw new HttpsError(
          "invalid-argument",
          "Please include at least 10 characters of feedback."
        );
      }
      if (message.length > 4000) {
        throw new HttpsError("invalid-argument", "Feedback is too long.");
      }

      let displayName = String(authToken.name || "").trim();
      let email = String(authToken.email || "").trim();
      let phone = String(authToken.phone_number || "").trim();
      if (!displayName || !email) {
        try {
          const userSnap = await db.collection("users").doc(uid).get();
          if (userSnap.exists) {
            const profile = userSnap.data() || {};
            if (!displayName) {
              displayName = String(profile.displayName || "").trim();
            }
            if (!email) email = String(profile.email || "").trim();
            if (!phone) phone = String(profile.phone || "").trim();
          }
        } catch (e) {
          logWarn("submitFeedback_profile_lookup", {
            uid,
            err: String(e?.message || e),
          });
        }
      }

      const fromLabel = labelFromProfileFields({
        displayName,
        email,
        phone,
        uid,
      });

      const ref = await db.collection("feedback").add({
        uid,
        displayName: displayName || null,
        email: email || null,
        phone: phone || null,
        type,
        message,
        platform: platform || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const emailSent = await sendModerationEmail(
        `[Synq Feedback] ${type}`,
        [
          `From: ${fromLabel}`,
          `Type: ${type}`,
          platform ? `Platform: ${platform}` : null,
          "",
          "Message:",
          message,
          "",
          `Feedback id: ${ref.id}`,
        ]
          .filter((line) => line !== null)
          .join("\n")
      );

      logInfo("submitFeedback_ok", { feedbackId: ref.id, type, emailSent });
      return { ok: true, feedbackId: ref.id, emailSent };
    }
  );

  return {
    filterMessageOnCreate,
    submitReport,
    submitFeedback,
    blockUser,
    unblockUser,
    listBlockedUsers,
    moderateContent,
    checkOpenModerationReports,
  };
}

module.exports = { registerModerationExports };
