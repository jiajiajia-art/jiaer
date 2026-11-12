/**
 * 局内选项 2～4：禁止短句/残缺；须角色名+完整话术；不足时补全
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  choiceStepHasPlayableOptions,
  countPlayChoiceOptions,
  ensureMinPlayChoiceOptions,
  hasEnoughPlayChoiceOptions,
  PLAY_CHOICE_OPTION_MAX,
  PLAY_CHOICE_OPTION_MIN,
  PLAY_CHOICE_OPTION_TEXT_MIN,
  buildPlayChoiceFallbackTexts,
  isUsablePlayChoiceOptionText,
  looksLikeIncompletePlayChoiceOption,
  normalizePlayChoiceOptionText,
} from '../src/lib/galgame/playChoiceOptions.ts';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

test('ensureMinPlayChoiceOptions_丢弃残缺并按角色动宾补到2', () => {
  assert.equal(PLAY_CHOICE_OPTION_MIN, 2);
  assert.equal(PLAY_CHOICE_OPTION_MAX, 4);
  assert.equal(PLAY_CHOICE_OPTION_TEXT_MIN, 4);
  assert.equal(isUsablePlayChoiceOptionText('立刻'), false);
  assert.equal(isUsablePlayChoiceOptionText('离开'), false);
  assert.equal(isUsablePlayChoiceOptionText('把怀里的'), false);
  assert.equal(looksLikeIncompletePlayChoiceOption('把怀里的'), true);

  const four = ensureMinPlayChoiceOptions([
    { text: '仔细推进主线剧情甲' },
    { text: '四处观察周围环境乙' },
    { text: '先去找人打听消息丙' },
    { text: '回房休息整理思绪丁' },
    { text: '再去别的地方看看戊' },
  ], { playerName: '苏婉仪' });
  assert.equal(four.length, 4);
  assert.ok(four.every((o) => o.text.startsWith('苏婉仪')));
  assert.equal(hasEnoughPlayChoiceOptions([{ text: 'only' }]), false);

  const padded = ensureMinPlayChoiceOptions(
    [{ id: 1, text: '把怀里的' }, { id: 2, text: '尝试与陈嬷嬷交谈探听' }],
    { sceneName: '冷宫偏殿', npcNames: ['陈嬷嬷'], playerName: '苏婉仪' },
  );
  assert.equal(padded.length, 2);
  assert.ok(!padded.some((o) => o.text.includes('把怀里的')));
  assert.ok(padded.every((o) => o.text.startsWith('苏婉仪')));
  assert.ok(padded.some((o) => o.text.includes('陈嬷嬷')));
});

test('normalizePlayChoiceOptionText_补角色名', () => {
  assert.equal(normalizePlayChoiceOptionText('把怀里的', '苏婉仪'), '');
  assert.equal(normalizePlayChoiceOptionText('苏婉仪去柴房找罗', '苏婉仪'), '');
  assert.equal(
    normalizePlayChoiceOptionText('独自前往冷宫偏殿', '苏婉仪'),
    '苏婉仪独自前往冷宫偏殿',
  );
  assert.equal(
    normalizePlayChoiceOptionText('苏婉仪去柴房找罗', '苏婉仪', ['罗秀英']),
    '苏婉仪去柴房找罗秀英',
  );
});

test('buildPlayChoiceFallbackTexts_角色加动宾', () => {
  const list = buildPlayChoiceFallbackTexts({
    sceneName: '冷宫',
    npcNames: ['皇后'],
    playerName: '苏糖',
  });
  assert.ok(list.every((t) => Array.from(t).length >= 4));
  assert.ok(list.some((t) => t.includes('苏糖') && t.includes('冷宫')));
  assert.ok(list.some((t) => t.includes('苏糖') && t.includes('皇后')));
});

test('choiceStepHasPlayableOptions_须认mainOptions', () => {
  assert.equal(
    choiceStepHasPlayableOptions({
      type: 'choice',
      mainOptions: ['仔细推进主线剧情', '四处观察周围环境'],
      options: [],
    }),
    true,
  );
  assert.equal(
    countPlayChoiceOptions({
      mainOptions: ['仔细推进主线剧情'],
      options: ['四处观察周围环境', '先去找人打听消息'],
    }),
    3,
  );
  assert.equal(
    choiceStepHasPlayableOptions({ type: 'choice', options: [] }),
    false,
  );
  assert.equal(
    choiceStepHasPlayableOptions({ type: 'choice', options: ['立刻'] }),
    false,
  );
  assert.equal(
    choiceStepHasPlayableOptions({ type: 'choice', options: ['把怀里的'] }),
    false,
  );
});

test('NormalModeDisplay_有选项即展示且禁止不足2门闸', () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(dir, '../src/components/Galgame/NormalModeDisplay.tsx'), 'utf8');
  assert.doesNotMatch(src, /hasEnoughPlayChoiceOptions/);
  assert.match(src, /currentMessage\.options\.length\s*>\s*0/);
});

test('NormalModeDisplay_选项须全宽单列横条禁止两列夹角色', () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  const css = readFileSync(join(dir, '../src/components/Galgame/NormalModeDisplay.module.css'), 'utf8');
  const container = css.match(/\.choiceContainer\s*\{[^}]+\}/s)?.[0] || '';
  const option = css.match(/\.choiceOption\s*\{[^}]+\}/s)?.[0] || '';
  assert.match(container, /flex-direction:\s*column/);
  assert.match(container, /align-items:\s*stretch/);
  assert.doesNotMatch(container, /grid-template-columns:\s*repeat\(2/);
  assert.doesNotMatch(css, /\.choiceContainer\s*>\s*\.choiceOption:last-child:nth-child\(odd\)/);
  assert.match(option, /width:\s*100%/);
  assert.match(option, /background:\s*(?:rgba\(0,\s*0,\s*0,\s*0\.58\)|var\(--|color-mix\()/);
  assert.doesNotMatch(option, /background:\s*transparent/);
  assert.doesNotMatch(option, /skewX\(-6deg\)/);
});

test('TextModeDisplay_选项须卡片横条禁止斜切HUD', () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  const css = readFileSync(join(dir, '../src/components/Galgame/TextModeDisplay.module.css'), 'utf8');
  const option = css.match(/\.optionItem\s*\{[^}]+\}/s)?.[0] || '';
  assert.match(option, /width:\s*100%/);
  assert.match(option, /background:\s*(?:rgba\(0,\s*0,\s*0,\s*0\.58\)|var\(--|color-mix\()/);
  assert.match(option, /border-radius:\s*0\.45rem/);
  assert.doesNotMatch(option, /skewX\(/);
  assert.doesNotMatch(css, /optionHudScanDrift/);
  assert.doesNotMatch(css, /optionHudTextDrift/);
  assert.match(css, /counter-increment:\s*text-mode-option/);
});

test('useGalgameMessage_须ensureMin且传playerName', () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(dir, '../src/hooks/galgame/useGalgameMessage.ts'), 'utf8');
  assert.match(src, /ensureMinPlayChoiceOptions/);
  assert.match(src, /playerName:/);
});

test('Galgame_底栏取消设置右侧空挡', () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  const css = readFileSync(join(dir, '../src/page/Galgame.module.css'), 'utf8');
  assert.doesNotMatch(
    css,
    /\.buttonContainer\s*\{[^}]*padding-right:\s*6\.25rem/s,
  );
});
