/**
 * 游戏封面页不得再放「装扮封面」入口；作品展示封面只在模组编辑器①基础·基本信息（名称上方）
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cover = readFileSync(join(root, 'Romance/src/components/Cover.tsx'), 'utf8');
const panel = readFileSync(join(root, 'Romance/src/components/ModEditorPanel.tsx'), 'utf8');
const opening = readFileSync(join(root, 'Romance/src/components/ModOpeningEditor.tsx'), 'utf8');
const diy = readFileSync(join(root, 'Romance/src/components/CoverDiyPanel.tsx'), 'utf8');

test('Cover_游戏内不得再出现装扮封面按钮', () => {
  assert.doesNotMatch(cover, /装扮封面/);
  assert.doesNotMatch(cover, /aria-label="装扮封面"/);
  assert.doesNotMatch(cover, /CoverDiyPanel/);
  assert.doesNotMatch(cover, /["']diy["']/);
});

test('Cover_开局菜单不套用作品content.cover', () => {
  assert.doesNotMatch(cover, /selectedSlot\("cover"\)/);
  assert.match(cover, /作品 content\.cover 只给列表/);
  assert.match(cover, /const cv: CoverCopy = \{\}/);
});

test('ModEditorPanel_作品封面在基本信息名称上方', () => {
  assert.doesNotMatch(panel, /title="开局封面"/);
  assert.doesNotMatch(panel, /g="look"[\s\S]{0,80}title="开局封面"/);
  const basic = panel.slice(panel.indexOf('title="基本信息"'), panel.indexOf('title="时间与推进"'));
  assert.match(basic, /作品封面/);
  assert.match(basic, /data-author-field="author-field-cover"/);
  assert.match(basic, /<ModCoverEditor\b/);
  assert.ok(
    basic.indexOf('data-author-field="author-field-cover"') < basic.indexOf('data-author-field="author-field-name"'),
    '封面须在名称字段之前',
  );
  const mounts = [...panel.matchAll(/<ModCoverEditor\b/g)];
  assert.equal(mounts.length, 1, 'ModCoverEditor 只能挂一处 JSX');
});

test('ModCoverEditor_只留背景_无自定义HTML与多余页签入口', () => {
  assert.match(opening, /bgOnly/);
  assert.match(opening, /mode="live"/);
  assert.match(opening, /作品展示封面/);
  assert.match(opening, /真正开局后不会再显示一次封面/);
  assert.match(opening, /不做出开始界面|不是开始界面/);
  assert.match(opening, /previewD=\{toDiy\(c\)\}/);
  assert.doesNotMatch(opening, /HtmlCover|整页自己写|沙箱全屏/);
  assert.doesNotMatch(opening, /自由搭配 · AI 对话/);
  assert.match(diy, /bgOnly/);
  assert.match(diy, /BG_ONLY_TABS/);
  assert.match(diy, /只留背景/);
  assert.match(diy, /BG_ONLY_TABS = \["背景"\]/);
  assert.match(diy, /if \(props\.bgOnly\) return <CoverDiyBody \{\.\.\.props\} mode="live" \/>/);
  assert.match(diy, /\{!bgOnly && \(/);
  assert.match(diy, /displayOnly=\{!!bgOnly\}/);
  assert.match(cover, /displayOnly/);
  // 功能注释：展示封面 displayOnly 时 showUI=false，整段标题+三按钮都不渲染
  assert.match(cover, /showUI = !displayOnly/);
  assert.match(cover, /cover-btns/);
  assert.match(cover, /只渲染背景图/);
  assert.doesNotMatch(cover, /!displayOnly && \([\s\S]{0,80}cover-btns/);
  for (const tab of ['文字', '按钮', '边框', '特效', 'CSS']) {
    assert.doesNotMatch(diy, new RegExp(`BG_ONLY_TABS = \\[[^\\]]*${tab}`));
  }
});
