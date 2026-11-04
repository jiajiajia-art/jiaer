/**
 * 统一弹窗：人物交谈 / 确认 / 申请等共用 .ui-dialog——居中、宽 86vw、
 * 高度随内容（不固定 70dvh 留白），过高时只在 .ui-dialog-body 内滚动；关闭钮在右上角。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(root, 'Romance/src', p), 'utf8');
const css = src('index.css');

/** 取 CSS 中某个选择器的声明块 */
function rule(selector) {
  const esc = selector.replace(/[.*+?^${}()|[\]\\>]/g, '\\$&');
  const m = css.match(new RegExp(`(?:^|\\n)\\s*${esc}\\s*\\{([^}]*)\\}`));
  assert.ok(m, `找不到 CSS 规则 ${selector}`);
  return m[1];
}

test('uiDialog_宽86vw高度随内容_禁止固定70dvh留白', () => {
  const box = rule('.ui-dialog');
  assert.match(box, /width:\s*86vw/);
  assert.match(box, /height:\s*auto/);
  assert.match(box, /max-height:\s*min\(90vh,\s*90dvh\)/);
  assert.doesNotMatch(box, /height:\s*70dvh/);
  assert.doesNotMatch(box, /height:\s*70vh/);
  assert.match(box, /overflow:\s*hidden/);
  assert.match(box, /flex-direction:\s*column/);
  assert.doesNotMatch(box, /width:\s*100%/);
});

test('uiDialogBody_不flex-grow撑空_过高才框内滚动', () => {
  const body = rule('.ui-dialog > .ui-dialog-body');
  assert.match(body, /overflow-y:\s*auto/);
  assert.match(body, /min-height:\s*0/);
  assert.match(body, /flex:\s*0 1 auto/);
  assert.doesNotMatch(body, /flex:\s*1 1 auto/);
  assert.doesNotMatch(body, /justify-content:\s*center/);
});

test('uiOverlay_居中且背后压暗', () => {
  const overlay = rule('.ui-overlay');
  assert.match(overlay, /position:\s*fixed/);
  assert.match(overlay, /align-items:\s*center/);
  assert.match(overlay, /justify-content:\s*center/);
  assert.match(overlay, /background:/);
});

test('Modal_统一用ui-dialog_不再有wide和xl尺寸档', () => {
  const ui = src('components/ui.tsx');
  const modal = ui.match(/export function Modal\([\s\S]*?\n\}\n/)?.[0];
  assert.ok(modal, '找不到 Modal');
  assert.match(modal, /ui-sheet modal-sheet ui-dialog/);
  assert.match(modal, /panelClassName/);
  assert.match(modal, /footer/);
  assert.match(modal, /ui-dialog-body/);
  assert.match(modal, /aria-label="关闭"/);
  assert.doesNotMatch(modal, /\bwide\b|\bxl\b/);
  assert.doesNotMatch(modal, /max-w-lg|max-w-2xl|max-h-\[92dvh\]/);
  assert.match(ui, /高度随内容/);
});

test('Modal调用方_不再传wide或xl', () => {
  const files = ['components/GameShell.tsx', 'components/HomeTab.tsx', 'components/NpcTab.tsx', 'components/SimTab.tsx', 'components/Works.tsx', 'components/ActionsTab.tsx', 'components/Cover.tsx', 'components/IndustryModals.tsx', 'components/ScheduleBoard.tsx', 'components/AvatarLibraryPicker.tsx'];
  for (const f of files) {
    for (const line of src(f).split('\n').filter((l) => /<Modal\b/.test(l))) {
      assert.doesNotMatch(line, /\s(wide|xl)(?=[\s>/])/, `${f} 仍传尺寸档：${line.trim()}`);
    }
  }
});

test('人物交谈_在统一框内_名字快捷句输入都在框里_不铺满屏', () => {
  const talk = src('components/TalkPanel.tsx');
  assert.match(talk, /className="ui-sheet ui-dialog animate-pop"/);
  assert.doesNotMatch(talk, /h-\[100dvh\]|h-\[90dvh\]|max-w-3xl/);
  const box = talk.slice(talk.indexOf('ui-dialog animate-pop'));
  // 名片栏（含名字）→ 消息区（含快捷句）→ 底部输入，依次位于同一个框内
  const iName = box.indexOf('{name}</h3>');
  const iBody = box.indexOf('ui-dialog-body');
  const iQuick = box.indexOf('打个招呼');
  const iInput = box.indexOf('<input');
  assert.ok(iName > 0 && iBody > iName && iQuick > iBody && iInput > iQuick, '交谈面板结构顺序不对');
  assert.match(box, /aria-label="结束对话" className="ui-icon-btn/);
});

test('其余弹窗_全部改用统一框_关闭钮在右上', () => {
  const cases = {
    'components/BranchSheet.tsx': /收起/,
    'components/Backpack.tsx': /aria-label="关闭"/,
    'components/ContractDoc.tsx': /aria-label="关闭"/,
    'components/Ending.tsx': /aria-label="关闭"/,
    'components/GameShell.tsx': /aria-label="关闭"/,
    'components/LocalAvatarCropFlow.tsx': /aria-label="关闭"/,
    'components/AddPlayModModal.tsx': />关闭</,
  };
  for (const [f, closeRe] of Object.entries(cases)) {
    const code = src(f);
    assert.match(code, /\bui-dialog\b/, `${f} 未使用 ui-dialog`);
    assert.match(code, /ui-dialog-body/, `${f} 缺少框内滚动区`);
    assert.match(code, closeRe, `${f} 缺少关闭入口`);
    assert.doesNotMatch(code, /max-w-sm p-5|max-h-\[min\(88vh|h-\[90dvh\]|max-w-\[360px\]/, `${f} 仍有自定尺寸`);
  }
  const backpack = src('components/Backpack.tsx');
  assert.equal(backpack.match(/ui-sheet ui-dialog/g)?.length, 2, '背包物品与赠送两个弹窗都应使用统一框');
  assert.equal(src('components/Ending.tsx').match(/end-panel ui-dialog/g)?.length, 2);
});

test('合约文书_不再是铺满屏幕的层', () => {
  const doc = src('components/ContractDoc.tsx');
  assert.doesNotMatch(doc, /fixed inset-0 z-\[80\] flex flex-col/);
  assert.doesNotMatch(doc, /‹ 收起/);
  assert.match(doc, /ui-overlay ui-overlay-heavy/);
});

test('菜单功能面板_居中统一框_不再贴边铺满', () => {
  const shell = src('components/GameShell.tsx');
  const panel = shell.match(/\{panelOpen && createPortal\([\s\S]*?romancePortalRoot\(\)!\)\}/)?.[0];
  assert.ok(panel, '找不到功能面板');
  assert.match(panel, /ui-overlay/);
  assert.match(panel, /ui-sheet ui-dialog/);
  assert.doesNotMatch(panel, /items-stretch justify-end|max-w-2xl/);
});

test('角色创建_滚动复位作用在框内滚动区', () => {
  const cc = src('components/CharacterCreate.tsx');
  assert.match(cc, /closest\("\.ui-dialog-body"\)\?\.scrollTo/);
  assert.doesNotMatch(cc, /closest\("\.modal-sheet"\)/);
});

test('草稿冲突弹窗走统一Modal_高度随内容', () => {
  const panel = src('components/ModEditorPanel.tsx');
  assert.match(panel, /<Modal title="发现本机未保存的草稿"/);
  assert.match(src('index.css'), /height:\s*auto/);
  assert.doesNotMatch(src('index.css'), /height:\s*70dvh/);
});
