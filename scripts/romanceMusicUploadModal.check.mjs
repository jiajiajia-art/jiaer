/**
 * 图1：美化·音乐「＋ 上传音乐」弹窗三 tab；删独立「从平台曲库选」。
 * 开场剧情：自定义开场页样式去掉外层大框。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('ModBgmEditor_上传音乐弹窗含本地平台作品三tab', () => {
  const editor = read('Romance/src/components/ModBgmEditor.tsx');
  assert.match(editor, /＋ 上传音乐/);
  assert.match(editor, /onClick=\{\(\) => \{ setUploadTab\("local"\); setPickerOpen\(true\); \}\}/);
  assert.match(editor, /<Modal title="添加音乐"/);
  for (const label of ['本地上传', '平台音乐素材库', '作品音频库']) {
    assert.match(editor, new RegExp(label));
  }
  assert.match(editor, /TAB_IDS = \["local", "platform", "work"\]/);
  assert.match(editor, /addPlatform/);
  assert.match(editor, /addWorkRef/);
  assert.match(editor, /addLocal/);
  assert.doesNotMatch(editor, /aria-label="从平台曲库选"/);
  assert.doesNotMatch(editor, /从平台曲库选…/);
  assert.doesNotMatch(editor, /从本机音乐库选…/);
  assert.doesNotMatch(editor, /从作品音频库引用…/);
});

test('OpeningStyleStudio_开场剧情下不再套卡片大框', () => {
  const src = read('Romance/src/components/OpeningStyleStudio.tsx');
  assert.match(src, /自定义开场页样式/);
  assert.match(src, /className="space-y-3"/);
  assert.doesNotMatch(src, /space-y-3 rounded-2xl border border-line bg-paper\/50 p-3/);
  const panel = read('Romance/src/components/ModEditorPanel.tsx');
  const openingAt = panel.indexOf('title="开场剧情"');
  const nextAt = panel.indexOf('title="剧情美化"', openingAt);
  assert.ok(openingAt >= 0 && nextAt > openingAt);
  assert.match(panel.slice(openingAt, nextAt), /OpeningStyleStudio/);
});
