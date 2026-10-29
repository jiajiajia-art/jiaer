/**
 * 建角选项池：名称是主行，没有加成时不铺一整条「无」。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../Romance/src/components/ModPoolsEditor.tsx'), 'utf8');

test('ModPoolsEditor_选项以名称为主且空加成不占一整行', () => {
  assert.match(src, /flex-1 basis-0 font-medium/);
  assert.match(src, /!w-24 shrink-0/);
  assert.match(src, /＋ 开局加成/);
  assert.match(src, /border-l-2 border-gold\/80/);
  assert.doesNotMatch(src, /无（只有文字设定）/);
  assert.doesNotMatch(src, /placeholder="标签" className=\{`\$\{inp\} w-32 shrink-0`\}/);
});

test('ModPathsEditor_最多可选不得从字中间折行', () => {
  const paths = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../Romance/src/components/ModPathsEditor.tsx'), 'utf8');
  assert.match(paths, /whitespace-nowrap">最多可选/);
  assert.match(paths, /aria-label="最多可选"/);
  assert.doesNotMatch(paths, /text-ink-soft">最多可选\n/);
});
