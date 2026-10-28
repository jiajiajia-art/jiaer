/**
 * 模组编辑器信息架构：取消「开局设定 / 开场」聚合，按所属系统归类，禁止重复入口
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const panel = readFileSync(join(root, 'Romance/src/components/ModEditorPanel.tsx'), 'utf8');

test('ModEditorPanel_应取消开局设定区块与开场一级分类', () => {
  assert.doesNotMatch(panel, /title="开局设定"/);
  assert.doesNotMatch(panel, /label: "⑥ 开场"/);
  assert.doesNotMatch(panel, /k: "look"/);
  assert.match(panel, /label: "⑤ 剧情"/);
  assert.match(panel, /label: "⑥ 玩法 Mod"/);
  assert.doesNotMatch(panel, /label: "⑦ 功能扩展"/);
  assert.doesNotMatch(panel, /ModExtEditor/);
  assert.doesNotMatch(panel, /exports\.actions|JsonField|私有变量/);
});

test('ModEditorPanel_字段应按系统归入唯一入口', () => {
  // 时间 → 时间与推进
  assert.match(panel, /title="时间与推进"/);
  const timeSec = panel.slice(panel.indexOf('title="时间与推进"'), panel.indexOf('title="功能开关"'));
  assert.match(timeSec, /开局日期/);
  assert.match(timeSec, /开局时刻/);
  assert.match(timeSec, /每天几点开始/);
  assert.match(timeSec, /几点算一天结束/);
  // 允许文案指向其它分组，但禁止在本区再出现资金 / 天气表单项
  assert.doesNotMatch(timeSec, />开局资金</);
  assert.doesNotMatch(timeSec, />开局天气</);
  assert.doesNotMatch(timeSec, /startMoney/);
  assert.doesNotMatch(timeSec, /weather/);

  // 资金 → 养成
  assert.match(panel, /title="开局资源"/);
  const growMoney = panel.slice(panel.indexOf('title="开局资源"'), panel.indexOf('title="培训课程"'));
  assert.match(growMoney, /开局资金/);
  assert.match(growMoney, /g="grow"/);

  // 开局天气已从④世界移除；起始地点仅地点树；出行迁至玩法 Mod（showPlay）
  assert.doesNotMatch(panel, /title="开局天气"/);
  assert.match(panel, /ModRoomTreeEditor/);
  assert.match(panel, /startRoom=\{c\.startRoom\}/);
  assert.doesNotMatch(panel, />起始地点</);
  assert.match(panel, /showPlay\("travel"\)[\s\S]{0,500}title="出行与交通"/);
  assert.doesNotMatch(panel, /<Section g="world" title="出行与交通"/);

  // 开局封面（画布布局）→ ① 基础；开场白 → 剧情；固定事件含首次
  assert.match(panel, /title="开局封面"/);
  const coverSec = panel.slice(panel.indexOf('title="开局封面"'), panel.indexOf('title="功能开关"'));
  assert.match(coverSec, /g="base"/);
  assert.match(coverSec, /ModCoverEditor/);
  assert.match(panel, /title="开场剧情"/);
  const openingSec = panel.slice(panel.indexOf('title="开场剧情"'), panel.indexOf('title="固定事件"'));
  assert.doesNotMatch(openingSec, /ModCoverEditor/);
  assert.match(panel, /title="固定事件"/);
  assert.match(panel, /首次事件/);
});

test('ModEditorPanel_开局资金与开场白不得有第二处写入', () => {
  const moneyWrites = [...panel.matchAll(/setC\(\{\s*startMoney:/g)];
  assert.equal(moneyWrites.length, 1, 'startMoney 只能有一处 setC 写入');
  // 功能注释：开局天气入口已删，禁止再写 weather 字段（旧数据仍可残留在 content 中）
  const weatherWrites = [...panel.matchAll(/setC\(\{\s*weather:/g)];
  assert.equal(weatherWrites.length, 0, 'weather 不应再有编辑器写入入口');
  const coverWrites = [...panel.matchAll(/setC\(\{\s*\.\.\.c,\s*cover\s*\}/g)];
  assert.equal(coverWrites.length, 1, 'cover 只能有一处 setC 写入');
});
