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
  // 功能注释：母校 / 父母职业池不再作为系统内置建角结构
  assert.doesNotMatch(src, /母校/);
  assert.doesNotMatch(src, /父母职业池/);
  assert.doesNotMatch(src, /parentJobs/);
});

test('ModEditorPanel_最多可选不得从字中间折行', () => {
  // 功能注释：「最多可选」在①基础·势力，不在人物线路编辑器
  const panel = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../Romance/src/components/ModEditorPanel.tsx'), 'utf8');
  assert.match(panel, /whitespace-nowrap" aria-label="最多可选">最多可选/);
  assert.doesNotMatch(panel, /text-ink-soft">最多可选\n/);
});
