/**
 * 创作者「时间与推进 / 头像」收紧：隐藏跳转说明与变量名文案；
 * 日程叙事、年龄随日历、换地点扣点、叙事字数均内置，界面不再暴露配置。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('时间与推进_不展示开局地点开场资金跳转说明_无年龄勾选', () => {
  const panel = read('Romance/src/components/ModEditorPanel.tsx');
  const travel = read('Romance/src/components/ModTravelEditor.tsx');
  const timeAt = panel.indexOf('title="时间与推进"');
  assert.ok(timeAt >= 0);
  const timeBlock = panel.slice(timeAt, panel.indexOf('title="头像"', timeAt));
  assert.doesNotMatch(timeBlock, /起点在本页|开局封面与开场页|资金在本页「建角」|⑤ 美化/);
  assert.doesNotMatch(timeBlock, /主角年龄随日历增长/);
  assert.doesNotMatch(timeBlock, /固定事件.*周期触发|④ 剧情 → 固定事件/);
  assert.doesNotMatch(timeBlock, /ageAuto|setPlay/);
  assert.match(timeBlock, /ModTravelEditor part="pace"/);
  assert.doesNotMatch(travel, /推进后由 AI 生成日程叙事（结合时间、天气与之前的记忆）/);
  assert.doesNotMatch(travel, /type="checkbox"[\s\S]{0,120}advanceStory/);
  assert.doesNotMatch(travel, /日程叙事字数/);
  assert.doesNotMatch(travel, /换一次地点扣/);
  assert.doesNotMatch(travel, /apPerMove\s*\?\?/);
  assert.doesNotMatch(travel, /advanceWords\s*\?\?/);
  assert.match(travel, /delete next\.advanceStory|delete next.advanceStory/);
  assert.match(travel, /delete next\.apPerMove|delete next.apPerMove/);
  assert.match(travel, /delete next\.advanceWords|delete next.advanceWords/);
});

test('头像_不向创作者展示私库公库与avatarVariant说明', () => {
  const pools = read('Romance/src/components/ModAvatarPoolsEditor.tsx');
  const panel = read('Romance/src/components/ModEditorPanel.tsx');
  assert.doesNotMatch(pools, /私库、公库与分类都在本块配置/);
  assert.doesNotMatch(pools, /池名即 avatarVariant/);
  assert.doesNotMatch(pools, /aria-label="池名（即 avatarVariant）"/);
  assert.doesNotMatch(pools, /人物写的 avatarVariant/);
  assert.match(pools, /aria-label="池名"/);
  assert.match(pools, /匹配优先级/);
  assert.match(pools, /我的头像池/);
  // 功能注释：人物卡仍写 avatarVariant 字段，但界面文案不得把变量名摊给创作者
  assert.match(panel, /avatarVariant:/);
  assert.doesNotMatch(panel, /头像池（avatarVariant）/);
  assert.match(panel, /头像池 · 开局从同名池抽一张做头像/);
});

test('运行时_日程叙事与年龄随日历内置开启', () => {
  // 功能注释：不动态 import mud.ts（其依赖链在 node:test 下缺扩展名会挂）；直接锁源码契约
  const mud = read('Romance/src/game/mud.ts');
  assert.match(mud, /export const advanceStoryOn = \(\) => true/);

  const ctx = read('Romance/src/store/GameContext.tsx');
  const ai = read('Romance/src/lib/ai.ts');
  assert.doesNotMatch(ctx, /getWorldSlot\("play"\)\?\.ageAuto/);
  assert.match(ctx, /tickPlayerAge\(g, nextSim\.day\)/);
  assert.doesNotMatch(ai, /getWorldSlot\("play"\)\?\.ageAuto/);
  assert.match(ai, /tickPlayerAge\(next,/);

  const panel = read('Romance/src/components/ModEditorPanel.tsx');
  assert.match(panel, /delete play\.ageAuto/);
  assert.match(panel, /advanceStory: _as/);
  assert.match(panel, /apPerMove: _ap/);
  assert.match(panel, /advanceWords: _aw/);
});

test('类型与生成提示_开关字段标为内置不再让 AI 配置', () => {
  const types = read('Romance/src/lib/types.ts');
  const content = read('Romance/src/worlds/star2005/content.ts');
  const gen = read('Romance/src/lib/worldGenGenerate.ts');
  assert.match(types, /@deprecated[\s\S]{0,80}ageAuto/);
  assert.match(content, /@deprecated[\s\S]{0,80}advanceStory/);
  assert.match(gen, /travelTime:[\s\S]{0,160}内置/);
  assert.match(gen, /勿写 apPerMove \/ advanceWords/);
  assert.doesNotMatch(gen, /travelTime: "startDate、travel（行动点 \/ 日周月年推进）、play\.ageAuto"/);
});
