/**
 * 立绘 Canvas：透明边裁切 + contain 底对齐 + 文档 NPC 头顶留白
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  computeContainBottomRect,
  PLAY_PORTRAIT_HEADROOM_RATIO,
  PLAY_TRIMMED_PORTRAIT_MAX_FILL,
  resolveOpaqueSourceCrop,
  resolvePortraitCanvasBufferSize,
} from '../src/lib/galgame/portraitCanvasDraw.ts';

test('computeContainBottomRect_高图以高度铺满并底对齐', () => {
  const r = computeContainBottomRect(300, 500, 100, 400);
  assert.equal(r.drawHeight, 500);
  assert.equal(r.dy, 0);
  assert.ok(Math.abs(r.drawWidth - 125) < 0.01);
});

test('computeContainBottomRect_宽图以宽度铺满并底对齐', () => {
  const r = computeContainBottomRect(300, 500, 600, 200);
  assert.equal(r.drawWidth, 300);
  assert.ok(Math.abs(r.drawHeight - 100) < 0.01);
  assert.ok(Math.abs(r.dy - 400) < 0.01);
});

test('computeContainBottomRect_maxFill限制占屏高避免顶满顶栏', () => {
  assert.equal(PLAY_TRIMMED_PORTRAIT_MAX_FILL, 0.76);
  const r = computeContainBottomRect(300, 500, 100, 400, PLAY_TRIMMED_PORTRAIT_MAX_FILL);
  assert.ok(Math.abs(r.drawHeight - 380) < 0.01);
  assert.ok(Math.abs(r.dy - 120) < 0.01);
});

test('重生成方形立绘_裁切加maxFill后与文档紧裁NPC同高', () => {
  const containerW = 300;
  const containerH = 493;
  // 对照 api-test2：黄黄 sessions 立绘 opaqueAspect≈0.435；文档竖图无 trim 时也会被 CharacterLayer 限高
  const playerOpaqueW = 323;
  const playerOpaqueH = 743;
  const headroom = Math.round(playerOpaqueH * PLAY_PORTRAIT_HEADROOM_RATIO);
  const player = computeContainBottomRect(
    containerW,
    containerH,
    playerOpaqueW,
    playerOpaqueH + headroom,
    PLAY_TRIMMED_PORTRAIT_MAX_FILL,
  );
  const npc = computeContainBottomRect(
    containerW,
    containerH,
    768,
    1376,
    PLAY_TRIMMED_PORTRAIT_MAX_FILL,
  );
  const playerFill = player.drawHeight / containerH;
  const npcFill = npc.drawHeight / containerH;
  assert.ok(playerFill <= PLAY_TRIMMED_PORTRAIT_MAX_FILL + 1e-6);
  assert.ok(playerFill >= 0.74, `playerFill=${playerFill}`);
  assert.ok(Math.abs(npcFill - PLAY_TRIMMED_PORTRAIT_MAX_FILL) < 0.01);
  assert.ok(
    Math.abs(playerFill - npcFill) <= 0.02,
    `playerFill=${playerFill} npcFill=${npcFill}`,
  );
});

test('resolveOpaqueSourceCrop_无bounds退回整图', () => {
  assert.deepEqual(resolveOpaqueSourceCrop(200, 400, null), {
    sx: 0, sy: 0, sw: 200, sh: 400,
  });
});

test('resolveOpaqueSourceCrop_按不透明外接矩形加padding', () => {
  const crop = resolveOpaqueSourceCrop(200, 400, { x: 40, y: 80, w: 80, h: 200 }, 2);
  assert.deepEqual(crop, { sx: 38, sy: 78, sw: 84, sh: 204 });
});

test('resolveOpaqueSourceCrop_padding不越界', () => {
  const crop = resolveOpaqueSourceCrop(100, 100, { x: 0, y: 0, w: 100, h: 100 }, 8);
  assert.deepEqual(crop, { sx: 0, sy: 0, sw: 100, sh: 100 });
});

test('resolveOpaqueSourceCrop_头顶留白对齐文档NPC构图', () => {
  assert.equal(PLAY_PORTRAIT_HEADROOM_RATIO, 0.05);
  // bounds y=100 h=200 → headroom=10，sy 从 100 提到 90（再减 pad）
  const crop = resolveOpaqueSourceCrop(
    400,
    800,
    { x: 50, y: 100, w: 120, h: 200 },
    { padding: 0, headroomRatio: 0.05 },
  );
  assert.deepEqual(crop, { sx: 50, sy: 90, sw: 120, sh: 210 });
  // 主体占裁窗高度 = 200/210 ≈ 0.952，接近陆沉舟 opaqueH 0.947
  assert.ok(Math.abs(200 / crop.sh - 0.952) < 0.01);
});

test('resolvePortraitCanvasBufferSize_须按DPR放大缓冲', () => {
  const r = resolvePortraitCanvasBufferSize(390, 700, 3);
  assert.equal(r.dpr, 3);
  assert.equal(r.bufferWidth, 1170);
  assert.equal(r.bufferHeight, 2100);
  const capped = resolvePortraitCanvasBufferSize(100, 100, 4);
  assert.equal(capped.dpr, 3);
  assert.equal(capped.bufferWidth, 300);
});

test('GameImageRenderer_须用DPR缓冲避免手机发糊', () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  const renderer = readFileSync(join(dir, '../src/components/Galgame/GameImageRenderer.tsx'), 'utf8');
  assert.match(renderer, /resolvePortraitCanvasBufferSize/);
  assert.match(renderer, /devicePixelRatio/);
  assert.match(renderer, /setTransform\(dpr/);
});

test('CharacterLayer_导入或重生成立绘须开启trimOpaquePadding', () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  const layer = readFileSync(join(dir, '../src/components/Galgame/CharacterLayer.tsx'), 'utf8');
  const renderer = readFileSync(join(dir, '../src/components/Galgame/GameImageRenderer.tsx'), 'utf8');
  assert.match(layer, /trimOpaquePadding/);
  assert.match(layer, /isImportedCardPortraitUrl/);
  assert.match(layer, /isSessionGeneratedPortraitUrl/);
  assert.match(layer, /maxFillRatio=\{PLAY_TRIMMED_PORTRAIT_MAX_FILL\}/);
  assert.match(renderer, /trimOpaquePadding/);
  assert.match(renderer, /maxFillRatio/);
  assert.match(renderer, /measureOpaqueBoundsFromBitmap/);
  assert.match(renderer, /resolveOpaqueSourceCrop/);
  assert.match(renderer, /PLAY_PORTRAIT_HEADROOM_RATIO/);
  assert.match(renderer, /PLAY_TRIMMED_PORTRAIT_MAX_FILL/);
  assert.match(renderer, /findOpaqueBounds/);
});
