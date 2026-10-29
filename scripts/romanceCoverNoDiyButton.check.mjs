/**
 * 游戏封面页不得再放「装扮封面」入口；作者封面只在模组编辑器①基础编辑
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cover = readFileSync(join(root, 'Romance/src/components/Cover.tsx'), 'utf8');
const panel = readFileSync(join(root, 'Romance/src/components/ModEditorPanel.tsx'), 'utf8');

test('Cover_游戏内不得再出现装扮封面按钮', () => {
  assert.doesNotMatch(cover, /装扮封面/);
  assert.doesNotMatch(cover, /aria-label="装扮封面"/);
  assert.doesNotMatch(cover, /CoverDiyPanel/);
  assert.doesNotMatch(cover, /["']diy["']/);
});

test('ModEditorPanel_开局封面唯一入口在⑥美化', () => {
  assert.match(panel, /g="look"[\s\S]{0,80}title="开局封面"/);
  assert.doesNotMatch(panel, /g="base"[\s\S]{0,40}title="开局封面"/);
  assert.match(panel, /画布布局/);
  const mounts = [...panel.matchAll(/<ModCoverEditor\b/g)];
  assert.equal(mounts.length, 1, 'ModCoverEditor 只能挂一处 JSX');
});
