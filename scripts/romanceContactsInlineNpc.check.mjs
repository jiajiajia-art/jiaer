/**
 * 关系档位并入开局人物上方；禁止独立大人脉配置页；
 * 卡片数值已下线（不再自增数值条）。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('人物Section_人物卡在前_ContactsPanel全作品共用单独成块在后', () => {
  const editor = read('Romance/src/components/ModEditorPanel.tsx');
  assert.doesNotMatch(editor, /title="人脉页面配置"/);
  const peopleAt = editor.indexOf('title="人物"');
  assert.ok(peopleAt >= 0);
  // 功能注释：关系玩法已迁出②角色；人物段以总养成开关为下界
  const endAt = editor.indexOf('title="总养成开关"', peopleAt);
  const peopleBlock = editor.slice(peopleAt, endAt > peopleAt ? endAt : peopleAt + 8000);
  assert.match(peopleBlock, /ContactsPanel/);
  assert.ok(peopleBlock.indexOf('<ContactsPanel') > peopleBlock.indexOf('npcs.map'), '人物卡（姓名）须在关系档位之前');
  assert.match(read('Romance/src/components/ContactsPanel.tsx'), /关系档位 · 全作品共用/);
});

test('ContactsPanel_仅关系档位_无卡片数值与双列预览', () => {
  const panel = read('Romance/src/components/ContactsPanel.tsx');
  assert.match(panel, /关系档位/);
  assert.match(panel, /添加档位/);
  assert.doesNotMatch(panel, /卡片数值\s*[·・]|添加数值|CONTACT_ICONS|valueSources/);
  assert.doesNotMatch(panel, /卡片上的两个数/);
  assert.doesNotMatch(panel, /数值 \{i \+ 1\}|数值 \{i\+1\}|>数值 1<|>数值 2</);
  assert.doesNotMatch(panel, /玩家实际看到的人脉页|实时预览|lg:grid-cols-\[minmax/);
  assert.doesNotMatch(panel, /slice\(0,\s*2\)|metrics\[0\],\s*metrics\[1\]/);
});

test('contacts_normalize清空metrics_visible恒空', () => {
  const src = read('Romance/src/game/contacts.ts');
  assert.match(src, /export function visibleContactMetrics/);
  assert.match(src, /卡片数值已下线|恒返回空/);
  assert.match(src, /metrics:\s*\[\]/);
  assert.doesNotMatch(src, /slice\(0,\s*2\)/);
  assert.doesNotMatch(src, /最多两项/);
});

test('NpcTab_只用visibleContactMetrics', () => {
  const npc = read('Romance/src/components/NpcTab.tsx');
  assert.match(npc, /visibleContactMetrics/);
  assert.match(npc, /shownMetrics/);
});
