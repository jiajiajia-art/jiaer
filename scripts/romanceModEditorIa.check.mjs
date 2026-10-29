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
  assert.match(panel, /k: "look", label: "⑥ 美化"/);
  assert.match(panel, /label: "④ 剧情"/);
  assert.match(panel, /label: "⑤ 玩法 Mod"/);
  assert.doesNotMatch(panel, /label: "④ 世界"/);
  assert.doesNotMatch(panel, /\{ k: "world", label:/);
  assert.doesNotMatch(panel, /label: "⑦ 功能扩展"/);
  assert.doesNotMatch(panel, /ModExtEditor/);
  assert.doesNotMatch(panel, /exports\.actions|JsonField|私有变量/);
});

test('ModEditorPanel_字段应按系统归入唯一入口', () => {
  // 时间 → 时间与推进
  assert.match(panel, /title="时间与推进"/);
  const timeSec = panel.slice(panel.indexOf('title="时间与推进"'), panel.indexOf('title="地点"'));
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

  // 地点并入①基础；开局天气已删；出行迁至玩法 Mod（showPlay）
  assert.doesNotMatch(panel, /title="开局天气"/);
  assert.match(panel, /<Section g="base" title="地点"/);
  assert.match(panel, /ModRoomTreeEditor/);
  assert.match(panel, /startRoom=\{c\.startRoom\}/);
  assert.doesNotMatch(panel, />起始地点</);
  assert.match(panel, /showPlay\("travel"\)[\s\S]{0,500}title="出行与交通"/);
  assert.doesNotMatch(panel, /<Section g="world"/);

  // 开局封面与开场剧情整块在⑥美化；地点与固定事件留在原页
  assert.match(panel, /<Section\s+g="base" title="地点"/);
  const coverAt = panel.indexOf('title="开局封面"');
  assert.match(panel.slice(Math.max(0, coverAt - 80), coverAt), /g="look"/);
  assert.match(panel, /ModCoverEditor/);
  const openingAt = panel.indexOf('title="开场剧情"');
  assert.match(panel.slice(Math.max(0, openingAt - 40), openingAt), /g="look"/);
  const openingSec = panel.slice(openingAt, panel.indexOf('title="剧情美化"'));
  assert.match(openingSec, /开场页外观/);
  assert.match(openingSec, /OpeningStyleStudio/);
  // 功能注释：下架第二套开场白表单，禁止再出现顶部小字等输入
  assert.doesNotMatch(openingSec, /ModOpeningEditor/);
  assert.doesNotMatch(openingSec, /ui-label border-t[\s\S]*开场白|>开场白</);
  assert.doesNotMatch(openingSec, /顶部小字|正文段落|浮现完提示|序幕视频|按钮文案/);
  assert.doesNotMatch(openingSec, /ModCoverEditor/);
  assert.match(panel, /title="固定事件"/);
  assert.match(panel, /首次事件/);
  assert.ok(panel.indexOf('title="地点"') < coverAt, '源码里地点区块须排在开局封面之前（搜索跨组时顺序仍正确）');
});

test('ModEditorPanel_应去掉全部分组与全部展开_默认基础_搜索仍跨组', () => {
  // 功能注释：顶栏不再提供「全部」页签与「全部展开」；默认停在①基础；有关键词时仍按标题/hint 跨组过滤
  assert.doesNotMatch(panel, /k:\s*"all",\s*label:\s*"全部"/);
  assert.doesNotMatch(panel, /全部展开|全部收起/);
  assert.match(panel, /cur:\s*"base"/);
  assert.match(panel, /initialGroup === "world" \|\| initialGroup === "all" \? "base"/);
  assert.match(panel, /有搜索词时跨分组展示命中项/);
  assert.match(panel, /s \? !\(title \+ \(hint \?\? ""\)\)\.toLowerCase\(\)\.includes\(s\)/);
});

test('ModEditorPanel_保存入口仅在顶栏_无底栏保存条', () => {
  assert.match(panel, /保存入口只放顶栏/);
  assert.match(panel, /dirty \|\| !persisted \? "保存并返回" : "返回"/);
  assert.match(panel, /onClick=\{openPreview\}/);
  assert.doesNotMatch(panel, /sticky bottom-0/);
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
