/**
 * 场景列表删除钮：相对整卡上下居中的墨黑圆钮，禁止贴在标题行顶上
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('SceneList_删除钮应对齐整卡并做成圆钮', () => {
  const css = read('src/components/GameSettingEditor/ScenesPanel/SceneList.module.css');
  const tsx = read('src/components/GameSettingEditor/ScenesPanel/SceneList.tsx');
  /* 功能注释：三列网格 + 32px 圆钮居中；禁止 200px 高卡把删除钉在右上角 */
  assert.match(css, /\.sceneRow\s*\{[\s\S]*?grid-template-columns:\s*88px minmax\(0,\s*1fr\) 32px/);
  assert.match(css, /\.sceneRow\s*\{[\s\S]*?align-items:\s*center/);
  assert.doesNotMatch(css, /\.sceneRow\s*\{[\s\S]*?height:\s*200px/);
  assert.match(css, /\.deleteButton\s*\{[\s\S]*?width:\s*32px/);
  assert.match(css, /\.deleteButton\s*\{[\s\S]*?border-radius:\s*999px/);
  assert.match(css, /\.deleteButton\s*\{[\s\S]*?display:\s*inline-flex/);
  assert.match(css, /\.deleteButton\s*\{[\s\S]*?align-items:\s*center/);
  assert.match(css, /\.deleteButton\s*\{[\s\S]*?justify-content:\s*center/);
  assert.match(css, /\.deleteButton\s*\{[\s\S]*?background:\s*#1C1C1E/);
  assert.match(tsx, /styles\.sceneMeta[\s\S]*styles\.deleteButton/);
  assert.doesNotMatch(tsx, /display:\s*'flex',\s*justifyContent:\s*'space-between'/);
});

test('SceneDetailForm_场景大图高度应提高80%', () => {
  const css = read('src/components/GameSettingEditor/ScenesPanel/SceneDetailForm.module.css');
  assert.match(css, /\.sceneHero\s*\{[\s\S]*?height:\s*504px/);
  assert.match(css, /\.sceneHero\s*\{[\s\S]*?background-position:\s*center top/);
  assert.doesNotMatch(css, /\.sceneHero\s*\{[\s\S]*?height:\s*280px/);
});

test('SceneDetail_确认修改与大图间距应贴紧', () => {
  const actionsCss = read('src/components/GameSettingEditor/ScenesPanel/SceneDetailActions.module.css');
  const cardCss = read('src/components/GameSettingEditor/ScenesPanel/ScenesPanel.module.css');
  assert.match(actionsCss, /\.actionsContainer\s*\{[\s\S]*?margin-bottom:\s*0/);
  assert.doesNotMatch(actionsCss, /\.actionsContainer\s*\{[\s\S]*?margin-bottom:\s*16px/);
  assert.match(cardCss, /\.card\s*\{[\s\S]*?gap:\s*8px/);
});
