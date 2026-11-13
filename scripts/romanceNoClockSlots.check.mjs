/**
 * 时间与推进：去掉开局时刻 / 日始 / 日终；建角不再自选开局日期；运行时忽略旧稿残留。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

test('ModEditorPanel_时间区_应删除时刻字段与自选开局日期', () => {
  const panel = read('Romance/src/components/ModEditorPanel.tsx');
  // 功能注释：时间区后是「头像」「建角」再「地点」，切片止于头像以免误伤建角字段
  const timeSec = panel.slice(panel.indexOf('title="时间与推进"'), panel.indexOf('title="头像"'));
  assert.match(timeSec, /开局日期/);
  assert.doesNotMatch(timeSec, /开局时刻|每天几点开始|几点算一天结束/);
  assert.doesNotMatch(timeSec, /建角时让玩家自选开局日期|最早可选|最晚可选/);
  assert.match(panel, /delete next\.startTime/);
  assert.match(panel, /delete play\.pickStartDate/);
});

test('CharacterCreate_不应再渲染或写入玩家自选开局日期', () => {
  const src = read('Romance/src/components/CharacterCreate.tsx');
  assert.doesNotMatch(src, /playSlot\?\.pickStartDate|pickDate|startDateMin|startDateMax/);
  assert.doesNotMatch(src, /type="date"/);
  assert.match(src, /setStartDateOverride\(undefined\)/);
  assert.doesNotMatch(src, /startDate:\s*playSlot/);
});

test('logic_日始日终应忽略内容槽_只用引擎 travel 默认', () => {
  const src = read('Romance/src/game/logic.ts');
  assert.match(src, /TRAVEL\.dayStartMinute/);
  assert.match(src, /TRAVEL\.dayEndMinute/);
  assert.doesNotMatch(src, /slotTime\("startTime"|slotTime\("dayStart"|slotTime\("dayEnd"/);
  assert.doesNotMatch(src, /slot<string[^>]*>\("startTime"|slot\("dayStart"|slot\("dayEnd"/);
});

test('ModRoomTreeEditor_应从地点库添加且空态仍提示至少一个地点', () => {
  const src = read('Romance/src/components/ModRoomTreeEditor.tsx');
  assert.match(src, /从地点库添加/);
  assert.match(src, /listActivePlatformLocations/);
  assert.match(src, /添加顶层地点/);
  assert.match(src, /emptyHint/);
  assert.doesNotMatch(src, /autoSeed|LOCATIONS\.forEach|seedRoomsFrom/);
});
