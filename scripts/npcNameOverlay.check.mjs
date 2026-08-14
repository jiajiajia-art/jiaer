/**
 * 局内改名展示层：禁止短别名把已是目标名的正文扩成叠字（白白→白白白白）。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const overlayPath = join(root, 'src/lib/galgame/npcNameOverlay.ts');

test('rewriteTextByMap_短别名不叠已有目标名', async () => {
  const { rewriteTextByMap, buildPlayerNameReplacementMap } = await import(
    '../src/lib/galgame/npcNameOverlay.ts'
  );
  const map = buildPlayerNameReplacementMap({
    currentName: '白白',
    aliases: ['白', '玩家'],
  });
  assert.equal(
    rewriteTextByMap('白白白白走到沙发旁坐下', map),
    '白白走到沙发旁坐下',
  );
  assert.equal(
    rewriteTextByMap('白白走到沙发旁坐下', map),
    '白白走到沙发旁坐下',
  );
  assert.equal(
    rewriteTextByMap('白走到沙发旁坐下', map),
    '白白走到沙发旁坐下',
  );
  assert.equal(
    rewriteTextByMap('玩家主动走到张导面前', map),
    '白白主动走到张导面前',
  );
});

test('rewriteTextByMap_实现须先保护to再替换from', () => {
  const src = readFileSync(overlayPath, 'utf8');
  assert.match(src, /先保护已是目标名/);
  assert.match(src, /split\(to\)\.join\(guard\)/);
  assert.doesNotMatch(src, /out\.replace\(new RegExp\(escapeRegExp\(from\), 'g'\), to\);\n {2}return out;/);
});

test('Galgame_文本模式仍渲染场景背景', () => {
  const galgame = readFileSync(join(root, 'src/page/Galgame.tsx'), 'utf8');
  assert.match(galgame, /GameBackgroundRenderer/);
  assert.match(galgame, /textModeBgScrim/);
  assert.doesNotMatch(
    galgame,
    /!controller\.isTextMode && \(\s*<GameBackgroundRenderer/,
  );
});

test('GameBackgroundRenderer_加载中不隐藏容器', () => {
  const src = readFileSync(
    join(root, 'src/components/Galgame/GameBackgroundRenderer.tsx'),
    'utf8',
  );
  assert.doesNotMatch(src, /opacity:\s*isTransitioning\s*\?\s*0/);
  assert.match(src, /加载中保留上一帧/);
});
