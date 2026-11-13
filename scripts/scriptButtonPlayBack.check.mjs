/**
 * 功能注释：游玩页返回按钮埋点 play_back 必须在 ScriptButtonType 联合类型内，避免 tsc 阻断发版。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('ScriptButtonType_包含play_back且Galgame返回按钮使用它', () => {
  const types = readFileSync(join(root, 'src/api/statistics/scriptButtonEvent.type.ts'), 'utf8');
  const galgame = readFileSync(join(root, 'src/page/Galgame.tsx'), 'utf8');
  assert.match(types, /\| 'play_back'/);
  assert.match(galgame, /logVisualButtonClick\('play_back'\)/);
  assert.doesNotMatch(types, /play_backplay_back/);
});
