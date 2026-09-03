/**
 * 创作流程顶栏进度轨：按 activePanel 高亮当前步
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('CreationFlowRail_按面板映射六步并高亮当前', () => {
  const src = readFileSync(
    join(root, 'src/components/GameSettingEditor/CreationFlowRail.tsx'),
    'utf8',
  );
  assert.match(src, /flowStepUpload/);
  assert.match(src, /flowStepDatabase/);
  assert.match(src, /isWorldBookActive/);
  assert.match(src, /aria-current/);
});

test('GameSettingsEditor_使用CreationFlowRail替代纯文案step1Tip', () => {
  const src = readFileSync(join(root, 'src/page/GameSettingsEditor.tsx'), 'utf8');
  assert.match(src, /CreationFlowRail/);
  assert.doesNotMatch(src, /createGame\.step1Tip/);
});
