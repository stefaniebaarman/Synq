import fs from "fs";

const files = [
  "app/monthly-memo.tsx",
  "src/components/community/CreateCommunityPlanModal.tsx",
  "src/components/community/CommunityPlansSection.tsx",
  "src/components/community/CommunityPlanGoerAvatars.tsx",
  "src/components/PlanTimePicker.tsx",
  "src/components/profile/ProfileShareCard.tsx",
];

const reps = [
  [/SURFACE_DEEPER/g, "BG"],
  [/SURFACE_DEEP/g, "SURFACE_INPUT"],
  [/SURFACE_INSET/g, "SURFACE_RAISED"],
  [/SURFACE_WELL/g, "SURFACE_RAISED"],
];

function ensureImport(src, token) {
  const importRe = /import\s*\{([^}]*)\}\s*from\s*["']([^"']*Variables[^"']*)["']/;
  const m = src.match(importRe);
  if (!m) return src;
  if (m[1].includes(token)) return src;
  if (!src.includes(token)) return src;
  const parts = m[1]
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  parts.push(token);
  return src.replace(
    importRe,
    `import {\n  ${parts.join(",\n  ")},\n} from "${m[2]}"`
  );
}

for (const f of files) {
  let s = fs.readFileSync(f, "utf8");
  const orig = s;
  for (const [re, to] of reps) s = s.replace(re, to);
  if (s === orig) continue;
  for (const token of ["BG", "SURFACE_INPUT", "SURFACE_RAISED"]) {
    s = ensureImport(s, token);
  }
  fs.writeFileSync(f, s);
  console.log("updated", f);
}
