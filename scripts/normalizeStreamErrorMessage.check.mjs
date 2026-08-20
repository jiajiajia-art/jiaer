import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeUserFacingStreamError } from '../src/lib/galgame/normalizeStreamErrorMessage.ts';

test('normalizeUserFacingStreamError_脏输出应转为中文提示', () => {
  assert.equal(
    normalizeUserFacingStreamError('Generated output contained invalid display residue. Please retry.'),
    '生成内容含无法展示的残留标记，请重试。',
  );
  assert.equal(
    normalizeUserFacingStreamError('生成内容含无法展示的残留标记，请重试。'),
    '生成内容含无法展示的残留标记，请重试。',
  );
});

test('normalizeUserFacingStreamError_生成中锁冲突应友好提示', () => {
  assert.equal(
    normalizeUserFacingStreamError('Action is already processing'),
    '内容正在生成中，请稍候。',
  );
});
