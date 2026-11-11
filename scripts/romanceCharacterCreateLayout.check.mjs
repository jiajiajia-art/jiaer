/**
 * 建角人设向导：姓名风格条上移；双骰子；属性整组重掷；卡片间距收紧；弹窗 85vw×85dvh
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const create = readFileSync(join(root, 'Romance/src/components/CharacterCreate.tsx'), 'utf8');
const css = readFileSync(join(root, 'Romance/src/index.css'), 'utf8');
const ui = readFileSync(join(root, 'Romance/src/components/ui.tsx'), 'utf8');
const icons = readFileSync(join(root, 'Romance/src/lib/icons.tsx'), 'utf8');
const items = readFileSync(join(root, 'Romance/src/lib/creationItems.ts'), 'utf8');

function rule(selector) {
  const esc = selector.replace(/[.*+?^${}()|[\]\\>]/g, '\\$&');
  const m = css.match(new RegExp(`(?:^|\\n)\\s*${esc}\\s*\\{([^}]*)\\}`));
  assert.ok(m, `找不到 CSS 规则 ${selector}`);
  return m[1];
}

test('CharacterCreate_人设页不渲染formIntro与作品简介', () => {
  const who = create.slice(create.indexOf('const stepWho'), create.indexOf('const stepAttrs'));
  assert.doesNotMatch(who, /formIntro/);
  assert.doesNotMatch(who, /一页定型/);
  assert.doesNotMatch(who, /selWorld\.description|selWorld\?\.description/);
  assert.match(who, /基本信息/);
});

test('CharacterCreate_姓名风格条在Head.extra不在输入框下', () => {
  const who = create.slice(create.indexOf('const stepWho'), create.indexOf('const stepAttrs'));
  const bar = create.slice(create.indexOf('const nameStyleBar'), create.indexOf('const stepWho'));
  assert.match(bar, /不限/);
  assert.match(bar, /字库/);
  assert.match(bar, /名字风格/);
  assert.match(who, /extra=\{nameStyleBar\}/);
  // 功能注释：姓名 input 下不得再挂风格条
  assert.doesNotMatch(who, /input[\s\S]{0,200}名字风格/);
  assert.doesNotMatch(who, /input[\s\S]{0,200}不限/);
});

test('CharacterCreate_重掷用IconDiceDuo且属性标题可整组重掷', () => {
  assert.match(icons, /export function IconDiceDuo/);
  assert.match(create, /IconDiceDuo/);
  assert.match(create, /rerollAttrs/);
  assert.match(create, /titleAction/);
  assert.match(create, /整组重掷属性/);
  assert.match(create, /cattrStarts/);
  assert.match(items, /rollCreatorAttrStarts/);
  // 功能注释：建角人设页不再用单颗 Lucide Dice5
  assert.doesNotMatch(create, /IconDice[^D]/);
});

test('CharacterCreate_基本信息与属性间距收紧', () => {
  assert.match(create, /who: <div className="space-y-2"/);
  assert.doesNotMatch(create, /who: <div className="space-y-3"/);
});

test('CharacterCreate_底栏走Modal.footer禁止sticky盖住属性', () => {
  assert.match(create, /panelClassName="ui-dialog-create"/);
  assert.match(create, /footer=\{wizardFoot\}/);
  assert.match(create, /ui-sheet-foot/);
  assert.doesNotMatch(create, /sticky bottom-0/);
  assert.match(ui, /footer\?: ReactNode/);
  assert.match(ui, /panelClassName\?: string/);
});

test('uiDialogCreate_宽高均为屏幕85%', () => {
  const box = rule('.ui-dialog.ui-dialog-create');
  assert.match(box, /width:\s*85vw/);
  assert.match(box, /max-width:\s*85vw/);
  assert.match(box, /height:\s*85vh/);
  assert.match(box, /height:\s*85dvh/);
  assert.match(box, /max-height:\s*85dvh/);
  const body = rule('.ui-dialog.ui-dialog-create > .ui-dialog-body');
  assert.match(body, /flex:\s*1 1 auto/);
});
