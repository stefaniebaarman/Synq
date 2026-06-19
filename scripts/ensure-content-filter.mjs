import { existsSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const termsPath = join(root, "src/lib/contentFilterTerms.ts");

function loadCommittedTerms() {
  if (!existsSync(termsPath)) {
    console.warn("[ensure-content-filter] missing src/lib/contentFilterTerms.ts");
    return [];
  }
  const source = readFileSync(termsPath, "utf8");
  const match = source.match(/export const BLOCKED_TERMS = \[([\s\S]*?)\]\s*(?:as const)?;/);
  if (!match) {
    console.warn("[ensure-content-filter] could not parse BLOCKED_TERMS from contentFilterTerms.ts");
    return [];
  }
  return [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

const terms = loadCommittedTerms();
const jsPath = join(root, "functions/contentFilter.js");

const termsJs = terms.map((t) => `  "${t.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(",\n");

const jsBody = `/** Server-side content filter (synced from src/lib/contentFilterTerms.ts). */

const BLOCKED_TERMS = [
${termsJs},
];

const LEET_MAP = {
  "@": "a",
  "4": "a",
  "3": "e",
  "1": "i",
  "!": "i",
  "0": "o",
  $: "s",
  "5": "s",
  "7": "t",
};

function normalizeForFilter(input) {
  let s = String(input || "").toLowerCase();
  s = s.replace(/[\\s_\\-.*]+/g, "");
  s = s
    .split("")
    .map((ch) => LEET_MAP[ch] ?? ch)
    .join("");
  s = s.replace(/[^a-z0-9]/g, "");
  return s.replace(/(.)\\1{2,}/g, "$1$1");
}

function containsObjectionableContent(text) {
  const normalized = normalizeForFilter(text);
  if (!normalized) return false;
  return BLOCKED_TERMS.some((term) => normalized.includes(term));
}

function filterOrReject(text) {
  if (containsObjectionableContent(text)) {
    return {
      ok: false,
      reason: "This content isn't allowed on Synq. Please remove offensive language.",
    };
  }
  return { ok: true };
}

module.exports = {
  containsObjectionableContent,
  normalizeForFilter,
  filterOrReject,
};
`;

writeFileSync(jsPath, jsBody);
console.log(`[ensure-content-filter] synced ${terms.length} terms to functions/contentFilter.js`);

if (process.env.EAS_BUILD === "true" && terms.length === 0) {
  console.error(
    "[ensure-content-filter] EAS build aborted: contentFilterTerms.ts is empty. " +
      "Populate the list before running eas build."
  );
  process.exit(1);
}

if (terms.length === 0) {
  console.warn(
    "[ensure-content-filter] WARNING: BLOCKED_TERMS is empty. Populate contentFilterTerms.ts before release."
  );
}
