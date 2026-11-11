/**
 * 功能注释：git 目录名为 src/components/admin（小写）。
 * 与 adminImportCasing 一致，禁止再要求大写 Admin（macOS 掩盖、Linux 会炸）。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const SRC = join(ROOT, 'src');
const BAD = /(?:from\s+['"])(?:\.\/Admin\/|(?:\.\.\/)+components\/Admin\/)/;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist') continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|jsx)$/.test(name)) out.push(p);
  }
  return out;
}

test('import路径_应使用小写components/admin而非Admin', () => {
  const files = walk(SRC);
  const offenders = [];
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    if (BAD.test(text)) offenders.push(relative(ROOT, file));
  }
  assert.deepEqual(offenders, [], `大小写错误的 import:\n${offenders.join('\n')}`);
});

test('磁盘目录_components/admin应为小写', () => {
  const names = readdirSync(join(SRC, 'components'));
  assert.ok(names.includes('admin'), '缺少 components/admin');
  assert.ok(!names.includes('Admin'), '不应存在大写 Admin 目录名（或需统一为 admin）');
});
