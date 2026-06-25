/**
 * Sets Firestore appConfig/global minimum build numbers for forced updates.
 * Requires: firebase login
 *
 * Usage: node scripts/set-app-config.mjs [minBuild]
 * Example: node scripts/set-app-config.mjs 12
 */
import { getFirebaseCliAccessToken } from "./lib/firebase-cli-access-token.mjs";

const PROJECT_ID = "new-synq-main";

const minBuild = Number(process.argv[2] || "6");
if (!Number.isFinite(minBuild) || minBuild <= 0) {
  console.error("Usage: node scripts/set-app-config.mjs [minBuild]");
  process.exit(1);
}

const accessToken = await getFirebaseCliAccessToken();

const docUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/appConfig/global`;

const body = {
  fields: {
    minIosBuildNumber: { integerValue: String(minBuild) },
    minAndroidVersionCode: { integerValue: String(minBuild) },
    iosStoreUrl: {
      stringValue: "https://apps.apple.com/us/app/synq-see-whos-free/id6757319173",
    },
    androidStoreUrl: {
      stringValue: "https://play.google.com/store/search?q=Synq&c=apps",
    },
    updatedAt: { stringValue: new Date().toISOString() },
  },
};

const updateMask = [
  "minIosBuildNumber",
  "minAndroidVersionCode",
  "iosStoreUrl",
  "androidStoreUrl",
  "updatedAt",
]
  .map((field) => `updateMask.fieldPaths=${field}`)
  .join("&");

const res = await fetch(`${docUrl}?${updateMask}`, {
  method: "PATCH",
  headers: {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
});

if (!res.ok) {
  const text = await res.text();
  if (res.status === 404 || text.includes("NOT_FOUND")) {
    const createUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/appConfig?documentId=global`;
    const createRes = await fetch(createUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!createRes.ok) {
      throw new Error(`Create failed (${createRes.status}): ${await createRes.text()}`);
    }
    console.log(`Created appConfig/global with minimum build ${minBuild}.`);
    process.exit(0);
  }
  throw new Error(`Update failed (${res.status}): ${text}`);
}

console.log(`Updated appConfig/global — minimum native build is now ${minBuild}.`);
