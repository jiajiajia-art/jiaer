/**
 * Create 页钻石列：提现内嵌在标签行（钻石 · 提现），大字仅数字，与其它列同高。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('Create_钻石列提现为标签行内嵌动作', () => {
  const css = read('src/page/Create.module.css');
  const tsx = read('src/page/Create.tsx');

  assert.match(tsx, /primaryStatLabelRow[\s\S]*?primaryStatWithdrawLink[\s\S]*?create\.withdraw/);
  assert.match(tsx, /primaryStatLabelSep/);
  assert.doesNotMatch(tsx, /primaryStatValueRow|primaryStatValueBlock|primaryStatActions|creatorWithdrawButton/);

  const labelRow = css.match(/\.primaryStatLabelRow\s*\{[^}]*\}/);
  assert.ok(labelRow, 'missing .primaryStatLabelRow');
  assert.match(labelRow[0], /display:\s*inline-flex/);

  const link = css.match(/\.primaryStatWithdrawLink\s*\{[^}]*\}/);
  assert.ok(link, 'missing .primaryStatWithdrawLink');
  assert.match(link[0], /background:\s*transparent/);
  assert.match(link[0], /color:\s*#FF8A9A/i);

  assert.doesNotMatch(css, /\.primaryStatValueRow\s*\{/);
  assert.doesNotMatch(css, /\.creatorWithdrawButton\s*\{/);
});
