import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(process.cwd());
const TOKENS = ['TEXT','BORDER','SURFACE_SECONDARY','MUTED3'];
const SEARCH_DIRS = ['app','src'];

function walk(dir, files=[]) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      walk(path.join(dir, e.name), files);
    } else if (/\.(tsx|ts|jsx|js)$/.test(e.name)) {
      files.push(path.join(dir, e.name));
    }
  }
  return files;
}

function fileUsesToken(file, token) {
  const txt = fs.readFileSync(file, 'utf8');
  return new RegExp('\\b' + token + '\\b').test(txt);
}

function importLineHasToken(file, token) {
  const txt = fs.readFileSync(file, 'utf8');
  const head = txt.split(/\n/).slice(0, 60).join('\n');
  // check for import from "@/constants/Variables"
  const m = head.match(/from\s+['\"]@\/constants\/Variables['\"]/);
  if (!m) return false;
  // find the import clause that imports from Variables
  const importStmt = head.split(/\n/).filter(l => /from\s+['\"]@\/constants\/Variables['\"]/.test(l)).join('\n');
  return new RegExp('\\b' + token + '\\b').test(importStmt);
}

const results = [];
for (const dir of SEARCH_DIRS) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) continue;
  const files = walk(abs);
  for (const f of files) {
    for (const t of TOKENS) {
      if (fileUsesToken(f, t) && !importLineHasToken(f, t)) {
        results.push({ file: path.relative(ROOT, f), token: t });
      }
    }
  }
}

if (results.length === 0) {
  console.log('No missing imports found for tokens:', TOKENS.join(', '));
  process.exit(0);
}

// Group by file
const byFile = results.reduce((acc, cur) => {
  acc[cur.file] = acc[cur.file] || new Set();
  acc[cur.file].add(cur.token);
  return acc;
}, {});

console.log('Files that reference tokens but do not import them from @/constants/Variables:\n');
for (const [file, set] of Object.entries(byFile)) {
  console.log(file + ': ' + Array.from(set).join(', '));
}

process.exit(0);
