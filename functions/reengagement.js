/**
 * Sparse re-engagement pushes for inactive users:
 * - friends_free_digest (2+ free friends)
 * - friend_request_reminder
 * - prime_time
 */

const { isRecipientInSynqVisibleTo } = require("./synqBroadcastCore");

const QUEUE_COLLECTION = "reengagementQueue";

const TYPE_FRIENDS_FREE = "friends_free_digest";
const TYPE_REQUEST_REMINDER = "friend_request_reminder";
const TYPE_PRIME_TIME = "prime_time";

const GLOBAL_COOLDOWN_MS = 72 * 60 * 60 * 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const WEEKLY_CAP = 2;
const FRIENDS_FREE_COOLDOWN_MS = 4 * 24 * 60 * 60 * 1000;
const PRIME_TIME_COOLDOWN_MS = 10 * 24 * 60 * 60 * 1000;
/** Start low; raise after watching opt-outs / volume. */
const PRIME_TIME_PROBABILITY = 0.05;
const PRIME_TIME_BATCH = 200;

const FRIENDS_FREE_DELAY_MIN_MS = 10 * 60 * 1000;
const FRIENDS_FREE_DELAY_MAX_MS = 50 * 60 * 1000;
const REQUEST_REMINDER_DELAY_MIN_MS = 18 * 60 * 60 * 1000;
const REQUEST_REMINDER_DELAY_MAX_MS = 48 * 60 * 60 * 1000;

function randomBetween(minMs, maxMs) {
  const lo = Math.min(minMs, maxMs);
  const hi = Math.max(minMs, maxMs);
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function tsToMillis(t) {
  if (!t) return null;
  if (typeof t.toMillis === "function") return t.toMillis();
  if (typeof t._seconds === "number") return t._seconds * 1000;
  if (typeof t.seconds === "number") return t.seconds * 1000;
  return null;
}

/**
 * Pure gate for anti-annoyance caps.
 * @returns {{ ok: boolean, reason?: string }}
 */
function evaluateReengagementGate(reengagement, type, now = Date.now()) {
  const state = reengagement && typeof reengagement === "object" ? reengagement : {};
  const lastAt = tsToMillis(state.lastAt) ?? (typeof state.lastAt === "number" ? state.lastAt : null);
  if (lastAt != null && now - lastAt < GLOBAL_COOLDOWN_MS) {
    return { ok: false, reason: "global_cooldown" };
  }

  let weekStartedAt =
    tsToMillis(state.weekStartedAt) ??
    (typeof state.weekStartedAt === "number" ? state.weekStartedAt : null);
  let weekCount = Number(state.weekCount) || 0;
  if (weekStartedAt == null || now - weekStartedAt >= WEEK_MS) {
    weekStartedAt = now;
    weekCount = 0;
  }
  if (weekCount >= WEEKLY_CAP) {
    return { ok: false, reason: "weekly_cap" };
  }

  if (type === TYPE_FRIENDS_FREE) {
    const lastFriendsFreeAt =
      tsToMillis(state.lastFriendsFreeAt) ??
      (typeof state.lastFriendsFreeAt === "number" ? state.lastFriendsFreeAt : null);
    if (lastFriendsFreeAt != null && now - lastFriendsFreeAt < FRIENDS_FREE_COOLDOWN_MS) {
      return { ok: false, reason: "friends_free_cooldown" };
    }
  }

  if (type === TYPE_PRIME_TIME) {
    const lastPrimeTimeAt =
      tsToMillis(state.lastPrimeTimeAt) ??
      (typeof state.lastPrimeTimeAt === "number" ? state.lastPrimeTimeAt : null);
    if (lastPrimeTimeAt != null && now - lastPrimeTimeAt < PRIME_TIME_COOLDOWN_MS) {
      return { ok: false, reason: "prime_time_cooldown" };
    }
  }

  return { ok: true };
}

/** Build next reengagement map fields (plain millis for tests; callers convert to Timestamp). */
function nextReengagementPlainState(prev, type, now = Date.now()) {
  const state = prev && typeof prev === "object" ? { ...prev } : {};
  let weekStartedAt =
    tsToMillis(state.weekStartedAt) ??
    (typeof state.weekStartedAt === "number" ? state.weekStartedAt : null);
  let weekCount = Number(state.weekCount) || 0;
  if (weekStartedAt == null || now - weekStartedAt >= WEEK_MS) {
    weekStartedAt = now;
    weekCount = 0;
  }
  weekCount += 1;

  const out = {
    lastAt: now,
    weekStartedAt,
    weekCount,
  };
  if (type === TYPE_FRIENDS_FREE) out.lastFriendsFreeAt = now;
  else if (typeof state.lastFriendsFreeAt === "number") out.lastFriendsFreeAt = state.lastFriendsFreeAt;
  else if (state.lastFriendsFreeAt) out.lastFriendsFreeAt = tsToMillis(state.lastFriendsFreeAt);

  if (type === TYPE_PRIME_TIME) out.lastPrimeTimeAt = now;
  else if (typeof state.lastPrimeTimeAt === "number") out.lastPrimeTimeAt = state.lastPrimeTimeAt;
  else if (state.lastPrimeTimeAt) out.lastPrimeTimeAt = tsToMillis(state.lastPrimeTimeAt);

  return out;
}

function createReengagement(deps) {
  const {
    admin,
    axios,
    onSchedule,
    isSynqActive,
    writeInAppNotification,
    logError,
    logWarn,
    logInfo,
  } = deps;

  const db = () => admin.firestore();

  function requestReminderLockId(fromUserId) {
    return `friend_request_reminder_${String(fromUserId || "").trim()}`.slice(0, 1400);
  }

  async function sendExpoPush({ to, title, body, data }) {
    await axios.post("https://exp.host/--/api/v2/push/send", {
      to,
      sound: "default",
      title,
      body,
      data,
    });
  }

  async function readReengagementState(uid) {
    const snap = await db().collection("users").doc(uid).get();
    if (!snap.exists) return { userData: null, reengagement: {} };
    const userData = snap.data() || {};
    return {
      userData,
      reengagement:
        userData.reengagement && typeof userData.reengagement === "object"
          ? userData.reengagement
          : {},
    };
  }

  async function claimReengagementSlot(uid, type) {
    const userRef = db().collection("users").doc(uid);
    return db().runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      if (!snap.exists) return { claimed: false, reason: "missing_user" };
      const userData = snap.data() || {};
      const reengagement =
        userData.reengagement && typeof userData.reengagement === "object"
          ? userData.reengagement
          : {};
      const gate = evaluateReengagementGate(reengagement, type);
      if (!gate.ok) return { claimed: false, reason: gate.reason, userData };

      const now = Date.now();
      const plain = nextReengagementPlainState(reengagement, type, now);
      const next = {
        lastAt: admin.firestore.Timestamp.fromMillis(plain.lastAt),
        weekStartedAt: admin.firestore.Timestamp.fromMillis(plain.weekStartedAt),
        weekCount: plain.weekCount,
      };
      if (plain.lastFriendsFreeAt != null) {
        next.lastFriendsFreeAt = admin.firestore.Timestamp.fromMillis(plain.lastFriendsFreeAt);
      }
      if (plain.lastPrimeTimeAt != null) {
        next.lastPrimeTimeAt = admin.firestore.Timestamp.fromMillis(plain.lastPrimeTimeAt);
      }

      tx.set(userRef, { reengagement: next }, { merge: true });
      return { claimed: true, userData };
    });
  }

  async function hasPendingJob(recipientUid, type) {
    const snap = await db()
      .collection(QUEUE_COLLECTION)
      .where("recipientUid", "==", recipientUid)
      .where("type", "==", type)
      .where("status", "==", "pending")
      .limit(1)
      .get();
    return !snap.empty;
  }

  async function enqueueJob(fields) {
    const ref = db().collection(QUEUE_COLLECTION).doc();
    await ref.set({
      ...fields,
      status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return ref.id;
  }

  async function markJob(jobRef, status, extra = {}) {
    await jobRef.set(
      {
        status,
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
        ...extra,
      },
      { merge: true }
    );
  }

  async function countFreeFriendsVisibleTo(recipientUid) {
    const friendsSnap = await db()
      .collection("users")
      .doc(recipientUid)
      .collection("friends")
      .get();
    if (friendsSnap.empty) return 0;

    const friendIds = friendsSnap.docs.map((d) => String(d.id || "").trim()).filter(Boolean);
    let count = 0;
    const chunkSize = 100;
    for (let i = 0; i < friendIds.length; i += chunkSize) {
      const chunk = friendIds.slice(i, i + chunkSize);
      const refs = chunk.map((id) => db().collection("users").doc(id));
      const docs = await db().getAll(...refs);
      for (const friendDoc of docs) {
        if (!friendDoc.exists) continue;
        const data = friendDoc.data() || {};
        if (!isSynqActive(data)) continue;
        if (!isRecipientInSynqVisibleTo(recipientUid, data)) continue;
        count += 1;
      }
    }
    return count;
  }

  async function userHasAnyFriend(uid) {
    const snap = await db().collection("users").doc(uid).collection("friends").limit(1).get();
    return !snap.empty;
  }

  /**
   * When a friend activates Synq, maybe queue a 2+ digest for an inactive recipient.
   */
  async function maybeEnqueueFriendsFreeDigest(recipientUid, recipientData) {
    try {
      if (!recipientUid) return;
      if (isSynqActive(recipientData)) return;
      const token = recipientData?.pushToken;
      if (!token) return;

      const gate = evaluateReengagementGate(recipientData?.reengagement, TYPE_FRIENDS_FREE);
      if (!gate.ok) return;
      if (await hasPendingJob(recipientUid, TYPE_FRIENDS_FREE)) return;

      const count = await countFreeFriendsVisibleTo(recipientUid);
      if (count < 2) return;

      const delayMs = randomBetween(FRIENDS_FREE_DELAY_MIN_MS, FRIENDS_FREE_DELAY_MAX_MS);
      const sendAfter = admin.firestore.Timestamp.fromMillis(Date.now() + delayMs);
      await enqueueJob({
        type: TYPE_FRIENDS_FREE,
        recipientUid,
        sendAfter,
        freeCountAtEnqueue: count,
      });
      logInfo("reengagement_enqueue_friends_free", { recipientUid, count, delayMs });
    } catch (err) {
      logError("maybeEnqueueFriendsFreeDigest", err, { recipientUid });
    }
  }

  async function enqueueFriendRequestReminder(recipientUid, fromUserId) {
    try {
      if (!recipientUid || !fromUserId) return;
      const delayMs = randomBetween(
        REQUEST_REMINDER_DELAY_MIN_MS,
        REQUEST_REMINDER_DELAY_MAX_MS
      );
      const sendAfter = admin.firestore.Timestamp.fromMillis(Date.now() + delayMs);
      await enqueueJob({
        type: TYPE_REQUEST_REMINDER,
        recipientUid,
        fromUserId: String(fromUserId),
        sendAfter,
      });
      logInfo("reengagement_enqueue_request_reminder", {
        recipientUid,
        fromUserId,
        delayMs,
      });
    } catch (err) {
      logError("enqueueFriendRequestReminder", err, { recipientUid, fromUserId });
    }
  }

  async function processFriendsFreeJob(jobRef, job) {
    const recipientUid = String(job.recipientUid || "").trim();
    if (!recipientUid) {
      await markJob(jobRef, "skipped", { reason: "missing_recipient" });
      return;
    }

    const { userData } = await readReengagementState(recipientUid);
    if (!userData) {
      await markJob(jobRef, "skipped", { reason: "missing_user" });
      return;
    }
    if (isSynqActive(userData)) {
      await markJob(jobRef, "skipped", { reason: "now_active" });
      return;
    }
    const token = userData.pushToken;
    if (!token) {
      await markJob(jobRef, "skipped", { reason: "no_token" });
      return;
    }

    const count = await countFreeFriendsVisibleTo(recipientUid);
    if (count < 2) {
      await markJob(jobRef, "skipped", { reason: "below_threshold", freeCount: count });
      return;
    }

    const claim = await claimReengagementSlot(recipientUid, TYPE_FRIENDS_FREE);
    if (!claim.claimed) {
      await markJob(jobRef, "skipped", { reason: claim.reason || "cooldown" });
      return;
    }

    const body = `${count} of your friends are free — see who`;
    try {
      await sendExpoPush({
        to: token,
        title: "Synq",
        body,
        data: {
          type: TYPE_FRIENDS_FREE,
          count: String(count),
        },
      });
    } catch (pushErr) {
      logError("reengagement_friends_free_push", pushErr, { recipientUid });
      await markJob(jobRef, "failed", { reason: "push_error" });
      return;
    }

    try {
      await writeInAppNotification(recipientUid, `friends_free_${Date.now()}`.slice(0, 1400), {
        type: TYPE_FRIENDS_FREE,
        title: "Synq",
        body,
        count,
      });
    } catch (notifErr) {
      logWarn("reengagement_friends_free_inapp", { message: notifErr?.message, recipientUid });
    }

    await markJob(jobRef, "sent", { freeCount: count });
    logInfo("reengagement_sent_friends_free", { recipientUid, count });
  }

  async function processRequestReminderJob(jobRef, job) {
    const recipientUid = String(job.recipientUid || "").trim();
    const fromUserId = String(job.fromUserId || "").trim();
    if (!recipientUid || !fromUserId) {
      await markJob(jobRef, "skipped", { reason: "missing_ids" });
      return;
    }

    const requestRef = db()
      .collection("users")
      .doc(recipientUid)
      .collection("friendRequests")
      .doc(fromUserId);
    const requestSnap = await requestRef.get();
    if (!requestSnap.exists) {
      await markJob(jobRef, "skipped", { reason: "request_gone" });
      return;
    }

    const lockRef = db()
      .collection("users")
      .doc(recipientUid)
      .collection("notificationLocks")
      .doc(requestReminderLockId(fromUserId));
    const lockSnap = await lockRef.get();
    if (lockSnap.exists) {
      await markJob(jobRef, "skipped", { reason: "already_reminded" });
      return;
    }

    const { userData } = await readReengagementState(recipientUid);
    if (!userData) {
      await markJob(jobRef, "skipped", { reason: "missing_user" });
      return;
    }
    const token = userData.pushToken;
    if (!token) {
      await markJob(jobRef, "skipped", { reason: "no_token" });
      return;
    }

    const claim = await claimReengagementSlot(recipientUid, TYPE_REQUEST_REMINDER);
    if (!claim.claimed) {
      await markJob(jobRef, "skipped", { reason: claim.reason || "cooldown" });
      return;
    }

    const body = "You have a Synq request waiting";
    try {
      await sendExpoPush({
        to: token,
        title: "Synq",
        body,
        data: {
          type: TYPE_REQUEST_REMINDER,
          fromUserId,
        },
      });
    } catch (pushErr) {
      logError("reengagement_request_reminder_push", pushErr, { recipientUid, fromUserId });
      await markJob(jobRef, "failed", { reason: "push_error" });
      return;
    }

    await lockRef.set({
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      type: TYPE_REQUEST_REMINDER,
      fromUserId,
    });

    await markJob(jobRef, "sent");
    logInfo("reengagement_sent_request_reminder", { recipientUid, fromUserId });
  }

  async function processReengagementQueueHandler() {
    const nowTs = admin.firestore.Timestamp.now();
    const snap = await db()
      .collection(QUEUE_COLLECTION)
      .where("status", "==", "pending")
      .where("sendAfter", "<=", nowTs)
      .orderBy("sendAfter", "asc")
      .limit(80)
      .get();

    if (snap.empty) return;

    for (const docSnap of snap.docs) {
      const job = docSnap.data() || {};
      const type = String(job.type || "");
      try {
        // Claim job so overlapping schedulers don't double-send.
        const claimed = await db().runTransaction(async (tx) => {
          const fresh = await tx.get(docSnap.ref);
          if (!fresh.exists) return false;
          if (String(fresh.data()?.status || "") !== "pending") return false;
          tx.update(docSnap.ref, { status: "processing" });
          return true;
        });
        if (!claimed) continue;

        if (type === TYPE_FRIENDS_FREE) {
          await processFriendsFreeJob(docSnap.ref, job);
        } else if (type === TYPE_REQUEST_REMINDER) {
          await processRequestReminderJob(docSnap.ref, job);
        } else {
          await markJob(docSnap.ref, "skipped", { reason: "unknown_type" });
        }
      } catch (err) {
        logError("processReengagementQueue_job", err, {
          jobId: docSnap.id,
          type,
        });
        await markJob(docSnap.ref, "failed", { reason: "exception" }).catch(() => {});
      }
    }
  }

  async function runPrimeTimeReengagementHandler() {
    const startId = db().collection("users").doc().id;
    const fieldId = admin.firestore.FieldPath.documentId();

    async function fetchInactiveBatch(startAtId, limit) {
      let q = db()
        .collection("users")
        .where("status", "==", "inactive")
        .orderBy(fieldId)
        .limit(limit);
      if (startAtId) q = q.startAt(startAtId);
      return q.get();
    }

    let snap = await fetchInactiveBatch(startId, PRIME_TIME_BATCH);
    if (snap.size < Math.min(50, PRIME_TIME_BATCH)) {
      const wrap = await fetchInactiveBatch(null, PRIME_TIME_BATCH - snap.size);
      const seen = new Set(snap.docs.map((d) => d.id));
      const extra = wrap.docs.filter((d) => !seen.has(d.id));
      snap = { docs: [...snap.docs, ...extra], empty: snap.empty && wrap.empty, size: snap.size + extra.length };
    }

    let sent = 0;
    let considered = 0;

    for (const userDoc of snap.docs) {
      const userData = userDoc.data() || {};
      const uid = userDoc.id;
      if (!userData.pushToken) continue;
      if (isSynqActive(userData)) continue;
      if (Math.random() >= PRIME_TIME_PROBABILITY) continue;

      considered += 1;
      const gate = evaluateReengagementGate(userData.reengagement, TYPE_PRIME_TIME);
      if (!gate.ok) continue;

      try {
        if (!(await userHasAnyFriend(uid))) continue;

        const claim = await claimReengagementSlot(uid, TYPE_PRIME_TIME);
        if (!claim.claimed) continue;

        const body = "Prime time — tap Synq if you're free";
        await sendExpoPush({
          to: userData.pushToken,
          title: "Synq",
          body,
          data: { type: TYPE_PRIME_TIME },
        });
        sent += 1;
        logInfo("reengagement_sent_prime_time", { uid });
      } catch (err) {
        logError("runPrimeTimeReengagement_user", err, { uid });
      }
    }

    logInfo("runPrimeTimeReengagement_done", {
      batch: snap.size,
      considered,
      sent,
    });
  }

  const processReengagementQueue = onSchedule(
    {
      schedule: "every 15 minutes",
      region: "us-central1",
      timeZone: "Etc/UTC",
    },
    async () => {
      try {
        await processReengagementQueueHandler();
      } catch (err) {
        logError("processReengagementQueue", err, {});
      }
    }
  );

  const runPrimeTimeReengagement = onSchedule(
    {
      schedule: "every 2 hours",
      region: "us-central1",
      timeZone: "Etc/UTC",
    },
    async () => {
      try {
        await runPrimeTimeReengagementHandler();
      } catch (err) {
        logError("runPrimeTimeReengagement", err, {});
      }
    }
  );

  return {
    maybeEnqueueFriendsFreeDigest,
    enqueueFriendRequestReminder,
    processReengagementQueue,
    runPrimeTimeReengagement,
    // test / ops hooks
    evaluateReengagementGate,
    countFreeFriendsVisibleTo,
    TYPE_FRIENDS_FREE,
    TYPE_REQUEST_REMINDER,
    TYPE_PRIME_TIME,
  };
}

module.exports = {
  createReengagement,
  evaluateReengagementGate,
  nextReengagementPlainState,
  randomBetween,
  TYPE_FRIENDS_FREE,
  TYPE_REQUEST_REMINDER,
  TYPE_PRIME_TIME,
  GLOBAL_COOLDOWN_MS,
  WEEK_MS,
  WEEKLY_CAP,
  FRIENDS_FREE_COOLDOWN_MS,
  PRIME_TIME_COOLDOWN_MS,
  PRIME_TIME_PROBABILITY,
};
