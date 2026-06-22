import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(process.cwd());
const VARS_PATH = path.join(ROOT, 'constants', 'Variables.ts');

if (!fs.existsSync(VARS_PATH)) {
  console.error('Variables file not found at', VARS_PATH);
  process.exit(2);
}

const txt = fs.readFileSync(VARS_PATH, 'utf8');
// crude extraction of exported identifiers
const exportNames = [];
const constRe = /export const\s+([A-Za-z0-9_]+)/g;
let m;
while ((m = constRe.exec(txt))) exportNames.push(m[1]);
const funcRe = /export function\s+([A-Za-z0-9_]+)/g;
while ((m = funcRe.exec(txt))) exportNames.push(m[1]);
const interfaceRe = /export interface\s+([A-Za-z0-9_]+)/g;
while ((m = interfaceRe.exec(txt))) exportNames.push(m[1]);

function walk(dir, files=[]) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      walk(p, files);
    } else if (/\.(tsx|ts|jsx|js)$/.test(e.name)) files.push(p);
  }
  return files;
}

const files = walk(path.join(ROOT));

const results = [];
for (const name of exportNames) {
  let count = 0;
  for (const f of files) {
    if (path.resolve(f) === path.resolve(VARS_PATH)) continue;
    const content = fs.readFileSync(f, 'utf8');
    const re = new RegExp('\\b' + name + '\\b', 'g');
    const found = content.match(re);
    if (found) count += found.length;
  }
  results.push({ name, count });
}

// show those with zero usage
const unused = results.filter(r => r.count === 0).map(r => r.name);
console.log('Scanned', exportNames.length, 'exports. Potentially unused (count 0):');
console.log(unused.join(', ') || '(none)');
console.log('\nFull counts:');
for (const r of results.sort((a,b)=>a.name.localeCompare(b.name))) {
  console.log(r.name + ': ' + r.count);
}
process.exit(0);
