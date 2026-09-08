/**
 * 行内保存：未改字段不得预留保存钮右边距。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tsx = readFileSync(join(root, 'src/components/GameSettingEditor/InlineFieldSave.tsx'), 'utf8');

test('InlineFieldSave_未显示保存钮时不应预留右侧内边距', () => {
  assert.match(tsx, /showSave \? styles\.fieldControl/);
  assert.doesNotMatch(
    tsx,
    /className: \[children\.props\.className, styles\.fieldControl, inputClassName\]/,
  );
});
