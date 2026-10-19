/**
 * 功能注释：开局「开始游戏」固定 actionId / 禁止双发 stream 的门闩。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildBootstrapStartActionId,
  isBootstrapStartActionId,
  isOpeningStartActionText,
  shouldSkipOpeningStartAutoResend,
} from '../src/lib/galgame/bootstrapStartAction.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('buildBootstrapStartActionId_应固定后缀', () => {
  assert.equal(buildBootstrapStartActionId('abc'), 'visual-abc-bootstrap-start');
  assert.equal(isBootstrapStartActionId('visual-abc-bootstrap-start'), true);
  assert.equal(isBootstrapStartActionId('visual-abc-xyz'), false);
});

test('shouldSkipOpeningStartAutoResend_新开局或开局中应跳过', () => {
  assert.equal(
    shouldSkipOpeningStartAutoResend({ content: '开始游戏', bootNewStart: true }),
    true,
  );
  assert.equal(
    shouldSkipOpeningStartAutoResend({ content: '开始游戏', isStartingGame: true }),
    true,
  );
  assert.equal(
    shouldSkipOpeningStartAutoResend({ content: '开始游戏', shouldAutoStartGame: true }),
    true,
  );
  assert.equal(shouldSkipOpeningStartAutoResend({ content: '开始游戏' }), false);
  assert.equal(
    shouldSkipOpeningStartAutoResend({ content: '继续探索', bootNewStart: true }),
    false,
  );
});

test('isOpeningStartActionText_仅精确匹配', () => {
  assert.equal(isOpeningStartActionText('开始游戏'), true);
  assert.equal(isOpeningStartActionText(' 开始游戏 '), true);
  assert.equal(isOpeningStartActionText('开始'), false);
});

test('useGalgameController_开局重发应接线bootstrap门闩', () => {
  const ctrl = readFileSync(join(root, 'src/hooks/galgame/useGalgameController.ts'), 'utf8');
  assert.match(ctrl, /shouldSkipOpeningStartAutoResend/);
  assert.match(ctrl, /buildBootstrapStartActionId/);
});
