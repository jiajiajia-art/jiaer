/**
 * 世界观提示词：术语等四项仍下架；三框已并入①基础「剧本基调」，剧情页不再展示。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');

test('ModPromptEditor_不再作为三字段编辑入口', () => {
  const ed = readFileSync(join(romance, 'components/ModPromptEditor.tsx'), 'utf8');
  assert.doesNotMatch(ed, /GM 开场白/);
  assert.doesNotMatch(ed, /世界观设定/);
  assert.doesNotMatch(ed, /叙事口吻/);
  assert.doesNotMatch(ed, /术语说明/);
  assert.doesNotMatch(ed, /补充规则/);
  assert.doesNotMatch(ed, /开局导演指令/);
  assert.doesNotMatch(ed, /结局举例/);
  assert.doesNotMatch(ed, /k: "terminology"/);
  assert.doesNotMatch(ed, /k: "extraRules"/);
  assert.doesNotMatch(ed, /k: "openingDirective"/);
  assert.doesNotMatch(ed, /k: "endingHint"/);
});

test('ModEditorPanel_剧本基调在基础_剧情无世界观提示词三块', () => {
  const panel = readFileSync(join(romance, 'components/ModEditorPanel.tsx'), 'utf8');
  assert.match(panel, /剧本基调/);
  assert.doesNotMatch(panel, /title="世界观提示词"/);
  assert.doesNotMatch(panel, /label: "术语说明"/);
  assert.doesNotMatch(panel, /label: "开局导演指令"/);
  assert.doesNotMatch(panel, /label: "补充规则"/);
  assert.doesNotMatch(panel, /label: "结局举例"/);
  assert.doesNotMatch(panel, /开局导演指令在上方/);
});
