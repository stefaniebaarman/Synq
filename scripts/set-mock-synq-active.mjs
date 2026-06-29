/**
 * Sets mock user accounts to Synq-active (status: available) without logging in.
 * Requires: firebase login
 *
 * Usage:
 *   node scripts/set-mock-synq-active.mjs
 *   node scripts/set-mock-synq-active.mjs sloane.whitaker@gmail.com leo.vance@gmail.com
 *   node scripts/set-mock-synq-active.mjs --memo "Coffee anyone?"
 *   node scripts/set-mock-synq-active.mjs "sloane.whitaker@gmail.com=Coffee anyone?" "leo.vance@gmail.com=Need to walk my dog!"
 */
import { createRequire } from "module";
import { getFirebaseCliAccessToken } from "./lib/firebase-cli-access-token.mjs";

const require = createRequire(import.meta.url);
const { buildSynqBroadcastFirestorePayload } = require("../src/lib/synqBroadcastCore.js");

const PROJECT_ID = "new-synq-main";
const DEFAULT_EMAILS = ["sloane.whitaker@gmail.com", "leo.vance@gmail.com"];
const DEFAULT_MEMO = "Free for the next few hours!";

function parseArgs(argv) {
  /** @type {{ email: string, memo: string }[]} */
  const accounts = [];
  let defaultMemo = DEFAULT_MEMO;
  let pendingEmail = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--memo") {
      const value = String(argv[++i] || "").trim() || DEFAULT_MEMO;
      if (pendingEmail) {
        accounts.push({ email: pendingEmail, memo: value });
        pendingEmail = null;
      } else {
        defaultMemo = value;
      }
      continue;
    }

    if (arg.startsWith("-")) {
      throw new Error(`Unknown flag: ${arg}`);
    }

    const pairMatch = arg.match(/^([^=]+)=(.+)$/);
    if (pairMatch) {
      accounts.push({
        email: pairMatch[1].trim().toLowerCase(),
        memo: pairMatch[2].trim() || defaultMemo,
      });
      pendingEmail = null;
      continue;
    }

    const email = arg.trim().toLowerCase();
    if (pendingEmail) {
      accounts.push({ email: pendingEmail, memo: defaultMemo });
    }
    pendingEmail = email;
  }

  if (pendingEmail) {
    accounts.push({ email: pendingEmail, memo: defaultMemo });
  }

  return {
    accounts:
      accounts.length > 0
        ? accounts
        : DEFAULT_EMAILS.map((email) => ({ email, memo: defaultMemo })),
  };
}

function toFirestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map((item) => toFirestoreValue(item)) } };
  }
  throw new Error(`Unsupported Firestore value type: ${typeof value}`);
}

function fieldString(fields, key) {
  const value = fields?.[key];
  if (!value || typeof value.stringValue !== "string") return "";
  return value.stringValue.trim();
}

function docIdFromName(name) {
  const parts = String(name || "").split("/");
  return parts[parts.length - 1] || "";
}

async function firestoreRequest(accessToken, path, options = {}) {
  const base = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
  const url = path.startsWith("http")
    ? path
    : path === ":runQuery"
      ? `${base}:runQuery`
      : `${base}/${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore request failed (${res.status}): ${text}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

async function findUserByEmailInFirestore(accessToken, email) {
  const normalized = email.trim().toLowerCase();
  const body = {
    structuredQuery: {
      from: [{ collectionId: "users" }],
      where: {
        fieldFilter: {
          field: { fieldPath: "email" },
          op: "EQUAL",
          value: { stringValue: normalized },
        },
      },
      limit: 1,
    },
  };

  const rows = await firestoreRequest(accessToken, ":runQuery", {
    method: "POST",
    body: JSON.stringify(body),
  });

  const doc = Array.isArray(rows)
    ? rows.map((row) => row.document).find(Boolean)
    : null;

  if (!doc) return null;

  return {
    uid: docIdFromName(doc.name),
    displayName: fieldString(doc.fields, "displayName"),
    email: fieldString(doc.fields, "email") || normalized,
  };
}

async function findUserByEmailInAuth(accessToken, email) {
  const normalized = email.trim().toLowerCase();
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:lookup`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: [normalized] }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Auth lookup failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const user = Array.isArray(data.users) ? data.users[0] : null;
  if (!user?.localId) return null;

  return {
    uid: String(user.localId),
    displayName: String(user.displayName || "").trim(),
    email: String(user.email || normalized).trim().toLowerCase(),
  };
}

async function findUserByEmail(accessToken, email) {
  const fromFirestore = await findUserByEmailInFirestore(accessToken, email);
  if (fromFirestore) return fromFirestore;
  return findUserByEmailInAuth(accessToken, email);
}

async function listFriendIds(accessToken, uid) {
  const friendIds = [];
  let pageToken = "";

  do {
    const url = new URL(
      `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}/friends`
    );
    url.searchParams.set("pageSize", "300");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const data = await firestoreRequest(accessToken, url.toString());
    if (Array.isArray(data.documents)) {
      for (const doc of data.documents) {
        const id = docIdFromName(doc.name);
        if (id) friendIds.push(id);
      }
    }
    pageToken = data.nextPageToken || "";
  } while (pageToken);

  return friendIds;
}

async function setSynqActive(accessToken, uid, { memo, friendIds }) {
  const broadcast = buildSynqBroadcastFirestorePayload(
    { mode: "all", groupIds: [] },
    [],
    friendIds
  );

  const fields = {
    status: "available",
    synqStartedAt: new Date(),
    memo,
    ...broadcast,
  };

  const updateMask = Object.keys(fields)
    .map((field) => `updateMask.fieldPaths=${field}`)
    .join("&");

  const body = {
    fields: Object.fromEntries(
      Object.entries(fields).map(([key, value]) => [key, toFirestoreValue(value)])
    ),
  };

  await firestoreRequest(accessToken, `users/${uid}?${updateMask}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

const { accounts } = parseArgs(process.argv.slice(2));
const accessToken = await getFirebaseCliAccessToken();

console.log(`Setting Synq active for ${accounts.length} account(s)...`);
console.log("");

let ok = 0;
let failed = 0;

for (const { email, memo } of accounts) {
  try {
    const user = await findUserByEmail(accessToken, email);
    if (!user?.uid) {
      console.error(`✗ ${email} — no user found`);
      failed++;
      continue;
    }

    const friendIds = await listFriendIds(accessToken, user.uid);
    await setSynqActive(accessToken, user.uid, { memo, friendIds });

    const label = user.displayName || user.uid;
    console.log(
      `✓ ${email} (${label}) — "${memo}", visible to ${friendIds.length} friend(s)`
    );
    ok++;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`✗ ${email} — ${message}`);
    failed++;
  }
}

console.log("");
console.log(`Done. ${ok} updated, ${failed} failed.`);

if (failed > 0) {
  process.exit(1);
}
