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
  // 功能注释：顶栏只留保存 / 放弃 / 预览；禁止再出现「保存后退出」按钮文案
  assert.doesNotMatch(editor, /["']保存并返回["']/);
  assert.doesNotMatch(editor, />\s*保存并返回\s*</);
  assert.match(editor, /放弃/);
  // 顶栏保存/预览须 shrink-0 固定在右侧，避免窄屏被标题挤没（手机端 gap 略紧）
  assert.match(editor, /flex shrink-0 items-center gap-1(?:\.5| sm:gap-1\.5)/);
  assert.match(editor, /顶栏只留「保存 \/ 放弃 \/ 预览」|顶栏固定「保存 \/ 预览」/);
  assert.match(editor, /保存当前全部修改/);
  assert.match(editor, /启动完整游戏测试/);
  // 桌面模组库仍锁 1200；生成世界传 fluid 随手机视口
  assert.match(editor, /min-w-\[1200px\]/);
  assert.match(editor, /max-w-\[1200px\]/);
  assert.match(editor, /fluid\s*\?/);
  assert.match(wizard, /fluid/);
  assert.match(wizard, /overflow-x-hidden/);
  // 底栏保存条已移除；页签下不再放设置项搜索框
  assert.doesNotMatch(editor, /sticky bottom-0/);
  assert.doesNotMatch(editor, /placeholder="搜索设置项/);
  assert.doesNotMatch(editor, /dirty \|\| !persisted \? "保存并返回" : "返回"/);

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
  // 功能注释：预览须把 selection 也指到草稿，否则封面/建角仍读库内旧世界
  assert.match(registry, /selection = \{ world: mod\.id/);
  assert.match(registry, /if \(authorPreviewMod\)/);
  assert.match(app, /AuthorPreviewChrome/);
  assert.match(app, /subscribeAuthorPreview|getAuthorPreviewSession/);
  // 功能注释：预览时向导壳 hidden；游玩区用局内纸色壳（非 romance-platform），建角 Modal 挂 data-author-preview-shell
  assert.match(app, /previewing \? "hidden" : "romance-platform min-h-screen"/);
  assert.match(app, /\.\.\.\(previewing \? \{\} : \{ ["']data-platform-ui["']: ["']1["'] \}\)/);
  assert.match(app, /author-preview-runtime/);
  assert.match(app, /data-author-preview-shell="1"/);
  assert.doesNotMatch(app, /previewing \?[\s\S]{0,200}className="romance-platform min-h-screen"[\s\S]{0,80}data-platform-ui="1"/);
  assert.match(app, /AuthorPreviewPlayShell/);
  const portal = readFileSync(join(romance, 'lib/romancePortalRoot.ts'), 'utf8');
  assert.match(portal, /data-author-preview-shell='1'/);
  const panel = readFileSync(join(romance, 'components/ModEditorPanel.tsx'), 'utf8');
  assert.match(panel, /requestAuthorPreview\(out/);
  assert.match(panel, /backToWizard/);
  assert.match(panel, /有未保存的修改/);
  const ctx = readFileSync(join(romance, 'store/GameContext.tsx'), 'utf8');
  assert.match(ctx, /clearAuthorPreviewSave\(AUTHOR_PREVIEW_GAME_ID\)/);
});

test('romanceAuthorPreview_assess_必填由共享硬门槛拦截_底层只处理启动错误', async () => {
  const mod = await import(join(romance, 'lib/authorPreview.ts'));
  const incomplete = {
    id: 'demo-world',
    name: '',
    version: '0.1.0',
    kind: 'world',
    content: { rooms: { start: { name: '家', desc: '家', exits: {} } }, startRoom: 'start' },
  };
  assert.ok(mod.assessAuthorRequiredFields(incomplete).some((issue) => issue.field === 'name'));
  assert.equal(mod.assessAuthorPreview(incomplete).fatal.length, 0);
  assert.deepEqual(mod.assessAuthorPreview(incomplete).warnings, []);

  // 悬空 startRoom 必须由共享门槛阻断，不能再由 clean/runtime 回落。
  const invalidRoom = {
    id: 'demo-world',
    name: '雾色',
    version: '0.1.0',
    kind: 'world',
    content: { rooms: { start: { name: '家', desc: '家', exits: {} } }, startRoom: 'nowhere' },
  };
  assert.ok(mod.assessAuthorRequiredFields(invalidRoom).some((issue) => issue.field === 'startRoom'));
});
