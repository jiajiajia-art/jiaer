/**
 * 前端：TXT 文游文档导入 / 一句话生成积分常量契约
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

test('TXT_IDEA_GENERATE_COST and TXT_DOC_PARSE_COST are 10 in constants', () => {
  const src = readFileSync(join(root, 'src/utils/constants.ts'), 'utf8');
  assert.match(src, /export const TXT_IDEA_GENERATE_COST = 10/);
  assert.match(src, /export const TXT_DOC_PARSE_COST = 10/);
  assert.match(src, /export const TXT_IDEA_TEXT_COST = 1/);
});

test('useFileUpload wires points precheck and success deduct toast', () => {
  const src = readFileSync(join(root, 'src/hooks/editor/useFileUpload.ts'), 'utf8');
  assert.match(src, /ensureEnoughPointsForVisualDoc/);
  assert.match(src, /TXT_DOC_PARSE_COST/);
  assert.match(src, /TXT_IDEA_GENERATE_COST/);
  assert.match(src, /applyVisualDocPointsSuccess/);
  assert.match(src, /pointsKind/);
  assert.match(src, /ideaGenerateSuccessDeducted/);
  assert.match(src, /docParseSuccessDeducted/);
  assert.match(src, /settle re-fetch|checkUploadStatus\(jobId\)/);
});

test('DocumentsPanel and GenerateFromIdeaModal show 10-point cost', () => {
  const panel = readFileSync(
    join(root, 'src/components/GameSettingEditor/DocumentUpload/DocumentsPanel.tsx'),
    'utf8',
  );
  const modal = readFileSync(
    join(root, 'src/components/GameSettingEditor/DocumentUpload/GenerateFromIdeaModal.tsx'),
    'utf8',
  );
  assert.match(panel, /TXT_IDEA_GENERATE_COST/);
  assert.match(panel, /TXT_DOC_PARSE_COST/);
  assert.match(panel, /generateNowWithCost/);
  assert.match(panel, /documentImportWithCost/);
  assert.match(modal, /startGenerateWithCost/);
  assert.match(modal, /ideaGenerateCostHint/);
  assert.match(modal, /TXT_IDEA_TEXT_COST/);
  assert.match(modal, /aiGenerateIdeaTextWithCost/);
  assert.match(modal, /generateIdeaText/);
  assert.match(modal, /labelWithAi/);
});
