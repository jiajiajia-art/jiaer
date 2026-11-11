/**
 * 作品封面：基本信息内挂载；边框页「装饰边框」说明不得再展示给创作者（玩家 DIY 边框页仍保留组件）。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

test('ModEditorPanel_作品封面在基本信息不展示玩家叠封面说明', () => {
  const panel = read('Romance/src/components/ModEditorPanel.tsx');
  const basicAt = panel.indexOf('title="基本信息"');
  assert.ok(basicAt >= 0, '须有基本信息 Section');
  const nextSection = panel.indexOf('<Section', basicAt + 1);
  const block = panel.slice(basicAt, nextSection > basicAt ? nextSection : basicAt + 2500);
  assert.match(block, /<ModCoverEditor\b/);
  assert.match(block, /作品封面/);
  assert.doesNotMatch(block, /玩家侧若要叠自己的封面/);
  assert.doesNotMatch(block, /美化\s*→\s*封面/);
  assert.doesNotMatch(block, /装扮封面/);
  assert.doesNotMatch(panel, /玩家侧若要叠自己的封面，在游戏「美化/);
  assert.doesNotMatch(panel, /title="开局封面"/);
});

test('CoverDiyPanel_边框页不展示装饰边框说明', () => {
  const diy = read('Romance/src/components/CoverDiyPanel.tsx');
  assert.match(diy, /边框:\s*<>[\s\S]*?<FrameEditor\b/);
  assert.doesNotMatch(diy, /给封面加一圈装饰边框/);
  assert.doesNotMatch(diy, /不影响按钮点击/);
});
