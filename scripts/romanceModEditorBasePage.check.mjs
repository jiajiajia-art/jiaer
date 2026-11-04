/**
 * ①基础页五处回归：简介摘要、剧本基调 AI 填入、开局日期数字选择、
 * 删除换地点扣点与日程叙事字数配置。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('简介_长设定须摘要约100字_禁止slice原文照搬', async () => {
  const wiz = await import(pathToFileURL(join(romance, 'lib/worldGenWizard.ts')).href);
  const long =
    '王朝背景：大衍立国二百余年，外戚干政，后宫争宠，边患频仍。'.repeat(10) +
    '创作者输入的长设定原文不得整段进入简介字段。';
  const summary = wiz.summarizeWorldGenDescription(long, '帝王后宫模拟器');
  assert.ok(summary.length <= 120);
  assert.ok(summary.length >= 8);
  assert.notEqual(summary, long.slice(0, 200));
  assert.doesNotMatch(summary, /不得整段进入简介/);

  const short = '海边小旅馆的继承故事。';
  assert.equal(wiz.summarizeWorldGenDescription(short, '雾港'), short);

  const seed = wiz.draftModFromWorldGen({
    ...wiz.defaultWorldGenStep1(),
    title: '帝王后宫模拟器',
    setting: long,
    editorStepIds: [...wiz.DEFAULT_WORLD_GEN_EDITOR_STEP_IDS],
  });
  assert.ok(seed.description.length <= 120);
  assert.notEqual(seed.description, long.slice(0, 200));
  assert.equal(seed.content.prompt.worldIntro, undefined);
  assert.equal(seed.content.prompt.scriptTone, undefined);
});

test('剧本基调_生成须写scriptTone并校验字数_简介可从manifest写入', async () => {
  const gen = await import(pathToFileURL(join(romance, 'lib/worldGenGenerate.ts')).href);
  const wiz = await import(pathToFileURL(join(romance, 'lib/worldGenWizard.ts')).href);
  const lim = await import(pathToFileURL(join(romance, 'lib/modBasicInfoLimits.ts')).href);

  const draft = {
    ...wiz.defaultWorldGenStep1(),
    title: '帝王后宫',
    setting: '大衍后宫争宠。'.repeat(20),
    editorStepIds: ['prompt'],
    contentIds: wiz.contentIdsFromEditorSteps(['prompt']),
  };
  const seedRaw = wiz.draftModFromWorldGen(draft);
  const { meta: _m, ...seedMod } = seedRaw;
  void _m;

  const tone = `${'你是大衍后宫题材的叙事主持人，须严格遵守礼制与人物动机。'.repeat(40)}`;
  assert.ok(tone.length > 80 && tone.length <= lim.SCRIPT_TONE_MAX);

  const result = await gen.generateWorldGenBatch({
    batch: { id: 'worldRules', name: '世界规则', group: '世界规则', stepIds: ['prompt'] },
    draft,
    mod: seedMod,
    completeFn: async () =>
      JSON.stringify({
        manifest: { description: '大衍立国后的后宫权谋模拟，玩家周旋于帝后与外戚之间。' },
        content: { prompt: { scriptTone: tone } },
      }),
    cfg: { baseUrl: 'https://example.test/v1', apiKey: 'k', model: 'm' },
  });

  assert.equal(result.mod.content.prompt.scriptTone, tone);
  assert.match(result.mod.description, /后宫/);
  assert.ok(result.mod.description.length <= lim.MOD_DESC_MAX);
  assert.notEqual(result.mod.description, draft.setting.slice(0, 200));

  await assert.rejects(
    () =>
      gen.generateWorldGenBatch({
        batch: { id: 'worldRules', name: '世界规则', group: '世界规则', stepIds: ['prompt'] },
        draft,
        mod: seedMod,
        completeFn: async () => JSON.stringify({ content: { prompt: { scriptTone: '太短' } } }),
        cfg: { baseUrl: 'https://example.test/v1', apiKey: 'k', model: 'm' },
      }),
    /剧本基调过短/,
  );

  const over = `${'字'.repeat(lim.SCRIPT_TONE_MAX + 10)}`;
  const capped = await gen.generateWorldGenBatch({
    batch: { id: 'worldRules', name: '世界规则', group: '世界规则', stepIds: ['prompt'] },
    draft,
    mod: seedMod,
    completeFn: async () =>
      JSON.stringify({
        content: { prompt: { scriptTone: `${'你是叙事主持人。'.repeat(20)}${over}` } },
      }),
    cfg: { baseUrl: 'https://example.test/v1', apiKey: 'k', model: 'm' },
  });
  // 清洗阶段会截断到 SCRIPT_TONE_MAX，软校验通过后长度不得超过上限
  assert.ok((capped.mod.content.prompt.scriptTone || '').length <= lim.SCRIPT_TONE_MAX);

  assert.equal(lim.isScriptToneOverLimit('字'.repeat(4001)), true);
  assert.equal(lim.validateModBasicInfoLimits({ scriptTone: '字'.repeat(4001) }), `剧本基调最多 ${lim.SCRIPT_TONE_MAX} 字`);
});

test('开局日期_div模拟选择_禁止原生select与自由字符串', () => {
  const panel = read('Romance/src/components/ModEditorPanel.tsx');
  const selects = read('Romance/src/components/StartDateSelects.tsx');
  const lib = read('Romance/src/lib/startDateFields.ts');
  const css = read('Romance/src/index.css');
  assert.match(panel, /StartDateSelects/);
  assert.doesNotMatch(panel, /placeholder="2005\.01\.03"/);
  assert.doesNotMatch(panel, /author-field-start-date" className=\{`\$\{inp\} font-mono`\}/);
  assert.match(selects, /aria-label=\{`开局\$\{label\}`\}|开局\$\{label\}/);
  assert.match(selects, /label="年"|label:\s*"年"/);
  assert.match(selects, /label="月"|label:\s*"月"/);
  assert.match(selects, /label="日"|label:\s*"日"/);
  assert.match(selects, /start-date-trigger|start-date-panel/);
  // 功能注释：注释可提原生 select；生产 JSX 不得出现真实标签
  assert.doesNotMatch(selects, /return \([\s\S]*<select[\s>]/);
  assert.doesNotMatch(selects, /<select[\s>][\s\S]*<\/select>/);
  assert.doesNotMatch(selects, /type=["']date["']/);
  assert.match(css, /\.start-date-trigger/);
  assert.match(css, /\.start-date-opt\.is-on/);
  assert.match(lib, /formatStartDate/);
  assert.match(lib, /parseStartDateParts/);
});

test('开局日期字段库_解析格式化与月末夹取', async () => {
  const d = await import(pathToFileURL(join(romance, 'lib/startDateFields.ts')).href);
  assert.deepEqual(d.parseStartDateParts('2005.01.03'), { year: 2005, month: 1, day: 3 });
  assert.deepEqual(d.parseStartDateParts('2005-1-3'), { year: 2005, month: 1, day: 3 });
  assert.equal(d.parseStartDateParts('乱填'), null);
  assert.equal(d.formatStartDate({ year: 2005, month: 1, day: 3 }), '2005.01.03');
  assert.equal(d.daysInMonth(2024, 2), 29);
  assert.equal(d.daysInMonth(2025, 2), 28);
  assert.deepEqual(d.clampStartDateParts({ year: 2025, month: 2, day: 31 }), {
    year: 2025,
    month: 2,
    day: 28,
  });
});

test('时间与推进_删除换地点扣点与日程叙事字数配置', () => {
  const travel = read('Romance/src/components/ModTravelEditor.tsx');
  const panel = read('Romance/src/components/ModEditorPanel.tsx');
  // 功能注释：只禁 UI 标签；注释可提“叙事字数”内置，但不得再出现可编辑控件文案
  assert.doesNotMatch(travel, /换一次地点扣/);
  assert.doesNotMatch(travel, />日程叙事字数</);
  assert.doesNotMatch(travel, /label className="block text-\[11px\] text-ink-soft">日程叙事字数/);
  assert.match(travel, /delete next\.apPerMove/);
  assert.match(travel, /delete next\.advanceWords/);
  assert.match(panel, /apPerMove: _ap/);
  assert.match(panel, /advanceWords: _aw/);
  // 运行时仍保留默认扣点与默认字数
  const mud = read('Romance/src/game/mud.ts');
  assert.match(mud, /export const apPerMove = \(\) => Math\.max\(0, Math\.round\(TRAVEL\.apPerMove \?\? 1\)\)/);
  assert.match(mud, /export const advanceWords = \(\) => Math\.max\(100, Math\.min\(2000, Math\.round\(TRAVEL\.advanceWords \?\? 500\)\)\)/);
});

test('编辑器文案_简介与基调说明对齐图注需求', () => {
  const panel = read('Romance/src/components/ModEditorPanel.tsx');
  assert.match(panel, /按世界观摘要的约 100 字简介/);
  assert.match(panel, /默认是世界观摘要，不是创作者长设定原文/);
  assert.match(panel, /生成世界时由 AI 写出并填入/);
  assert.match(panel, /超出 4000 字标红，不能照常保存/);
  // 功能注释：开局日期下灰字已删，只留年/月/日选择
  assert.doesNotMatch(panel, /格式固定为年\.月\.日，只选数字/);
  assert.doesNotMatch(panel, /这天是周/);
});

test('时间与推进_节奏与次数并成一块_数量贴选中单位旁', () => {
  const travel = read('Romance/src/components/ModTravelEditor.tsx');
  assert.match(travel, /默认推进节奏/);
  assert.match(travel, /日\/周\/月\/年与「每次几个」并成一块/);
  assert.match(travel, /aria-label=\{`每次推进（\$\{unitLabel\}）`\}/);
  assert.match(travel, /flex flex-wrap items-stretch gap-1/);
  // 功能注释：禁止再上下拆「单位四格」与「每次推进」两段表单
  assert.doesNotMatch(travel, /每次推进（天）/);
  assert.doesNotMatch(travel, /grid grid-cols-4 gap-1[\s\S]{0,400}每次推进（/);
});
