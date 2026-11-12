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

test('TXT_IDEA_GENERATE_COST is 10 and doc parse has no fixed cost', () => {
  const src = readFileSync(join(root, 'src/utils/constants.ts'), 'utf8');
  assert.match(src, /export const TXT_IDEA_GENERATE_COST = 10/);
  // 文档导入改为按实际用量计费，不再有固定扣费常量
  assert.doesNotMatch(src, /TXT_DOC_PARSE_COST/);
  assert.match(src, /export const TXT_IDEA_TEXT_COST = 1/);
});

test('useFileUpload wires points precheck and success deduct toast', () => {
  const src = readFileSync(join(root, 'src/hooks/editor/useFileUpload.ts'), 'utf8');
  assert.match(src, /ensureEnoughPointsForVisualDoc/);
  // 文档解析按后端返回的 pointsDeducted 提示，没有固定兜底
  assert.match(src, /fallbackCost = kind === 'idea' \? TXT_IDEA_GENERATE_COST : 0/);
  assert.match(src, /applyVisualDocPointsSuccess/);
  assert.match(src, /pointsKind/);
  assert.match(src, /ideaGenerateSuccessDeducted/);
  assert.match(src, /docParseSuccessDeducted/);
  assert.match(src, /settle re-fetch|checkUploadStatus\(jobId\)/);
  assert.match(src, /runIdeaFullWorkAssets/);
  assert.match(src, /generateAssets/);
});

test('DocumentsPanel and GenerateFromIdeaModal show dual scope and 10-point text cost', () => {
  const panel = readFileSync(
    join(root, 'src/components/GameSettingEditor/DocumentUpload/DocumentsPanel.tsx'),
    'utf8',
  );
  const modal = readFileSync(
    join(root, 'src/components/GameSettingEditor/DocumentUpload/GenerateFromIdeaModal.tsx'),
    'utf8',
  );
  assert.match(panel, /TXT_IDEA_GENERATE_COST/);
  assert.doesNotMatch(panel, /TXT_DOC_PARSE_COST/);
  assert.match(panel, /generateTextOnlyWithCost/);
  assert.match(panel, /generateFullWorkCta/);
  assert.match(panel, /documentImportWithCost/);
  assert.match(modal, /startGenerateWithCost/);
  assert.match(modal, /startGenerateFullWorkWithCost/);
  assert.match(modal, /generateScope/);
  assert.match(modal, /scopeFullWorkTitle/);
  assert.match(modal, /TXT_IDEA_TEXT_COST/);
  assert.match(modal, /aiGenerateIdeaTextWithCost/);
  assert.match(modal, /generateIdeaText/);
  assert.match(modal, /labelWithAi/);
  assert.match(modal, /estimateFullWorkPoints/);
  assert.match(modal, /estimateIdeaAssetCounts/);
  assert.match(modal, /assetCounts\.portraitCount/);
  assert.match(modal, /assetCounts\.sceneCount/);
});
