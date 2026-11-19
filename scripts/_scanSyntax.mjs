import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';

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

const errors = [];
for (const file of walk('src')) {
  const code = fs.readFileSync(file, 'utf8');
  try {
    parse(code, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
  } catch (error) {
    errors.push({
      file: file.replaceAll('\\', '/'),
      line: error.loc?.line,
      column: error.loc?.column,
      message: error.message.split('\n')[0],
    });
  }
}
console.log(JSON.stringify(errors, null, 2));
console.error('syntax errors:', errors.length);
