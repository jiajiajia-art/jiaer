/**
 * 建角人设向导：去掉顶部引导文案；底栏钉在框外滚动区；弹窗 85vw×85dvh
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
  assert.match(box, /height:\s*85dvh/);
  assert.match(box, /max-height:\s*85dvh/);
  const body = rule('.ui-dialog.ui-dialog-create > .ui-dialog-body');
  assert.match(body, /flex:\s*1 1 auto/);
});
