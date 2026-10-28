/**
 * 模组编辑器：去掉顶部指引；顶栏保存/预览；底栏无重复保存；作者预览隔离测试存档。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');

test('romanceAuthorPreview_编辑器顶栏保存预览_底栏无重复保存', () => {
  const editor = readFileSync(join(romance, 'components/ModEditorPanel.tsx'), 'utf8');
  const wizard = readFileSync(join(romance, 'components/WorldGenWizard.tsx'), 'utf8');
  const app = readFileSync(join(romance, 'App.tsx'), 'utf8');
  const preview = readFileSync(join(romance, 'lib/authorPreview.ts'), 'utf8');
  const chrome = readFileSync(join(romance, 'components/AuthorPreviewChrome.tsx'), 'utf8');
  const storage = readFileSync(join(romance, 'lib/storage.ts'), 'utf8');
  const registry = readFileSync(join(romance, 'mods/registry.ts'), 'utf8');

  assert.doesNotMatch(wizard, /创作游戏 · 第 2\/2 步 · 完整编辑器/);
  assert.match(editor, />\s*保存\s*</);
  assert.match(editor, />\s*预览\s*</);
  assert.match(editor, /requestAuthorPreview/);
  assert.match(editor, /保存并返回/);
  assert.match(editor, /放弃修改/);
  // 顶栏保存/预览须 shrink-0 固定在右侧，避免窄屏被标题挤没（手机端 gap 略紧）
  assert.match(editor, /flex shrink-0 items-center gap-1(?:\.5| sm:gap-1\.5)/);
  assert.match(editor, /顶栏固定「保存 \/ 预览」/);
  assert.match(editor, /保存当前全部修改/);
  assert.match(editor, /启动完整游戏测试/);
  // 桌面模组库仍锁 1200；生成世界传 fluid 随手机视口
  assert.match(editor, /min-w-\[1200px\]/);
  assert.match(editor, /max-w-\[1200px\]/);
  assert.match(editor, /fluid\s*\?/);
  assert.match(wizard, /fluid/);
  assert.match(wizard, /overflow-x-hidden/);
  // 底栏不应再有独立「保存」主按钮（只留保存并返回 / 放弃）
  const footer = editor.slice(editor.lastIndexOf('sticky bottom-0'));
  assert.doesNotMatch(footer, /rounded-full bg-jade[^>]*>\s*保存\s*</);
  assert.match(footer, /保存并返回/);
  assert.doesNotMatch(footer, />\s*预览\s*</);

  assert.match(preview, /AUTHOR_PREVIEW_GAME_ID/);
  assert.match(preview, /assessAuthorPreview/);
  assert.match(preview, /测试配置不完整|warnings/);
  assert.match(chrome, /作者测试中/);
  assert.match(chrome, /返回编辑器/);
  assert.match(chrome, /清空测试存档/);
  // Studio Tally：贴顶全宽 REC 条，禁止旧版圆角浮卡
  assert.match(chrome, /apc-root/);
  assert.match(chrome, /fixed inset-x-0 top-0/);
  assert.match(chrome, /apc-rec-blink/);
  assert.doesNotMatch(chrome, /rounded-2xl border border-coral/);
  assert.match(app, /--apc-h/);
  assert.match(storage, /AUTHOR_PREVIEW_AUTO_SLOT/);
  assert.match(storage, /isAuthorPreview/);
  assert.match(registry, /beginAuthorPreviewMod/);
  assert.match(registry, /endAuthorPreviewMod/);
  assert.match(app, /AuthorPreviewChrome/);
  assert.match(app, /subscribeAuthorPreview|getAuthorPreviewSession/);
});

test('romanceAuthorPreview_assess_缺名可进_致命阻断', async () => {
  const mod = await import(join(romance, 'lib/authorPreview.ts'));
  const soft = mod.assessAuthorPreview({
    id: 'demo-world',
    name: '',
    version: '0.1.0',
    kind: 'world',
    content: { rooms: { start: { name: '家', desc: '家', exits: {} } }, startRoom: 'start' },
  });
  assert.equal(soft.fatal.length, 0);
  assert.ok(soft.warnings.some((w) => /名称/.test(w)));

  const hard = mod.assessAuthorPreview({
    id: 'demo-world',
    name: '雾色',
    version: '0.1.0',
    kind: 'world',
    content: { rooms: { start: { name: '家', desc: '家', exits: {} } }, startRoom: 'nowhere' },
  });
  assert.ok(hard.fatal.some((e) => /startRoom/.test(e)));
});
