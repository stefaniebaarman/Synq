const crypto = require("crypto");
const admin = require("firebase-admin");
const { logWarn } = require("./serverLog");

const PHONE_HASHES = "phoneHashes";

/**
 * Normalize to E.164-ish form used for matching.
 * - Keep leading + and digits.
 * - 10-digit US numbers → +1XXXXXXXXXX (matches primary Synq signup).
 * - 11-digit starting with 1 → +1…
 */
function normalizePhoneE164(raw) {
  const cleaned = String(raw || "").trim();
  if (!cleaned) return null;
  const digits = cleaned.replace(/\D/g, "");
  if (!digits) return null;

  if (cleaned.startsWith("+")) {
    if (digits.length < 8 || digits.length > 15) return null;
    return `+${digits}`;
  }
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return null;
}

function phoneLookupSecret() {
  const secret = String(process.env.PHONE_LOOKUP_SECRET || "").trim();
  if (secret) return secret;
  // Fallback keeps local/dev usable; production must set PHONE_LOOKUP_SECRET.
  return "synq-dev-phone-lookup-secret";
}

function hashPhoneE164(e164) {
  const normalized = normalizePhoneE164(e164);
  if (!normalized) return null;
  return crypto
    .createHmac("sha256", phoneLookupSecret())
    .update(normalized)
    .digest("hex");
}

async function deletePhoneHashesForUid(db, uid) {
  if (!uid) return;
  const snap = await db.collection(PHONE_HASHES).where("uid", "==", uid).get();
  if (snap.empty) return;
  const batch = db.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

/**
 * Upsert phoneHashes/{hash} for this uid. Replaces any prior hashes for the uid.
 * Returns the E.164 phone used, or null if Auth has no phone.
 */
async function upsertPhoneHashForUid(uid) {
  if (!uid) return null;
  const db = admin.firestore();
  let phoneNumber = null;
  try {
    const user = await admin.auth().getUser(uid);
    phoneNumber = user.phoneNumber || null;
  } catch (err) {
    logWarn("upsertPhoneHashForUid_getUser", { uid, message: err?.message });
    return null;
  }

  await deletePhoneHashesForUid(db, uid);

  if (!phoneNumber) return null;

  const e164 = normalizePhoneE164(phoneNumber);
  const hash = hashPhoneE164(e164);
  if (!e164 || !hash) {
    logWarn("upsertPhoneHashForUid_normalize_failed", { uid });
    return null;
  }

  await db.collection(PHONE_HASHES).doc(hash).set(
    {
      uid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  return e164;
}

module.exports = {
  PHONE_HASHES,
  normalizePhoneE164,
  hashPhoneE164,
  deletePhoneHashesForUid,
  upsertPhoneHashForUid,
};
