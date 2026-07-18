/**
 * Find open plans matching title/location and optionally rewrite planHostUid
 * on every matching copy (host + joiners).
 *
 * Uses Firebase CLI login — no service account file.
 *
 * Usage (from repo root, after `firebase login`):
 *   node scripts/fix-open-plan-host.mjs --title "Happy Hour" --location "Wood"
 *   node scripts/fix-open-plan-host.mjs --title "Happy Hour" --location "Wood" --host-uid <UID> --apply
 *   node scripts/fix-open-plan-host.mjs --title "Happy Hour" --location "Wood" --host-name Stefanie --apply
 */
import { getFirebaseCliAccessToken } from "./lib/firebase-cli-access-token.mjs";

const PROJECT_ID = "new-synq-main";

function parseArgs(argv) {
  let apply = false;
  let title = "Happy Hour";
  let location = "Wood";
  let hostUid = "";
  let hostName = "";

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
    if (arg === "--host-uid") {
      hostUid = String(argv[++i] || "").trim();
      continue;
    }
    if (arg === "--host-name") {
      hostName = String(argv[++i] || "").trim();
      continue;
    }
    if (arg.startsWith("-")) {
      throw new Error(`Unknown flag: ${arg}`);
    }
  }

  return { apply, title, location, hostUid, hostName };
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

function normalizeMatchText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function planMatches(event, { title, location }) {
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

async function firestoreRequest(accessToken, path, options = {}) {
  const base = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
  const url = path.startsWith("http")
    ? path
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
    url.searchParams.append("mask.fieldPaths", "events");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const data = await firestoreRequest(accessToken, url.toString());
    if (Array.isArray(data.documents)) users.push(...data.documents);
    pageToken = data.nextPageToken || "";
  } while (pageToken);

  return users;
}

async function patchUserEvents(accessToken, uid, events) {
  await firestoreRequest(accessToken, `users/${uid}?updateMask.fieldPaths=events`, {
    method: "PATCH",
    body: JSON.stringify({
      fields: {
        events: toFirestoreValue(events),
      },
    }),
  });
}

function summarizeEvent(event, uid, displayName) {
  const ids = [
    ...(Array.isArray(event?.joinedFromIds) ? event.joinedFromIds : []),
    event?.joinedFromId,
  ]
    .map((id) => String(id || "").trim())
    .filter(Boolean);
  return {
    uid,
    displayName,
    id: String(event?.id || "").trim() || "(no id)",
    title: String(event?.title || "").trim(),
    date: String(event?.date || "").trim(),
    time: String(event?.time || "").trim(),
    location: String(event?.location || "").trim(),
    planHostUid: String(event?.planHostUid || "").trim() || "(none)",
    joinedFromFriendUid: String(event?.joinedFromFriendUid || "").trim() || "(none)",
    joinedFromIds: [...new Set(ids)],
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const accessToken = await getFirebaseCliAccessToken();

  console.log(
    opts.apply
      ? "APPLY mode — matching planHostUid values will be rewritten."
      : "Dry-run mode — no writes. Pass --apply with --host-uid or --host-name to fix."
  );
  console.log(`Match: title~"${opts.title}" location~"${opts.location}"\n`);

  const users = await fetchAllUsers(accessToken);
  /** @type {Array<{ uid: string, displayName: string, events: any[], matches: any[] }>} */
  const hits = [];

  for (const doc of users) {
    const uid = docIdFromName(doc.name);
    const fields = doc.fields || {};
    const displayName = String(fromFirestoreValue(fields.displayName) || "").trim() || "(no name)";
    const events = Array.isArray(fromFirestoreValue(fields.events))
      ? fromFirestoreValue(fields.events)
      : [];
    const matches = events.filter((e) => planMatches(e, opts));
    if (matches.length === 0) continue;
    hits.push({ uid, displayName, events, matches });
  }

  if (hits.length === 0) {
    console.log("No matching plans found.");
    return;
  }

  console.log(`Found ${hits.length} user(s) with matching plan copies:\n`);
  for (const hit of hits) {
    console.log(`- ${hit.displayName} (${hit.uid})`);
    for (const event of hit.matches) {
      const s = summarizeEvent(event, hit.uid, hit.displayName);
      console.log(
        `    ${s.id} | ${s.date} ${s.time} | ${s.location} | host=${s.planHostUid} | via=${s.joinedFromFriendUid} | roster=[${s.joinedFromIds.join(", ")}]`
      );
    }
  }

  let resolvedHostUid = opts.hostUid;
  if (!resolvedHostUid && opts.hostName) {
    const needle = normalizeMatchText(opts.hostName);
    const nameHits = hits.filter((h) =>
      normalizeMatchText(h.displayName).includes(needle)
    );
    if (nameHits.length === 1) {
      resolvedHostUid = nameHits[0].uid;
    } else if (nameHits.length === 0) {
      // Also search all users for the host name even if their copy wasn't matched oddly
      for (const doc of users) {
        const uid = docIdFromName(doc.name);
        const displayName = String(fromFirestoreValue(doc.fields?.displayName) || "").trim();
        if (normalizeMatchText(displayName).includes(needle)) {
          if (resolvedHostUid && resolvedHostUid !== uid) {
            throw new Error(
              `Multiple users match --host-name "${opts.hostName}". Pass --host-uid instead.`
            );
          }
          resolvedHostUid = uid;
        }
      }
    } else {
      throw new Error(
        `Multiple matching plan owners match --host-name "${opts.hostName}". Pass --host-uid instead.`
      );
    }
  }

  if (!opts.apply) {
    if (resolvedHostUid) {
      console.log(`\nWould set planHostUid → ${resolvedHostUid} on all matching copies.`);
    } else {
      console.log(
        "\nTo repair, re-run with --host-name Stefanie (or --host-uid <uid>) and --apply."
      );
    }
    return;
  }

  if (!resolvedHostUid) {
    throw new Error("APPLY requires --host-uid or --host-name");
  }

  console.log(`\nRewriting planHostUid → ${resolvedHostUid}...\n`);
  let updatedUsers = 0;
  for (const hit of hits) {
    let changed = false;
    const nextEvents = hit.events.map((event) => {
      if (!planMatches(event, opts)) return event;
      const prev = String(event?.planHostUid || "").trim();
      if (prev === resolvedHostUid) return event;
      changed = true;
      const updated = { ...event, planHostUid: resolvedHostUid };
      if (hit.uid === resolvedHostUid) {
        delete updated.joinedFromFriendUid;
      } else if (!String(updated.joinedFromFriendUid || "").trim()) {
        updated.joinedFromFriendUid = resolvedHostUid;
      }
      return updated;
    });
    if (!changed) continue;
    await patchUserEvents(accessToken, hit.uid, nextEvents);
    updatedUsers += 1;
    console.log(`Updated ${hit.displayName} (${hit.uid})`);
  }

  console.log(`\nDone. Updated ${updatedUsers} user doc(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
