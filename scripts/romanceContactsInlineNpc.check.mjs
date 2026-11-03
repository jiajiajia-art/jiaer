/**
 * 关系档位 / 卡片数值并入开局人物上方；禁止独立大人脉配置页；
 * 数值条数自定可隐藏，禁止写死「数值1 / 数值2」。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('人物Section_顶部嵌ContactsPanel_无独立人脉页面配置Section', () => {
  const editor = read('Romance/src/components/ModEditorPanel.tsx');
  assert.doesNotMatch(editor, /title="人脉页面配置"/);
  const peopleAt = editor.indexOf('title="人物"');
  assert.ok(peopleAt >= 0);
  const endAt = editor.indexOf('title="关系玩法"', peopleAt);
  const peopleBlock = editor.slice(peopleAt, endAt > peopleAt ? endAt : peopleAt + 8000);
  assert.match(peopleBlock, /ContactsPanel/);
  assert.ok(peopleBlock.indexOf('ContactsPanel') < peopleBlock.indexOf('npcs.map'), 'ContactsPanel 须在人物列表之上');
});

test('ContactsPanel_紧凑档位与自增数值_无双列预览与数值12文案', () => {
  const panel = read('Romance/src/components/ContactsPanel.tsx');
  assert.match(panel, /关系档位与卡片数值/);
  assert.match(panel, /添加档位/);
  assert.match(panel, /添加数值/);
  assert.match(panel, /隐藏/);
  assert.doesNotMatch(panel, /卡片上的两个数/);
  assert.doesNotMatch(panel, /数值 \{i \+ 1\}|数值 \{i\+1\}|>数值 1<|>数值 2</);
  assert.doesNotMatch(panel, /玩家实际看到的人脉页|实时预览|lg:grid-cols-\[minmax/);
  assert.doesNotMatch(panel, /slice\(0,\s*2\)|metrics\[0\],\s*metrics\[1\]/);
});

test('contacts_normalize允许多数值_visible跳过hidden', () => {
  // 功能注释：不动态 import contacts.ts（依赖链缺扩展名）；锁源码契约
  const src = read('Romance/src/game/contacts.ts');
  assert.match(src, /hidden\?: boolean/);
  assert.match(src, /export function visibleContactMetrics/);
  assert.match(src, /!m\.hidden/);
  assert.match(src, /不再写死两项|条数不限/);
  assert.doesNotMatch(src, /slice\(0,\s*2\)/);
  assert.doesNotMatch(src, /最多两项/);
});

test('NpcTab_只用visibleContactMetrics', () => {
  const npc = read('Romance/src/components/NpcTab.tsx');
  assert.match(npc, /visibleContactMetrics/);
  assert.match(npc, /shownMetrics/);
});
