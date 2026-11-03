/**
 * Romance ErrorBoundary：动态 import / 旧 chunk 失败须整页重载，不能只 setState(null)。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const romance = join(dirname(fileURLToPath(import.meta.url)), '../Romance/src');

test('Romance_ErrorBoundary_动态模块失败须location重载', () => {
  const app = readFileSync(join(romance, 'App.tsx'), 'utf8');
  assert.match(app, /isStaleChunkLoadError|Failed to fetch dynamically imported module|isStaleChunkLoadErrorMessage/);
  assert.match(app, /location\.replace|location\.reload|reloadOnceForStaleChunk/);
  assert.match(app, /_r|reloadOnceForStaleChunk/);
  // 功能注释：componentDidCatch 须自动硬刷，禁止只停在红屏等用户点「重试」
  assert.match(app, /componentDidCatch[\s\S]*reloadOnceForStaleChunk|isStaleChunkLoadError/);
  assert.doesNotMatch(
    app,
    /onClick=\{\(\) => this\.setState\(\{ error: null \}\)\}/,
  );
});

test('WorldGenWizard_继续填写草稿须先安全加载ModEditorPanel', () => {
  const wiz = readFileSync(join(romance, 'components/WorldGenWizard.tsx'), 'utf8');
  assert.match(wiz, /importWithStaleChunkReload/);
  assert.match(wiz, /lazy\(\(\) => importWithStaleChunkReload\(\(\) => import\("\.\/ModEditorPanel"\)\)\)/);
  assert.match(wiz, /acceptEntranceDraft[\s\S]*importWithStaleChunkReload\(\(\) => import\("\.\/ModEditorPanel"\)\)/);
});

test('Romance_ErrorBoundary_trim脏会话须清世界生成会话并硬刷新', () => {
  const app = readFileSync(join(romance, 'App.tsx'), 'utf8');
  assert.match(app, /isDirtyWorldGenTrimError/);
  assert.match(app, /trim is not a function/);
  assert.match(app, /demoteWorldGenSessionToStep1|clearWorldGenSession/);
  assert.match(app, /hardReloadWithCacheBust|recoverDirtyWorldGenTrim/);
  // 功能注释：须 componentDidCatch 自动退回 step1，禁止只靠用户点重试/F5（F5 会带着脏会话再崩）
  assert.match(app, /componentDidCatch/);
  assert.match(app, /isWorldGenTrimRecovering|demoteWorldGenSessionToStep1/);
});

test('WorldGenWizard_编辑器须有EditorTrimBoundary就地退回step1', () => {
  const wiz = readFileSync(join(romance, 'components/WorldGenWizard.tsx'), 'utf8');
  assert.match(wiz, /EditorTrimBoundary/);
  assert.match(wiz, /demoteFromEditorTrim|demoteWorldGenSessionToStep1/);
  assert.match(wiz, /isWorldGenPersistBlocked/);
});
