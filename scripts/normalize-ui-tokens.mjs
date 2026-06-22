import fs from "fs";
import path from "path";

const SKIP = new Set(["node_modules", ".git", "dist", "build"]);
const EXT = new Set([".tsx", ".ts"]);
const SKIP_FILES = new Set([
  "constants/Variables.ts",
  "constants/modalStyles.ts",
  "constants/formScreenStyles.ts",
  "constants/sheetStyles.ts",
]);

const REPLACEMENTS = [
  [/fontSize:\s*TYPE_SECTION\s*\+\s*2\b/g, "fontSize: TYPE_MODAL_TITLE"],
  [/fontSize:\s*TYPE_BODY\s*\+\s*4\b/g, "fontSize: TYPE_SECTION"],
  [/fontSize:\s*TYPE_BODY\s*\+\s*2\b/g, "fontSize: TYPE_CTA"],
  [/fontSize:\s*TYPE_BODY\s*\+\s*1\b/g, "fontSize: TYPE_SUBHEAD"],
  [/fontSize:\s*TYPE_BODY\s*-\s*1\b/g, "fontSize: TYPE_BUTTON"],
  [/fontSize:\s*TYPE_CAPTION\s*\+\s*2\b/g, "fontSize: TYPE_BUTTON"],
  [/fontSize:\s*TYPE_CAPTION\s*\+\s*1\b/g, "fontSize: TYPE_LEAD"],
  [/fontSize:\s*TYPE_CAPTION\s*-\s*1\b/g, "fontSize: TYPE_FINE"],
  [/fontSize:\s*TYPE_CAPTION\s*-\s*2\b/g, "fontSize: TYPE_MICRO"],
  [/fontSize:\s*15\b/g, "fontSize: TYPE_BUTTON"],
  [/fontSize:\s*18\b/g, "fontSize: TYPE_CTA"],
  [/fontSize:\s*22\b/g, "fontSize: TYPE_MODAL_TITLE"],
  [/fontSize:\s*11\b/g, "fontSize: TYPE_MICRO"],
  [/fontSize:\s*9\b/g, "fontSize: TYPE_NANO"],
  [/fontSize:\s*10\b/g, "fontSize: TYPE_FINE"],
  [/fontSize:\s*13\b/g, "fontSize: TYPE_CAPTION"],
  [/fontSize:\s*14\b/g, "fontSize: TYPE_LEAD"],
  [/fontSize:\s*16\b/g, "fontSize: TYPE_BODY"],
  [/fontSize:\s*17\b/g, "fontSize: TYPE_SUBHEAD"],
  [/fontSize:\s*26\b/g, "fontSize: TYPE_TITLE"],
  [/fontSize:\s*28\b/g, "fontSize: TYPE_TAB_HEADER"],
  [/fontSize:\s*34\b/g, "fontSize: TYPE_DISPLAY"],
  [/fontSize:\s*12\b/g, "fontSize: TYPE_FINE"],
  [/fontSize:\s*20\b/g, "fontSize: TYPE_SECTION"],
  [/fontSize:\s*24\b/g, "fontSize: TYPE_MODAL_TITLE"],
  [/fontSize:\s*30\b/g, "fontSize: TYPE_TITLE"],
  [/fontSize:\s*32\b/g, "fontSize: TYPE_DISPLAY"],
  [/color:\s*["']white["']/g, "color: TEXT"],
  [/color:\s*["']#fff["']/gi, "color: TEXT"],
  [/color:\s*["']black["']/g, "color: ON_ACCENT_TEXT"],
  [/color:\s*["']#061006["']/g, "color: ON_ACCENT_TEXT"],
  [/color:\s*["']#aaa["']/gi, "color: TEXT_MUTED_HEX"],
  [/color:\s*["']#A8A8A8["']/gi, "color: TEXT_MUTED_HEX"],
  [/color:\s*["']#666["']/gi, "color: TEXT_MUTED_DARK"],
  [/color:\s*["']#777["']/gi, "color: TEXT_MUTED_DARKER"],
  [/color:\s*["']#888["']/gi, "color: TEXT_MUTED_LIGHT"],
  [/color:\s*["']#444["']/gi, "color: TEXT_MUTED_FAINT"],
  [/color:\s*["']#ff6b6b["']/gi, "color: DESTRUCTIVE"],
  [/color:\s*["']#FF5A5F["']/gi, "color: DESTRUCTIVE"],
  [/color:\s*["']#FF8A84["']/gi, "color: DESTRUCTIVE"],
  [/backgroundColor:\s*["']#1C1C1E["']/gi, "backgroundColor: SURFACE_ELEVATED"],
  [/backgroundColor:\s*["']#1a1c1e["']/gi, "backgroundColor: SURFACE_ELEVATED"],
  [/backgroundColor:\s*["']#1a1a1a["']/gi, "backgroundColor: SURFACE_LIFTED"],
  [/backgroundColor:\s*["']#0E1012["']/gi, "backgroundColor: SURFACE_RAISED"],
  [/backgroundColor:\s*["']#0A0B0D["']/gi, "backgroundColor: SURFACE_INPUT"],
  [/backgroundColor:\s*["']#0A0A0A["']/gi, "backgroundColor: SURFACE_INPUT"],
  [/backgroundColor:\s*["']#0E0E0E["']/gi, "backgroundColor: SURFACE_INPUT"],
  [/backgroundColor:\s*["']#0E0F11["']/gi, "backgroundColor: SURFACE_PANEL"],
  [/backgroundColor:\s*["']#0c0c0c["']/gi, "backgroundColor: SURFACE_DEEP"],
  [/backgroundColor:\s*["']#050505["']/gi, "backgroundColor: SURFACE_DEEPER"],
  [/backgroundColor:\s*["']#141414["']/gi, "backgroundColor: SHEET_SURFACE"],
  [/backgroundColor:\s*["']#141516["']/gi, "backgroundColor: SHEET_SURFACE"],
  [/backgroundColor:\s*["']#161616["']/gi, "backgroundColor: SURFACE_SHEET_ALT"],
  [/backgroundColor:\s*["']#101214["']/gi, "backgroundColor: SURFACE_INSET"],
  [/backgroundColor:\s*["']#111["']/gi, "backgroundColor: SURFACE_WELL"],
  [/backgroundColor:\s*["']#222["']/gi, "backgroundColor: BORDER_STRONG"],
  [/backgroundColor:\s*["']#333["']/gi, "backgroundColor: BORDER_MUTED"],
  [/backgroundColor:\s*["']#8E8E93["']/gi, "backgroundColor: DISABLED_CTA"],
  [/backgroundColor:\s*["']#34D399["']/gi, "backgroundColor: STATUS_AVAILABLE"],
  [/backgroundColor:\s*["']#eee["']/gi, "backgroundColor: BORDER_MUTED"],
  [/borderColor:\s*["']#1C1C1E["']/gi, "borderColor: SURFACE_ELEVATED"],
  [/borderColor:\s*["']#111["']/gi, "borderColor: SURFACE_WELL"],
  [/borderBottomColor:\s*["']#111["']/gi, "borderBottomColor: SURFACE_WELL"],
  [/shadowColor:\s*["']#34D399["']/gi, "shadowColor: STATUS_AVAILABLE"],
  [/backgroundColor:\s*["']rgba\(0,0,0,0\.75\)["']/g, "backgroundColor: MODAL_OVERLAY"],
  [/backgroundColor:\s*["']rgba\(0,0,0,0\.55\)["']/g, "backgroundColor: SHEET_OVERLAY"],
  [/backgroundColor:\s*["']rgba\(255,255,255,0\.06\)["']/g, "backgroundColor: SURFACE"],
  [/backgroundColor:\s*["']rgba\(255,255,255,0\.08\)["']/g, "backgroundColor: BORDER"],
  [/backgroundColor:\s*["']rgba\(120,255,120,0\.08\)["']/g, "backgroundColor: ACCENT_SELECTED_BG"],
  [/borderColor:\s*["']rgba\(255,255,255,0\.08\)["']/g, "borderColor: BORDER"],
  [/borderColor:\s*["']rgba\(255,255,255,0\.06\)["']/g, "borderColor: GROUP_BORDER"],
  [/borderColor:\s*["']rgba\(255,255,255,0\.22\)["']/g, "borderColor: MUTED3"],
  [/borderColor:\s*["']rgba\(255,255,255,0\.2\)["']/g, "borderColor: MUTED3"],
  [/borderColor:\s*["']rgba\(255,255,255,0\.18\)["']/g, "borderColor: MUTED3"],
  [/borderColor:\s*["']rgba\(255,255,255,0\.12\)["']/g, "borderColor: MUTED3"],
  [/borderColor:\s*["']rgba\(255,255,255,0\.07\)["']/g, "borderColor: GROUP_BORDER"],
  [/borderColor:\s*["']rgba\(255,255,255,0\.05\)["']/g, "borderColor: GROUP_BORDER"],
  [/color:\s*["']rgba\(255,255,255,0\.55\)["']/g, "color: MUTED"],
  [/color:\s*["']rgba\(255,255,255,0\.65\)["']/g, "color: MUTED2"],
  [/color:\s*["']rgba\(255,255,255,0\.62\)["']/g, "color: MUTED2"],
  [/color:\s*["']rgba\(255,255,255,0\.6\)["']/g, "color: MUTED2"],
  [/color:\s*["']rgba\(255,255,255,0\.72\)["']/g, "color: MUTED"],
  [/color:\s*["']rgba\(255,255,255,0\.7\)["']/g, "color: MUTED"],
  [/color:\s*["']rgba\(255,255,255,0\.85\)["']/g, "color: TEXT"],
  [/color:\s*["']rgba\(255,255,255,0\.75\)["']/g, "color: MUTED"],
  [/color:\s*["']rgba\(255,255,255,0\.42\)["']/g, "color: MUTED2"],
  [/color:\s*["']rgba\(255,255,255,0\.40\)["']/g, "color: MUTED3"],
  [/color:\s*["']rgba\(255,255,255,0\.35\)["']/g, "color: MUTED3"],
  [/placeholderTextColor=\{?["']rgba\(255,255,255,0\.35\)["']\}?/g, "placeholderTextColor={MUTED3}"],
  [/placeholderTextColor=\{?["']rgba\(255,255,255,0\.4\)["']\}?/g, "placeholderTextColor={MUTED3}"],
  [/placeholderTextColor=["']rgba\(255,255,255,0\.35\)["']/g, 'placeholderTextColor={MUTED3}'],
  [/placeholderTextColor=["']rgba\(255,255,255,0\.4\)["']/g, 'placeholderTextColor={MUTED3}'],
];

const TOKEN_IMPORTS = [
  "TYPE_BUTTON",
  "TYPE_CTA",
  "TYPE_MODAL_TITLE",
  "TYPE_MICRO",
  "TYPE_NANO",
  "TYPE_FINE",
  "TYPE_CAPTION",
  "TYPE_LEAD",
  "TYPE_BODY",
  "TYPE_SUBHEAD",
  "TYPE_TITLE",
  "TYPE_TAB_HEADER",
  "TYPE_DISPLAY",
  "TYPE_SECTION",
  "TEXT",
  "ON_ACCENT_TEXT",
  "DESTRUCTIVE",
  "MUTED",
  "MUTED2",
  "MUTED3",
  "SURFACE",
  "BORDER",
  "GROUP_BORDER",
  "SURFACE_ELEVATED",
  "SURFACE_RAISED",
  "SURFACE_INPUT",
  "SURFACE_DEEP",
  "SURFACE_DEEPER",
  "SURFACE_LIFTED",
  "SURFACE_PANEL",
  "SURFACE_WELL",
  "SURFACE_INSET",
  "SHEET_SURFACE",
  "SURFACE_SHEET_ALT",
  "BORDER_STRONG",
  "BORDER_MUTED",
  "TEXT_MUTED_HEX",
  "TEXT_MUTED_DARK",
  "TEXT_MUTED_DARKER",
  "TEXT_MUTED_LIGHT",
  "TEXT_MUTED_FAINT",
  "MODAL_OVERLAY",
  "SHEET_OVERLAY",
  "DISABLED_CTA",
  "STATUS_AVAILABLE",
  "ACCENT_SELECTED_BG",
];

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, files);
    else if (EXT.has(path.extname(ent.name))) files.push(p);
  }
  return files;
}

function addImports(content, needed) {
  if (!needed.size) return content;
  const importRe = /import\s*\{([^}]+)\}\s*from\s*["']@\/constants\/Variables["'];?/;
  const match = content.match(importRe);
  if (match) {
    const existing = match[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const set = new Set([...existing, ...needed]);
    const sorted = [...set].sort();
    const newImport = `import {\n  ${sorted.join(",\n  ")},\n} from "@/constants/Variables";`;
    return content.replace(importRe, newImport);
  }

  const relImportRe = /import\s*\{([^}]+)\}\s*from\s*["'](?:\.\.\/)+constants\/Variables["'];?/;
  const relMatch = content.match(relImportRe);
  if (relMatch) {
    const existing = relMatch[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const set = new Set([...existing, ...needed]);
    const sorted = [...set].sort();
    const fromPart = relMatch[0].slice(relMatch[0].indexOf("from"));
    const fromPath = fromPart.match(/from\s*(["'][^"']+["'])/)[1];
    const newImport = `import {\n  ${sorted.join(",\n  ")},\n} from ${fromPath};`;
    return content.replace(relImportRe, newImport);
  }

  const sorted = [...needed].sort();
  const imp = `import {\n  ${sorted.join(",\n  ")},\n} from "@/constants/Variables";\n`;
  const firstImport = content.search(/^import /m);
  if (firstImport >= 0) return content.slice(0, firstImport) + imp + content.slice(firstImport);
  return imp + content;
}

let changed = 0;
for (const file of walk(".")) {
  const rel = file.replace(/\\/g, "/").replace(/^\.\//, "");
  if (SKIP_FILES.has(rel)) continue;

  let content = fs.readFileSync(file, "utf8");
  const orig = content;
  for (const [re, rep] of REPLACEMENTS) {
    content = content.replace(re, rep);
  }
  if (content === orig) continue;

  const needed = new Set();
  for (const t of TOKEN_IMPORTS) {
    if (new RegExp(`\\b${t}\\b`).test(content) && !new RegExp(`\\b${t}\\b`).test(orig)) {
      needed.add(t);
    }
  }
  if (needed.size) content = addImports(content, needed);
  fs.writeFileSync(file, content);
  changed++;
  console.log(rel);
}
console.log(`Updated ${changed} files`);
