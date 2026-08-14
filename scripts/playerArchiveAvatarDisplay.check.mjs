/**
 * 我的档案：头像展示与手动 AI 生成不跟换角 A/B；A/B 只管换角清头像
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(
  join(root, 'src/components/Galgame/panels/PlayerArchiveSection.tsx'),
  'utf8',
);
const beHandler = readFileSync(
  join(root, '../Interactive-fiction-backend/interface/handlers/visual/sessionPlayerProfiles.js'),
  'utf8',
);

test('PlayerArchive_总览始终有生成头像按钮', () => {
  assert.match(src, /头像与「生成头像」始终可见/);
  assert.match(src, /className=\{styles\.avatarGenBtn\}/);
  assert.doesNotMatch(
    src,
    /\{playerAvatarAbOnChange \? \(\s*<button[\s\S]*?avatarGenBtn/,
    '生成按钮不得再包在 A/B 条件里',
  );
  assert.doesNotMatch(src, /if \(!playerAvatarAbOnChange\) return;/);
});

test('PlayerArchive_编辑页始终有AI生成', () => {
  assert.match(src, /手动 AI 生成始终可用/);
  assert.match(src, /className=\{styles\.fieldAiBtn\}/);
});

test('player-avatar_手动生图不再AB_DISABLED', () => {
  const fnStart = beHandler.indexOf('export async function postSessionPlayerAvatarHandler');
  assert.ok(fnStart >= 0);
  const slice = beHandler.slice(fnStart, fnStart + 1200);
  assert.doesNotMatch(slice, /AB_DISABLED/);
  assert.match(slice, /手动生图始终开放/);
});
