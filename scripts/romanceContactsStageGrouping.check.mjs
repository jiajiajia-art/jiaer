/**
 * 人脉页契约：玩家与作者预览都只按关系阶段分组，旧组织/势力/自定义分组不得回流。
 * 编辑器侧为人物上方紧凑配置，不再做独立大人脉预览页。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');

test('contacts_旧模板组织与自定义分组应丢弃_阶段限定应取消', async () => {
  const grouping = await import(pathToFileURL(join(romance, 'game/contactStageGrouping.ts')).href);
  const normalized = grouping.normalizeContactStages([
    { id: 'friend', label: '好友', min: 40, groups: ['sect'] },
    { id: 'stranger', label: '陌生人', min: -100 },
  ]);
  const source = readFileSync(join(romance, 'game/contacts.ts'), 'utf8');

  assert.equal(normalized[0].groups, undefined);
  assert.match(source, /组织\/自定义分组直接丢弃|groups \/ orgs/);
  assert.doesNotMatch(source.slice(source.indexOf('return {', source.indexOf('normalizeContactsSlot')), source.indexOf('/* 当前生效配置')), /groups:|orgs:/);
});

test('contacts_每个人只进入当前关系阶段且顺序跟随阶段配置', async () => {
  const grouping = await import(pathToFileURL(join(romance, 'game/contactStageGrouping.ts')).href);
  const stages = [
    { id: 'lover', label: '恋人', min: 80 },
    { id: 'friend', label: '好友', min: 40 },
    { id: 'known', label: '熟人', min: 0 },
    { id: 'rival', label: '对立', min: -100 },
  ];
  const people = [
    { id: 'a', rel: 45 },
    { id: 'b', rel: 90 },
    { id: 'c', rel: -20 },
  ];
  const groups = grouping.groupByContactStage(stages, people, (person) => person.rel);

  assert.deepEqual(groups.map((group) => group.stage.id), ['lover', 'friend', 'rival']);
  assert.deepEqual(groups.flatMap((group) => group.people.map((person) => person.id)).sort(), ['a', 'b', 'c']);
  assert.equal(groups.flatMap((group) => group.people).length, people.length);
});

test('ContactsPanel_嵌人物上方紧凑配置_无模板组织分组表单', () => {
  const panel = readFileSync(join(romance, 'components/ContactsPanel.tsx'), 'utf8');
  const npcTab = readFileSync(join(romance, 'components/NpcTab.tsx'), 'utf8');
  const editor = readFileSync(join(romance, 'components/ModEditorPanel.tsx'), 'utf8');

  assert.match(panel, /关系档位|添加档位/);
  assert.doesNotMatch(panel, /卡片数值\s*[·・]|添加数值|CONTACT_ICONS/);
  assert.doesNotMatch(panel, /载入「|TEMPLATES|title="所属组织"|兜底组|身份关键词|添加分组/);
  assert.doesNotMatch(editor, /title="人脉页面配置"|人脉分组：|所属组织（无）/);
  assert.match(npcTab, /groupContactsByStage/);
  assert.doesNotMatch(npcTab, /groupsOf|orgOf/);
});
