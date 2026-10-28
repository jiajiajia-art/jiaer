/**
 * 世界观提示词编辑器：下架术语说明 / 补充规则 / 开局导演指令 / 结局举例
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');

test('ModPromptEditor_不得再展示四项已下架提示词字段', () => {
  const ed = readFileSync(join(romance, 'components/ModPromptEditor.tsx'), 'utf8');
  assert.match(ed, /GM 开场白/);
  assert.match(ed, /世界观设定/);
  assert.match(ed, /叙事口吻/);
  assert.doesNotMatch(ed, /术语说明/);
  assert.doesNotMatch(ed, /补充规则/);
  assert.doesNotMatch(ed, /开局导演指令/);
  assert.doesNotMatch(ed, /结局举例/);
  assert.doesNotMatch(ed, /k: "terminology"/);
  assert.doesNotMatch(ed, /k: "extraRules"/);
  assert.doesNotMatch(ed, /k: "openingDirective"/);
  assert.doesNotMatch(ed, /k: "endingHint"/);
});

test('ModEditorPanel_PROMPTS与帮助文案对齐下架', () => {
  const panel = readFileSync(join(romance, 'components/ModEditorPanel.tsx'), 'utf8');
  assert.doesNotMatch(panel, /label: "术语说明"/);
  assert.doesNotMatch(panel, /label: "开局导演指令"/);
  assert.doesNotMatch(panel, /label: "补充规则"/);
  assert.doesNotMatch(panel, /label: "结局举例"/);
  assert.doesNotMatch(panel, /开局导演指令在上方/);
});
