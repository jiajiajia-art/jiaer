/**
 * warehouse 命名空间：zh / en / ja 叶子键路径须一致
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function leafPaths(obj, prefix = '') {
  const out = [];
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    if (prefix) out.push(prefix);
    return out;
  }
  for (const [k, v] of Object.entries(obj)) {
    const next = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      out.push(...leafPaths(v, next));
    } else {
      out.push(next);
    }
  }
  return out.sort();
}

function loadWarehouse(locale) {
  const raw = JSON.parse(readFileSync(join(root, `src/i18n/locales/${locale}.json`), 'utf8'));
  return raw.warehouse ?? {};
}

test('warehouse 叶子键在 zh / en / ja 中一致', () => {
  const zh = leafPaths(loadWarehouse('zh'));
  const en = leafPaths(loadWarehouse('en'));
  const ja = leafPaths(loadWarehouse('ja'));
  assert.deepEqual(en, zh, 'en 与 zh warehouse 键不一致');
  assert.deepEqual(ja, zh, 'ja 与 zh warehouse 键不一致');
});
