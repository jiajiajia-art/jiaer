/**
 * 功能注释：git 目录名为 src/components/admin（小写）。
 * macOS 大小写不敏感会掩盖 ./Admin/ 导入；tsc / Linux CI 会报 TS1261。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'src');
const BAD = /['"][^'"]*\/Admin\/[^'"]*['"]|from\s+['"]\.\/Admin\//;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === 'node_modules' || name === 'dist') continue;
      walk(p, out);
    } else if (/\.(tsx?|jsx?)$/.test(name)) {
      out.push(p);
    }
  }
  return out;
}

test('adminImportCasing_禁止components/Admin大写路径', () => {
  const hits = [];
  for (const file of walk(SRC)) {
    const text = readFileSync(file, 'utf8');
    const lines = text.split(/\r?\n/);
    lines.forEach((line, i) => {
      if (!BAD.test(line)) return;
      if (!/import\s|from\s|require\(/.test(line)) return;
      hits.push(`${relative(ROOT, file)}:${i + 1}: ${line.trim()}`);
    });
  }
  assert.equal(hits.length, 0, `应使用 components/admin（小写）:\n${hits.join('\n')}`);
});
