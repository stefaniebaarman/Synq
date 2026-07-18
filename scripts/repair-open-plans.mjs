/**
 * Repair open-plan host + roster across all user calendars.
 *
 * For each title|date|time|location cluster:
 * - Infer host from copies with no joinedFromFriendUid, else majority via, else earliest id
 * - Set planHostUid on every copy
 * - Union roster ids/names/attendeeDisplayNames
 * - Clear joinedFromFriendUid on the host copy; set it on joiners
 *
 * Usage:
 *   node scripts/repair-open-plans.mjs
 *   node scripts/repair-open-plans.mjs --apply
 *   node scripts/repair-open-plans.mjs --title "Happy Hour" --apply
 */
import { getFirebaseCliAccessToken } from "./lib/firebase-cli-access-token.mjs";

const PROJECT_ID = "new-synq-main";

function parseArgs(argv) {
  let apply = false;
  let title = "";
  let location = "";
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--apply") apply = true;
    else if (arg === "--title") title = String(argv[++i] || "").trim();
    else if (arg === "--location") location = String(argv[++i] || "").trim();
    else if (arg.startsWith("-")) throw new Error(`Unknown flag: ${arg}`);
  }
  return { apply, title, location };
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
    return (value.arrayValue?.values || []).map((item) => fromFirestoreValue(item));
  }
  if ("mapValue" in value) {
    const out = {};
    for (const [key, nested] of Object.entries(value.mapValue?.fields || {})) {
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
  throw new Error(`Unsupported type: ${typeof value}`);
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function eventClusterKey(e) {
  return [
    normalize(e?.title),
    String(e?.date || "").trim(),
    normalize(e?.time),
    normalize(e?.location),
  ].join("|");
}

function collectIds(e) {
  return [
    ...(Array.isArray(e?.joinedFromIds) ? e.joinedFromIds : []),
    e?.joinedFromId,
  ]
    .map((id) => String(id || "").trim())
    .filter(Boolean);
}

async function firestoreRequest(accessToken, path, options = {}) {
  const base = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
  const url = path.startsWith("http") ? path : `${base}/${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Firestore ${res.status}: ${await res.text()}`);
  }
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
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
    body: JSON.stringify({ fields: { events: toFirestoreValue(events) } }),
  });
}

function inferHost(copies) {
  // Prefer the copy with no joinedFromFriendUid whose uid owns that doc.
  const creators = copies.filter((c) => !String(c.event?.joinedFromFriendUid || "").trim());
  if (creators.length === 1) return creators[0].uid;

  // Majority joinedFromFriendUid among joiners.
  const viaCounts = new Map();
  for (const c of copies) {
    const via = String(c.event?.joinedFromFriendUid || "").trim();
    if (!via) continue;
    viaCounts.set(via, (viaCounts.get(via) || 0) + 1);
  }
  let bestVia = "";
  let bestCount = 0;
  for (const [via, count] of viaCounts) {
    if (count > bestCount) {
      bestVia = via;
      bestCount = count;
    }
  }
  if (bestVia && copies.some((c) => c.uid === bestVia)) return bestVia;

  // Earliest numeric/timestamp id owner.
  const sorted = [...copies].sort((a, b) =>
    String(a.event?.id || "").localeCompare(String(b.event?.id || ""))
  );
  return sorted[0]?.uid || "";
}

function matchesFilters(event, opts) {
  if (opts.title && !normalize(event?.title).includes(normalize(opts.title))) return false;
  if (opts.location && !normalize(event?.location).includes(normalize(opts.location))) {
    return false;
  }
  return true;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const accessToken = await getFirebaseCliAccessToken();
  console.log(opts.apply ? "APPLY mode" : "Dry-run mode (pass --apply to write)");

  const users = await fetchAllUsers(accessToken);
  /** @type {Map<string, { uid: string, displayName: string, events: any[], event: any, index: number }[]>} */
  const clusters = new Map();
  /** @type {Map<string, { uid: string, displayName: string, events: any[] }>} */
  const userState = new Map();
  const nameByUid = new Map();

  for (const doc of users) {
    const uid = docIdFromName(doc.name);
    const displayName = String(fromFirestoreValue(doc.fields?.displayName) || "").trim() || uid;
    nameByUid.set(uid, displayName);
    const events = Array.isArray(fromFirestoreValue(doc.fields?.events))
      ? fromFirestoreValue(doc.fields.events)
      : [];
    userState.set(uid, { uid, displayName, events: events.map((e) => ({ ...e })) });

    events.forEach((event, index) => {
      if (!String(event?.title || "").trim() || !String(event?.date || "").trim()) return;
      if (!matchesFilters(event, opts)) return;
      const key = eventClusterKey(event);
      if (!key.startsWith("|") && normalize(event.title)) {
        if (!clusters.has(key)) clusters.set(key, []);
        clusters.get(key).push({ uid, displayName, events, event, index });
      }
    });
  }

  let clusterFixes = 0;
  /** @type {Set<string>} */
  const dirtyUsers = new Set();

  for (const [key, copies] of clusters) {
    if (copies.length < 1) continue;
    const hostUid = inferHost(copies);
    if (!hostUid) continue;

    const roster = new Set();
    const displayNames = {};
    for (const c of copies) {
      roster.add(c.uid);
      for (const id of collectIds(c.event)) roster.add(id);
      const map = c.event?.attendeeDisplayNames;
      if (map && typeof map === "object") {
        for (const [id, name] of Object.entries(map)) {
          if (id && name) displayNames[id] = String(name).trim();
        }
      }
    }
    for (const id of roster) {
      if (!displayNames[id] && nameByUid.has(id)) displayNames[id] = nameByUid.get(id);
    }

    const orderedRoster = [
      hostUid,
      ...[...roster].filter((id) => id !== hostUid).sort(),
    ];
    const sample = copies[0].event;
    console.log(
      `\nPlan: ${sample.title} | ${sample.date} ${sample.time || ""} | ${sample.location || ""}`
    );
    console.log(`  host → ${nameByUid.get(hostUid) || hostUid} (${hostUid})`);
    console.log(`  roster → ${orderedRoster.map((id) => nameByUid.get(id) || id).join(", ")}`);

    let changed = false;
    for (const c of copies) {
      const user = userState.get(c.uid);
      if (!user) continue;
      const row = user.events.find((e) => String(e?.id || "") === String(c.event?.id || ""));
      if (!row) continue;

      const prevHost = String(row.planHostUid || "").trim();
      const prevVia = String(row.joinedFromFriendUid || "").trim();
      const prevIds = collectIds(row).slice().sort().join("|");
      const nextIds = orderedRoster.slice().sort().join("|");
      const isHostDoc = c.uid === hostUid;

      row.planHostUid = hostUid;
      row.joinedFromIds = orderedRoster;
      row.joinedFromId = isHostDoc ? hostUid : orderedRoster.find((id) => id !== c.uid) || hostUid;
      const otherNames = orderedRoster
        .filter((id) => id !== c.uid)
        .map((id) => displayNames[id])
        .filter(Boolean);
      row.joinedFromNames = otherNames;
      row.joinedFromName = otherNames.join(", ");
      row.attendeeDisplayNames = { ...displayNames };
      if (isHostDoc) {
        delete row.joinedFromFriendUid;
      } else if (!String(row.joinedFromFriendUid || "").trim()) {
        row.joinedFromFriendUid = hostUid;
      } else if (String(row.joinedFromFriendUid).trim() === c.uid) {
        row.joinedFromFriendUid = hostUid;
      }

      const nextHost = String(row.planHostUid || "").trim();
      const nextVia = String(row.joinedFromFriendUid || "").trim();
      if (prevHost !== nextHost || prevVia !== nextVia || prevIds !== nextIds) {
        changed = true;
        dirtyUsers.add(c.uid);
        console.log(
          `  fix ${c.displayName}: host ${prevHost || "(none)"}→${nextHost}` +
            (prevVia !== nextVia ? ` via ${prevVia || "(none)"}→${nextVia || "(none)"}` : "")
        );
      }
    }
    if (changed) clusterFixes += 1;
  }

  console.log(`\n${clusterFixes} plan cluster(s) need repairs; ${dirtyUsers.size} user doc(s).`);

  if (!opts.apply) {
    console.log("Re-run with --apply to write.");
    return;
  }

  for (const uid of dirtyUsers) {
    const user = userState.get(uid);
    if (!user) continue;
    await patchUserEvents(accessToken, uid, user.events);
    console.log(`Updated ${user.displayName} (${uid})`);
  }

  // Touch host docs even if unchanged so clients get a fresh snapshot.
  const stefanie = "6Z2Zw6PATyPAQzixSK97CKybReS2";
  const blake = "kMDfIsn1UTco6l8v9eXtl6EvxHh2";
  const william = "6Hx5KOXbIqeXDe1GDbFoOSBqZsG2";
  for (const uid of [stefanie, blake, william]) {
    if (dirtyUsers.has(uid)) continue;
    const user = userState.get(uid);
    if (!user) continue;
    await patchUserEvents(accessToken, uid, user.events);
    console.log(`Touched ${user.displayName} for snapshot refresh`);
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
