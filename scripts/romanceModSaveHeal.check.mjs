/**
 * 模组保存自愈完整回归：
 * - null / 缺 id / 空白 id / 非对象项都能补
 * - 未挂靠世界书自动停用
 * - 自愈后不应再出现缺 id / 世界书依赖错误
 * - 顶栏错误条人话 + 可跳转；保存路径走 prepareModForSave
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const read = (rel) => readFileSync(join(romance, rel), 'utf8');
const heal = await import(pathToFileURL(join(romance, 'lib/modSaveHeal.ts')).href);

function needIdErrors(ct) {
  const errs = [];
  const keys = [
    'npcs', 'items', 'gigs', 'events', 'fixedEvents', 'storylines', 'sidelines',
    'endings', 'worldBook', 'worldRules', 'gameRules', 'lookRules',
  ];
  for (const k of keys) {
    (Array.isArray(ct[k]) ? ct[k] : []).forEach((e, i) => {
      if (!e || typeof e.id !== 'string' || !e.id) errs.push(`content.${k}[${i}] 缺少 id`);
    });
  }
  return errs;
}

test('healMissingContentIds_应为缺id的固定事件补编号', () => {
  const content = {
    fixedEvents: [
      { name: '入宫', prompt: '初入宫门' },
      { id: 'fx_ok', name: '已有', prompt: 'x' },
    ],
  };
  const notes = heal.healMissingContentIds(content);
  assert.equal(typeof content.fixedEvents[0].id, 'string');
  assert.ok(content.fixedEvents[0].id.length >= 4);
  assert.equal(content.fixedEvents[1].id, 'fx_ok');
  assert.ok(notes.some((n) => n.includes('固定事件') && n.includes('第 1 条')));
});

test('healMissingContentIds_null与非对象项也要补成带id对象', () => {
  const content = {
    fixedEvents: [
      null,
      undefined,
      '只是字符串',
      { name: '无编号' },
      { id: '', name: '空串' },
      { id: '   ', name: '空白' },
    ],
  };
  const before = needIdErrors(content);
  assert.ok(before.length >= 5, `自愈前应大量缺 id，实际 ${before.length}`);
  const notes = heal.healMissingContentIds(content);
  assert.equal(needIdErrors(content).length, 0);
  assert.equal(content.fixedEvents.length, 6);
  assert.ok(content.fixedEvents.every((e) => e && typeof e.id === 'string' && e.id.trim()));
  assert.ok(notes.length >= 5);
});

test('healUnboundWorldBook_未挂靠也不再停用', () => {
  const content = {
    worldBook: [
      { id: 'wb1', title: '卷', content: '宫规', enabled: true },
      { id: 'wb2', title: '有挂', content: 'x', enabled: true, bindRooms: ['palace'] },
    ],
  };
  const notes = heal.healUnboundWorldBook(content);
  assert.equal(content.worldBook[0].enabled, true);
  assert.equal(content.worldBook[1].enabled, true);
  assert.deepEqual(notes, []);
});

test('prepareModForSave_完整脏AI稿_自愈后无缺id无世界书拦阻', () => {
  const dirty = {
    id: 'ai-queen',
    name: '皇后成长计划',
    version: '0.1.0',
    kind: 'world',
    content: {
      prompt: { scriptTone: '宫廷' },
      rooms: { palace: { name: '宫殿', desc: '皇宫', exits: {} } },
      startRoom: 'palace',
      fixedEvents: [
        null,
        { name: '入宫', prompt: '选秀' },
        { name: '初见', prompt: '见驾' },
        { name: '封妃', prompt: '册封' },
        { id: '', name: '空', prompt: 'x' },
      ],
      worldBook: [
        { id: 'wb1', title: '卷', content: '宫规', enabled: true },
        { id: 'wb2', title: '疲劳值', content: '累', enabled: true },
      ],
      storylines: [{ name: '主线' }],
      endings: [null, { name: '结局' }],
      npcs: [{ id: 'emperor', name: '皇上', age: 28, gender: '男' }],
    },
  };
  assert.ok(needIdErrors(dirty.content).length >= 6);
  const { mod, notes } = heal.prepareModForSave(dirty);
  assert.ok(notes.length >= 6);
  assert.equal(heal.collectPostHealIdAndWorldBookErrors(mod.content).length, 0);
  assert.equal(needIdErrors(mod.content).length, 0);
  // 入参不被改写
  assert.equal(dirty.content.fixedEvents[0], null);
  assert.equal(dirty.content.worldBook[0].enabled, true);
});

/** 与 validateMod 同款：脏 startMoney 会拦保存（不整包 import registry，避免 saveScope 解析链） */
function startMoneyValidateErr(ct) {
  if (ct.startMoney !== undefined && (typeof ct.startMoney !== 'number' || !Number.isFinite(ct.startMoney) || ct.startMoney < 0)) {
    return 'content.startMoney 须为非负数字';
  }
  return null;
}

test('prepareModForSave_脏startMoney字符串负数null_自愈后通过validate', () => {
  for (const dirtyMoney of ['1000', '-3', null, Number.NaN, {}, 'abc']) {
    const dirty = {
      id: 'money-dirty',
      name: '资金脏稿',
      version: '0.1.0',
      kind: 'world',
      content: {
        prompt: { scriptTone: '测' },
        rooms: { a: { name: '厅', desc: 'x', exits: {} } },
        startRoom: 'a',
        startMoney: dirtyMoney,
        moneyLabel: '',
      },
    };
    assert.ok(startMoneyValidateErr(dirty.content), `脏值 ${String(dirtyMoney)} 在自愈前应被拦`);
    const { mod, notes } = heal.prepareModForSave(dirty);
    assert.equal(typeof mod.content.startMoney, 'number');
    assert.ok(mod.content.startMoney >= 0);
    assert.equal(mod.content.moneyLabel, '元');
    assert.ok(notes.some((n) => /开局资金|货币/.test(n)));
    assert.equal(startMoneyValidateErr(mod.content), null);
  }
});

test('healStartMoney_无资金字段的扩展模组不强制写入', () => {
  const content = { prompt: { scriptTone: '扩展' } };
  const notes = heal.healStartMoney(content);
  assert.equal(notes.length, 0);
  assert.equal(content.startMoney, undefined);
});

test('humanizeSaveError_技术串改人话', () => {
  assert.equal(heal.humanizeSaveError('content.fixedEvents[0] 缺少 id'), '「固定事件」第 1 条缺少编号');
  assert.equal(
    heal.humanizeSaveError('世界书「疲劳值」未挂地点或人物，不能保存'),
    '世界书「疲劳值」还没挂地点或人物',
  );
  assert.equal(heal.humanizeSaveError('content.startMoney 须为非负数字'), '开局资金须为非负数字（可填 0）');
  assert.equal(heal.humanizeSaveError('content.gameRules[0].branches 须为数组（每项 { conds, effects }）'), '「玩法规则」第 1 条的分支格式不对');
  assert.equal(heal.humanizeSaveError('content.opening 须为对象'), '开场剧情须为对象（含段落文案）');
  assert.equal(heal.resolveSaveErrorJump('content.fixedEvents[2] 缺少 id')?.target, 'fixed-events');
  assert.equal(heal.resolveSaveErrorJump('世界书「卷」未挂地点或人物，不能保存')?.target, 'world-book');
  assert.equal(heal.resolveSaveErrorJump('content.startMoney 须为非负数字')?.target, 'author-field-start-money');
  assert.equal(heal.resolveSaveErrorJump('content.gameRules[1].branches 须为数组')?.target, 'grow-modules');
  assert.equal(heal.resolveSaveErrorJump('content.opening 须为对象')?.target, 'author-field-opening');
});

/** 与 validateMod 同款形态检查（不整包 import registry，避免 saveScope 解析链） */
function gameRulesOpeningShapeErrs(ct) {
  const errs = [];
  if (Array.isArray(ct.gameRules)) {
    ct.gameRules.forEach((e, i) => {
      if (e && typeof e.id === 'string' && e.id && !Array.isArray(e.branches)) {
        errs.push(`content.gameRules[${i}].branches 须为数组（每项 { conds, effects }）`);
      }
    });
  }
  if (ct.opening !== undefined && (typeof ct.opening !== 'object' || ct.opening === null || Array.isArray(ct.opening))) {
    errs.push('content.opening 须为对象');
  }
  return errs;
}

test('prepareModForSave_脏gameRules缺branches与脏opening_自愈后通过validate形态', () => {
  const dirty = {
    id: 'rules-open',
    name: '规则开场脏稿',
    version: '0.1.0',
    kind: 'world',
    content: {
      prompt: { scriptTone: '测' },
      rooms: { a: { name: '厅', desc: 'x', exits: {} } },
      startRoom: 'a',
      gameRules: [
        { id: 'r1', name: '过劳', when: 'day' },
        { id: 'r2', name: '单支', when: 'week', branches: { conds: [], effects: [{ kind: 'metric', key: 'stress', delta: 1 }] } },
      ],
      opening: ['第一段开场', '第二段开场'],
    },
  };
  const before = gameRulesOpeningShapeErrs(dirty.content);
  assert.ok(before.some((e) => /gameRules\[0\]\.branches/.test(e)));
  assert.ok(before.some((e) => /opening 须为对象/.test(e)));
  const { mod, notes } = heal.prepareModForSave(dirty);
  assert.ok(Array.isArray(mod.content.gameRules[0].branches));
  assert.equal(mod.content.gameRules[1].branches.length, 1);
  assert.equal(typeof mod.content.opening, 'object');
  assert.ok(!Array.isArray(mod.content.opening));
  assert.deepEqual(mod.content.opening.paragraphs, ['第一段开场', '第二段开场']);
  assert.ok(notes.some((n) => /branches|开场/.test(n)));
  assert.deepEqual(gameRulesOpeningShapeErrs(mod.content), []);
});

test('ModEditorPanel_保存前prepareModForSave且错误条可点跳', () => {
  const panel = read('components/ModEditorPanel.tsx');
  assert.match(panel, /prepareModForSave/);
  assert.match(panel, /humanizeSaveError/);
  assert.match(panel, /goSaveError/);
  assert.match(panel, /data-save-error-banner/);
  assert.match(panel, /data-save-heal-notes/);
  assert.match(panel, /还差 \{errors\.length\} 处才能保存/);
  assert.doesNotMatch(panel, /还有 \{errors\.length\} 处需要修改才能保存/);
  assert.match(panel, /target="world-book"/);
  assert.match(panel, /target="fixed-events"/);
  const saveFn = panel.slice(panel.indexOf('const save = (stay = false)'), panel.indexOf('const cancel ='));
  assert.match(saveFn, /prepareModForSave\(cleaned\)/);
  assert.match(saveFn, /worldBookMissingDepsErrors\(out\.content\.worldBook\)/);
  assert.doesNotMatch(saveFn, /healModBeforeSave\(out\.content\)/);
  assert.doesNotMatch(saveFn, /worldBookMissingDepsErrors\(c\.worldBook\)/);
});
