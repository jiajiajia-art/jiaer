/**
 * 首页主线条：只显示创作者 storylines；左「主线」右当前步；点击打开主线/支线面板。
 * 没配则整条不出现；不用引擎推的「排好本周日程 / 争取第一份通告 / 推进日子」。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const lib = await import(pathToFileURL(join(romance, 'lib/homeMainQuest.ts')).href);
const home = readFileSync(join(romance, 'components/HomeTab.tsx'), 'utf8');
const quest = readFileSync(join(romance, 'components/StoryQuestPanel.tsx'), 'utf8');

test('friendlyClockLabel_下午两点', () => {
  assert.equal(lib.friendlyClockLabel('14:00'), '下午两点');
  assert.equal(lib.friendlyClockLabel('09:30'), '上午九点半');
});

test('homeMainQuest_无创作者主线则不出现', () => {
  assert.equal(lib.homeMainQuest({ flags: {}, clockMin: 480, day: 0 }, []), null);
  assert.equal(lib.homeMainQuest({ flags: {}, clockMin: 480, day: 0 }, undefined), null);
});

test('homeMainQuest_取进行中节点并附等到时间', () => {
  const lines = [{
    id: 'main1',
    name: '星途启程',
    nodes: [
      { id: 'n1', name: '见经纪人', conds: [{ kind: 'clock', from: '14:00', to: '18:00' }] },
    ],
  }];
  const before = lib.homeMainQuest({ flags: {}, clockMin: 10 * 60, day: 0 }, lines);
  assert.equal(before?.stepName, '见经纪人');
  assert.equal(before?.lineName, '星途启程');
  assert.equal(before?.waitLabel, '等到下午两点');

  const inWin = lib.homeMainQuest({ flags: {}, clockMin: 15 * 60, day: 0 }, lines);
  assert.equal(inWin?.stepName, '见经纪人');
  assert.equal(inWin?.waitLabel, undefined);
});

test('homeMainQuest_节点完成后不再显示该步', () => {
  const lines = [{
    id: 'main1',
    name: '星途启程',
    nodes: [
      { id: 'n1', name: '见经纪人', conds: [] },
      { id: 'n2', name: '第一次通告', conds: [] },
    ],
  }];
  const q = lib.homeMainQuest({ flags: { 'quest:n1': 1 }, clockMin: 480, day: 0 }, lines);
  assert.equal(q?.stepName, '第一次通告');
});

test('HomeTab_主线条点开quest面板_不再折叠也不写地点说明', () => {
  assert.match(home, /homeMainQuest/);
  assert.match(home, /star:navtab[\s\S]*quest|detail:\s*"quest"/);
  assert.match(home, />主线</);
  assert.match(home, /q\.stepName/);
  assert.doesNotMatch(home, /mainQuestOpen/);
  assert.doesNotMatch(home, /收起主线|展开主线/);
  assert.doesNotMatch(home, /nextStep\(/);
  assert.doesNotMatch(home, /排好本周日程/);
  // 状态栏下不再渲染地点说明条（desc 仅作文图下正文）
  assert.doesNotMatch(home, /刚搬进/);
});

test('StoryQuestPanel_本章目标不再用引擎nextStep', () => {
  assert.match(quest, /homeMainQuest/);
  assert.doesNotMatch(quest, /nextStep\(/);
  assert.doesNotMatch(quest, /排好本周日程/);
});
