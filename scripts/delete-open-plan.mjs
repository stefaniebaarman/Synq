/**
 * Find and delete a corrupted/shared open plan from every user events array
 * (and related plan invite / interest notifications).
 *
 * Uses Firebase CLI login — no service account file.
 *
 * Defaults target: title "Happy Hour" + location containing "Lulu"
 *
 * Usage (from repo root, after `firebase login`):
 *   node scripts/delete-open-plan.mjs
 *   node scripts/delete-open-plan.mjs --apply
 *   node scripts/delete-open-plan.mjs --title "Happy Hour" --location "Lulu" --apply
 *   node scripts/delete-open-plan.mjs --event-id "abc123" --apply
 */
import { getFirebaseCliAccessToken } from "./lib/firebase-cli-access-token.mjs";

const PROJECT_ID = "new-synq-main";

function parseArgs(argv) {
  let apply = false;
  let title = "Happy Hour";
  let location = "Lulu";
  /** @type {string[]} */
  const eventIds = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--apply") {
      apply = true;
      continue;
    }
    if (arg === "--title") {
      title = String(argv[++i] || "").trim() || title;
      continue;
    }
    if (arg === "--location") {
      location = String(argv[++i] || "").trim() || location;
      continue;
    }
    if (arg === "--event-id") {
      const id = String(argv[++i] || "").trim();
      if (id) eventIds.push(id);
      continue;
    }
    if (arg.startsWith("-")) {
      throw new Error(`Unknown flag: ${arg}`);
    }
  }

  return { apply, title, location, eventIds };
}

function docIdFromName(name) {
  const parts = String(name || "").split("/");
  return parts[parts.length - 1] || "";
}

function fromFirestoreValue(value) {
  if (!value || typeof value !== "object") return null;
  if ("nullValue" in value) return null;
  if ("stringValue" in value) return String(value.stringValue);
  if ("booleanValue" in value) return Boolean(value.booleanValue);
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("timestampValue" in value) return String(value.timestampValue);
  if ("arrayValue" in value) {
    const values = Array.isArray(value.arrayValue?.values)
      ? value.arrayValue.values
      : [];
    return values.map((item) => fromFirestoreValue(item));
  }
  if ("mapValue" in value) {
    const fields = value.mapValue?.fields || {};
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const [key, nested] of Object.entries(fields)) {
      out[key] = fromFirestoreValue(nested);
    }
    return out;
  }
  return null;
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
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map((item) => toFirestoreValue(item)) } };
  }
  if (typeof value === "object") {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value).map(([key, nested]) => [key, toFirestoreValue(nested)])
        ),
      },
    };
  }
  throw new Error(`Unsupported Firestore value type: ${typeof value}`);
}

function fieldString(fields, key) {
  const value = fromFirestoreValue(fields?.[key]);
  return typeof value === "string" ? value.trim() : "";
}

function normalizeMatchText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function planMatches(event, { title, location, eventIds }) {
  const id = String(event?.id || "").trim();
  if (id && eventIds.includes(id)) return true;

  const titleNeedle = normalizeMatchText(title);
  const locationNeedle = normalizeMatchText(location);
  const eventTitle = normalizeMatchText(event?.title);
  const eventLocation = normalizeMatchText(event?.location);

  const titleOk = titleNeedle
    ? eventTitle === titleNeedle || eventTitle.includes(titleNeedle)
    : true;
  const locationOk = locationNeedle
    ? eventLocation.includes(locationNeedle)
    : true;

  return titleOk && locationOk;
}

function notificationMatches(data, { title, location, eventIds }) {
  const type = String(data?.type || "").trim();
  const planRelated =
    type === "plan_invite" ||
    type === "open_plan_interest" ||
    type === "community_plan_join";
  if (!planRelated && !data?.planTitle && !data?.eventId) return false;

  const eventId = String(data?.eventId || "").trim();
  if (eventId && eventIds.includes(eventId)) return true;

  const planTitle = normalizeMatchText(data?.planTitle || data?.title);
  const body = normalizeMatchText(data?.body);
  const titleNeedle = normalizeMatchText(title);
  const locationNeedle = normalizeMatchText(location);

  const titleHit = titleNeedle
    ? planTitle.includes(titleNeedle) || body.includes(titleNeedle)
    : false;
  const locationHit = locationNeedle
    ? planTitle.includes(locationNeedle) || body.includes(locationNeedle)
    : false;

  if (titleNeedle && locationNeedle) return titleHit && locationHit;
  return titleHit || locationHit;
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
  const text = await res.text();
  if (!text) return null;
  return JSON.parse(text);
}

async function fetchAllUsers(accessToken) {
  const users = [];
  let pageToken = "";

  do {
    const url = new URL(
      `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users`
    );
    url.searchParams.set("pageSize", "300");
    url.searchParams.append("mask.fieldPaths", "displayName");
    url.searchParams.append("mask.fieldPaths", "email");
    url.searchParams.append("mask.fieldPaths", "events");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const data = await firestoreRequest(accessToken, url.toString());
    if (Array.isArray(data.documents)) users.push(...data.documents);
    pageToken = data.nextPageToken || "";
  } while (pageToken);

  return users;
}

async function listSubcollectionDocs(accessToken, uid, subcollection) {
  const docs = [];
  let pageToken = "";

  do {
    const url = new URL(
      `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}/${subcollection}`
    );
    url.searchParams.set("pageSize", "300");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const data = await firestoreRequest(accessToken, url.toString());
    if (Array.isArray(data.documents)) docs.push(...data.documents);
    pageToken = data.nextPageToken || "";
  } while (pageToken);

  return docs;
}

async function patchUserEvents(accessToken, uid, events) {
  await firestoreRequest(
    accessToken,
    `users/${uid}?updateMask.fieldPaths=events`,
    {
      method: "PATCH",
      body: JSON.stringify({
        fields: {
          events: toFirestoreValue(events),
        },
      }),
    }
  );
}

async function deleteDocByName(accessToken, docName) {
  const prefix = `projects/${PROJECT_ID}/databases/(default)/documents/`;
  const path = String(docName || "").startsWith(prefix)
    ? String(docName).slice(prefix.length)
    : String(docName || "");
  if (!path) return;
  await firestoreRequest(accessToken, path, { method: "DELETE" });
}

function summarizeEvent(event) {
  return {
    id: String(event?.id || "").trim() || "(no id)",
    title: String(event?.title || "").trim(),
    date: String(event?.date || "").trim(),
    time: String(event?.time || "").trim(),
    location: String(event?.location || "").trim(),
    planHostUid: String(event?.planHostUid || "").trim() || "(none)",
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const accessToken = await getFirebaseCliAccessToken();

  console.log(
    opts.apply
      ? "APPLY mode — matching plans will be deleted."
      : "Dry-run mode — no writes. Pass --apply to delete."
  );
  console.log(
    `Match: title~"${opts.title}" location~"${opts.location}"` +
      (opts.eventIds.length ? ` eventIds=${opts.eventIds.join(",")}` : "")
  );
  console.log("");

  const users = await fetchAllUsers(accessToken);
  console.log(`Scanned ${users.length} user docs.`);

  /** @type {string[]} */
  const discoveredEventIds = [...opts.eventIds];
  /** @type {{ uid: string, displayName: string, email: string, removed: ReturnType<typeof summarizeEvent>[], nextEvents: any[] }[]} */
  const userHits = [];

  for (const doc of users) {
    const uid = docIdFromName(doc.name);
    if (!uid) continue;
    const fields = doc.fields || {};
    const displayName = fieldString(fields, "displayName") || uid;
    const email = fieldString(fields, "email");
    const events = fromFirestoreValue(fields.events);
    if (!Array.isArray(events) || events.length === 0) continue;

    const kept = [];
    const removed = [];
    for (const event of events) {
      if (planMatches(event, opts)) {
        removed.push(summarizeEvent(event));
        const id = String(event?.id || "").trim();
        if (id && !discoveredEventIds.includes(id)) discoveredEventIds.push(id);
      } else {
        kept.push(event);
      }
    }

    if (removed.length > 0) {
      userHits.push({
        uid,
        displayName,
        email,
        removed,
        nextEvents: kept,
      });
    }
  }

  // Second pass: if we discovered event ids, also remove rows that share those ids
  // but missed title/location (attribution drift).
  if (discoveredEventIds.length > opts.eventIds.length) {
    const idSet = new Set(discoveredEventIds);
    for (const doc of users) {
      const uid = docIdFromName(doc.name);
      if (!uid) continue;
      if (userHits.some((hit) => hit.uid === uid)) continue;
      const fields = doc.fields || {};
      const events = fromFirestoreValue(fields.events);
      if (!Array.isArray(events) || events.length === 0) continue;

      const kept = [];
      const removed = [];
      for (const event of events) {
        const id = String(event?.id || "").trim();
        if (id && idSet.has(id)) {
          removed.push(summarizeEvent(event));
        } else {
          kept.push(event);
        }
      }
      if (removed.length > 0) {
        userHits.push({
          uid,
          displayName: fieldString(fields, "displayName") || uid,
          email: fieldString(fields, "email"),
          removed,
          nextEvents: kept,
        });
      }
    }
  }

  console.log("");
  console.log(`Users with matching events: ${userHits.length}`);
  console.log(`Discovered event ids: ${discoveredEventIds.join(", ") || "(none)"}`);
  console.log("");

  for (const hit of userHits) {
    console.log(`• ${hit.displayName} (${hit.uid})${hit.email ? ` <${hit.email}>` : ""}`);
    for (const event of hit.removed) {
      console.log(
        `    - remove ${event.id} | ${event.title} | ${event.date} ${event.time} | ${event.location} | host=${event.planHostUid}`
      );
    }
  }

  /** @type {{ uid: string, path: string, id: string, type: string, planTitle: string }[]} */
  const notifHits = [];
  const notifOpts = { ...opts, eventIds: discoveredEventIds };
  const notifScanUids = new Set(userHits.map((hit) => hit.uid));

  // Include invitee / joiner / host uids referenced on matching events.
  for (const doc of users) {
    const uid = docIdFromName(doc.name);
    if (!uid) continue;
    const events = fromFirestoreValue(doc.fields?.events);
    if (!Array.isArray(events)) continue;
    for (const event of events) {
      if (!planMatches(event, { ...opts, eventIds: discoveredEventIds })) continue;
      for (const key of ["joinedFromId", "joinedFromFriendUid", "planHostUid"]) {
        const id = String(event?.[key] || "").trim();
        if (id) notifScanUids.add(id);
      }
      for (const key of ["joinedFromIds", "planInvitedIds"]) {
        const arr = Array.isArray(event?.[key]) ? event[key] : [];
        for (const id of arr) {
          const uid2 = String(id || "").trim();
          if (uid2) notifScanUids.add(uid2);
        }
      }
    }
  }

  for (const uid of notifScanUids) {
    for (const sub of ["notifications", "notificationLocks"]) {
      const docs = await listSubcollectionDocs(accessToken, uid, sub);
      for (const nDoc of docs) {
        const data =
          fromFirestoreValue({ mapValue: { fields: nDoc.fields || {} } }) || {};
        if (!notificationMatches(data, notifOpts)) continue;
        notifHits.push({
          uid,
          path: nDoc.name,
          id: docIdFromName(nDoc.name),
          type: String(data.type || ""),
          planTitle: String(data.planTitle || data.title || ""),
        });
      }
    }
  }

  console.log("");
  console.log(`Related notifications/locks: ${notifHits.length}`);
  for (const n of notifHits.slice(0, 40)) {
    console.log(`• ${n.uid}/${n.id} type=${n.type || "?"} title=${n.planTitle || "(none)"}`);
  }
  if (notifHits.length > 40) {
    console.log(`  …and ${notifHits.length - 40} more`);
  }

  if (!opts.apply) {
    console.log("");
    console.log("Dry-run complete. Re-run with --apply to delete these.");
    return;
  }

  console.log("");
  console.log("Applying deletes…");

  let usersUpdated = 0;
  for (const hit of userHits) {
    await patchUserEvents(accessToken, hit.uid, hit.nextEvents);
    usersUpdated++;
    console.log(`✓ updated events for ${hit.displayName} (${hit.uid})`);
  }

  let notifsDeleted = 0;
  for (const n of notifHits) {
    await deleteDocByName(accessToken, n.path);
    notifsDeleted++;
  }

  console.log("");
  console.log(`Done. Updated ${usersUpdated} user(s), deleted ${notifsDeleted} notification doc(s).`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
