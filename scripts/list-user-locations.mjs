/**
 * List every user and their location.
 *
 * Uses Firebase CLI login — no service account file.
 *
 * Usage (from repo root, after `firebase login`):
 *   node scripts/list-user-locations.mjs
 */
import { getFirebaseCliAccessToken } from "./lib/firebase-cli-access-token.mjs";

const PROJECT_ID = "new-synq-main";

function fieldString(fields, key) {
  const value = fields?.[key];
  if (!value) return "";
  if (typeof value.stringValue === "string") return value.stringValue.trim();
  return "";
}

function docIdFromName(name) {
  const parts = String(name || "").split("/");
  return parts[parts.length - 1] || "";
}

function formatLocation(city, state, locationDisplay) {
  if (locationDisplay) return locationDisplay;
  if (!city) return "";
  return state ? `${city}, ${state}` : city;
}

function formatDisplayName(fields) {
  const displayName = fieldString(fields, "displayName");
  if (displayName) return displayName;
  const firstName = fieldString(fields, "firstName");
  const lastName = fieldString(fields, "lastName");
  return [firstName, lastName].filter(Boolean).join(" ");
}

async function fetchAllUsers(accessToken) {
  const users = [];
  let pageToken = "";

  do {
    const url = new URL(
      `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users`
    );
    url.searchParams.set("pageSize", "300");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Firestore query failed (${res.status}): ${text}`);
    }

    const data = await res.json();
    if (Array.isArray(data.documents)) {
      users.push(...data.documents);
    }
    pageToken = data.nextPageToken || "";
  } while (pageToken);

  return users;
}

const accessToken = await getFirebaseCliAccessToken();
const documents = await fetchAllUsers(accessToken);

const rows = documents.map((doc) => {
  const fields = doc.fields || {};
  const uid = docIdFromName(doc.name);
  const name = formatDisplayName(fields) || "(no name)";
  const location = formatLocation(
    fieldString(fields, "city"),
    fieldString(fields, "state"),
    fieldString(fields, "locationDisplay")
  );
  return {
    uid,
    name,
    location: location || "(none)",
    hasLocation: Boolean(location),
  };
});

rows.sort((a, b) => {
  if (a.hasLocation !== b.hasLocation) return a.hasLocation ? -1 : 1;
  const byLocation = a.location.localeCompare(b.location);
  if (byLocation !== 0) return byLocation;
  return a.name.localeCompare(b.name);
});

const withLocation = rows.filter((r) => r.hasLocation).length;
const withoutLocation = rows.length - withLocation;

console.log(`Total users: ${rows.length}`);
console.log(`With location: ${withLocation}`);
console.log(`Without location: ${withoutLocation}`);
console.log("");
console.log("Name | Location | UID");
console.log("---------------------");

for (const row of rows) {
  console.log(`${row.name} | ${row.location} | ${row.uid}`);
}
