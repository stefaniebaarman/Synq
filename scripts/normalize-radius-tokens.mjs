/**
 * Replace hardcoded borderRadius values with design tokens.
 * Mapping: 12→RADIUS_SM, 14→BUTTON_RADIUS, 16→RADIUS_MD,
 * 20→RADIUS_LG, 22→MODAL_RADIUS, 24→RADIUS_XL, 28→RADIUS_2XL
 */
import fs from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", ".expo"]);
const SKIP_FILES = new Set([
  "constants/Variables.ts",
  "scripts/normalize-radius-tokens.mjs",
  "scripts/normalize-ui-tokens.mjs",
]);

const RADIUS_MAP = [
  [28, "RADIUS_2XL"],
  [24, "RADIUS_XL"],
  [22, "MODAL_RADIUS"],
  [20, "RADIUS_LG"],
  [16, "RADIUS_MD"],
  [14, "BUTTON_RADIUS"],
  [12, "RADIUS_SM"],
];

const TOKEN_IMPORT_SOURCES = [
  "@/constants/Variables",
  "../../constants/Variables",
  "../constants/Variables",
  "../../../constants/Variables",
  "../../../../constants/Variables",
  "./Variables",
];

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    const rel = path.relative(ROOT, full).replace(/\\/g, "/");
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(tsx|ts)$/.test(name) && !SKIP_FILES.has(rel)) out.push(full);
  }
  return out;
}

function replaceRadii(src) {
  let next = src;
  let changed = false;
  const used = new Set();

  for (const [n, token] of RADIUS_MAP) {
    const re = new RegExp(`borderRadius:\\s*${n}\\b`, "g");
    if (re.test(next)) {
      next = next.replace(re, `borderRadius: ${token}`);
      used.add(token);
      changed = true;
    }
  }

  // stackedPhoto style: width/height 40, borderRadius 20 → RADIUS_LG
  // already covered by borderRadius: 20

  return { next, changed, used };
}

function ensureImports(src, usedTokens) {
  if (usedTokens.size === 0) return src;

  // Find an existing Variables import block
  const importRe =
    /import\s*\{([^}]*)\}\s*from\s*["']([^"']*Variables[^"']*)["']\s*;/;
  const m = src.match(importRe);
  if (!m) {
    // No Variables import — prepend a relative import guess from @/
    const tokens = [...usedTokens].sort().join(",\n  ");
    return `import {\n  ${tokens},\n} from "@/constants/Variables";\n${src}`;
  }

  const existing = m[1]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const existingSet = new Set(existing.map((s) => s.split(/\s+as\s+/)[0].trim()));
  const toAdd = [...usedTokens].filter((t) => !existingSet.has(t));
  if (toAdd.length === 0) return src;

  const all = [...existing, ...toAdd].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );
  // Keep simple alphabetical insert at end of original order for readability —
  // append missing tokens after existing list.
  const merged = [...existing];
  for (const t of toAdd.sort()) merged.push(t);
  const body = merged.join(",\n  ");
  const replacement = `import {\n  ${body},\n} from "${m[2]}";`;
  return src.replace(importRe, replacement);
}

let filesChanged = 0;
let totalReplacements = 0;

for (const file of walk(ROOT)) {
  const rel = path.relative(ROOT, file).replace(/\\/g, "/");
  const src = fs.readFileSync(file, "utf8");
  const { next, changed, used } = replaceRadii(src);
  if (!changed) continue;

  // Count replacements
  for (const [n] of RADIUS_MAP) {
    const before = (src.match(new RegExp(`borderRadius:\\s*${n}\\b`, "g")) || [])
      .length;
    totalReplacements += before;
  }

  let out = ensureImports(next, used);
  fs.writeFileSync(file, out);
  filesChanged += 1;
  console.log(`updated ${rel} (+${[...used].join(", ")})`);
}

console.log(`\nDone: ${filesChanged} files, ~${totalReplacements} radius replacements`);
