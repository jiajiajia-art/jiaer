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
  assert.match(panel, /k: "look", label: "⑤ 美化"/);
  assert.match(panel, /label: "④ 剧情"/);
  assert.doesNotMatch(panel, /label: "⑤ 玩法 Mod"/);
  assert.doesNotMatch(panel, /k: "play"/);
  assert.doesNotMatch(panel, /label: "④ 世界"/);
  assert.doesNotMatch(panel, /\{ k: "world", label:/);
  assert.doesNotMatch(panel, /label: "⑦ 功能扩展"/);
  assert.doesNotMatch(panel, /ModExtEditor/);
  assert.doesNotMatch(panel, /exports\.actions|JsonField|私有变量/);
});

test('ModEditorPanel_字段应按系统归入唯一入口', () => {
  // 时间 → 时间与推进（切片止于下一块「头像」，勿把建角资金算进时间区）
  assert.match(panel, /title="时间与推进"/);
  const timeSec = panel.slice(panel.indexOf('title="时间与推进"'), panel.indexOf('title="头像"'));
  assert.match(timeSec, /开局日期/);
  // 功能注释：已下线「几点几分」与「建角自选开局日期」
  assert.doesNotMatch(timeSec, /开局时刻/);
  assert.doesNotMatch(timeSec, /每天几点开始/);
  assert.doesNotMatch(timeSec, /几点算一天结束/);
  assert.doesNotMatch(timeSec, /建角时让玩家自选开局日期/);
  assert.doesNotMatch(timeSec, /最早可选|最晚可选/);
  assert.doesNotMatch(timeSec, /pickStartDate/);
  assert.doesNotMatch(timeSec, /startTime|dayStart|dayEnd/);
  // 允许文案指向其它分组，但禁止在本区再出现资金 / 天气表单项
  assert.doesNotMatch(timeSec, />开局资金</);
  assert.doesNotMatch(timeSec, />开局天气</);
  assert.doesNotMatch(timeSec, /startMoney/);
  assert.doesNotMatch(timeSec, /weather/);

  // 资金 → ①基础·建角统一列表内的货币项（不再单独大栏）；养成页按模块勾选
  assert.doesNotMatch(panel, /title="开局资源"/);
  assert.match(panel, /title="建角"/);
  assert.match(panel, /GROW_MODULE_META/);
  assert.match(panel, /title="总养成开关"/);
  const baseCreate = panel.slice(panel.indexOf('title="建角"'), panel.indexOf('title="地点"'));
  assert.match(baseCreate, /startMoney=\{c\.startMoney\}/);
  assert.match(baseCreate, /onStartMoney=/);
  assert.match(baseCreate, /ModCreationFieldsEditor/);
  assert.match(baseCreate, /g="base"/);
  assert.ok(panel.indexOf('title="建角"') < panel.indexOf('title="地点"'), '建角须在地点之上');
  assert.ok(panel.indexOf('title="头像"') < panel.indexOf('title="建角"'), '头像须在建角之上');
  // 功能注释：开局资金锚点落在统一建角字段编辑器内
  const fieldsEd = readFileSync(join(root, 'Romance/src/components/ModCreationFieldsEditor.tsx'), 'utf8');
  assert.match(fieldsEd, /开局资金/);
  assert.match(fieldsEd, /authorField: "author-field-start-money"/);

  // 地点并入①基础；开局天气已删；出行迁至玩法 Mod（showPlay）
  assert.doesNotMatch(panel, /title="开局天气"/);
  assert.match(panel, /<Section g="base" title="地点"/);
  assert.match(panel, /ModRoomTreeEditor/);
  assert.match(panel, /startRoom=\{c\.startRoom\}/);
  assert.doesNotMatch(panel, />起始地点</);
  assert.match(panel, /showPlay\("travel"\)[\s\S]{0,500}title="出行与交通"/);
  assert.doesNotMatch(panel, /<Section g="world"/);

  // 作品封面在①基础·基本信息；开场剧情在⑤美化；地点与固定事件留在原页
  assert.match(panel, /<Section\s+g="base" title="地点"/);
  const basicAt = panel.indexOf('title="基本信息"');
  assert.ok(basicAt >= 0);
  assert.match(panel.slice(basicAt, basicAt + 2200), /ModCoverEditor/);
  assert.match(panel.slice(basicAt, basicAt + 2200), /作品封面/);
  assert.doesNotMatch(panel, /title="开局封面"/);
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
  assert.ok(panel.indexOf('title="基本信息"') < panel.indexOf('title="地点"'), '基本信息（含作品封面）须在地点之前');
});

test('ModEditorPanel_应去掉全部分组与全部展开_默认基础_搜索仍跨组', () => {
  // 功能注释：顶栏不再提供「全部」页签与「全部展开」；默认停在①基础；有关键词时仍按标题/hint 跨组过滤
  assert.doesNotMatch(panel, /k:\s*"all",\s*label:\s*"全部"/);
  assert.doesNotMatch(panel, /全部展开|全部收起/);
  assert.match(panel, /cur:\s*"base"/);
  assert.match(panel, /raw === "world" \|\| raw === "all" \? "base"/);
  assert.match(panel, /有搜索词时跨分组展示命中项/);
  assert.match(panel, /s \? !\(title \+ \(hint \?\? ""\)\)\.toLowerCase\(\)\.includes\(s\)/);
});

test('ModEditorPanel_保存入口仅在顶栏_无底栏保存条', () => {
  assert.match(panel, /顶栏只留「保存 \/ 放弃 \/ 预览」/);
  assert.doesNotMatch(panel, /["']保存并返回["']/);
  assert.doesNotMatch(panel, />\s*保存并返回\s*</);
  assert.doesNotMatch(panel, /placeholder="搜索设置项/);
  assert.match(panel, /onClick=\{openPreview\}/);
  assert.doesNotMatch(panel, /sticky bottom-0/);
});

test('ModEditorPanel_开局资金与开场白不得有第二处写入', () => {
  const moneyWrites = [...panel.matchAll(/setC\(\{\s*startMoney:/g)];
  assert.equal(moneyWrites.length, 1, 'startMoney 只能有一处 setC 写入');
  // 功能注释：开局天气入口已删，禁止再写 weather 字段（旧数据仍可残留在 content 中）
  const weatherWrites = [...panel.matchAll(/setC\(\{\s*weather:/g)];
  assert.equal(weatherWrites.length, 0, 'weather 不应再有编辑器写入入口');
  // 功能注释：作品封面经 setM 同步 manifest.cover + content.cover，禁止另起 setC 旁路
  const coverViaSetM = [...panel.matchAll(/setM\(\{[\s\S]{0,120}content:\s*\{\s*\.\.\.c,\s*cover\s*\}/g)];
  assert.equal(coverViaSetM.length, 1, 'cover 只能经一处 setM 同步写入');
  assert.equal([...panel.matchAll(/setC\(\{\s*\.\.\.c,\s*cover\s*\}/g)].length, 0, '禁止再用 setC 单独写 cover');
});