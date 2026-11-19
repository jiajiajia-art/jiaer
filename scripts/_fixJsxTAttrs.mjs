import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('src');
const apply = process.argv.includes('--apply');

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === 'dist') continue;
      walk(p, acc);
    } else if (/\.(tsx|jsx)$/.test(ent.name)) acc.push(p);
  }
  return acc;
}

function findCallEnd(text, openParenIndex) {
  let i = openParenIndex;
  let depth = 0;
  let quote = null;
  while (i < text.length) {
    const c = text[i];
    if (quote) {
      if (c === '\\') {
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      i += 1;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      quote = c;
      i += 1;
      continue;
    }
    if (c === '(') depth += 1;
    else if (c === ')') {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
    i += 1;
  }
  return -1;
}

const re = /([A-Za-z_][\w-]*)=t\(/g;
const names = new Map();
const unusual = [];
let total = 0;
let filesChanged = 0;

for (const file of walk(root)) {
  const text = fs.readFileSync(file, 'utf8');
  let out = '';
  let last = 0;
  let changed = false;
  re.lastIndex = 0;
  let m;
  while ((m = re.exec(text))) {
    const name = m[1];
    const nameStart = m.index;
    const before = nameStart === 0 ? '' : text[nameStart - 1];
    if (before && !/\s/.test(before)) continue;
    const callStart = nameStart + name.length + 1;
    const openParen = text.indexOf('(', callStart);
    const callEnd = findCallEnd(text, openParen);
    if (callEnd < 0) {
      unusual.push(`${file}: unclosed t() at ${nameStart}`);
      continue;
    }
    const call = text.slice(callStart, callEnd);
    const rel = text.slice(0, nameStart).split('\n').length;
    if (!/^t\('([^'\\]|\\.)*'\)$/.test(call) && !/^t\("([^"\\]|\\.)*"\)$/.test(call)) {
      unusual.push(`${path.relative(root, file)}:${rel} ${name}=${call.slice(0, 80)}`);
    }
    names.set(name, (names.get(name) || 0) + 1);
    total += 1;
    out += text.slice(last, nameStart) + `${name}={${call}}`;
    last = callEnd;
    re.lastIndex = callEnd;
    changed = true;
  }
  if (!changed) continue;
  out += text.slice(last);
  filesChanged += 1;
  if (apply) fs.writeFileSync(file, out);
}

console.log(JSON.stringify({
  apply,
  total,
  filesChanged,
  names: Object.fromEntries([...names.entries()].sort((a, b) => b[1] - a[1])),
  unusual,
}, null, 2));
