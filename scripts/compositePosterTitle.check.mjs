/**
 * 封面叠字布局：竖图按宽定字号，两行不得把首行顶出画布。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolvePosterTitleMetrics } from '../src/lib/galgame/compositePosterTitle.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function firstLineTop(m) {
  return m.startY - m.fontSize / 2;
}

test('resolvePosterTitleMetrics_竖图3比4首行有顶距且字号按宽度', () => {
  const m = resolvePosterTitleMetrics(768, 1024, 'portrait');
  assert.equal(m.isPortrait, true);
  assert.equal(m.fontSize, Math.max(20, Math.round(768 * 0.078)));
  assert.ok(m.fontSize < Math.round(1024 * 0.075), '竖图不得再按高度放大字号');
  assert.ok(firstLineTop(m) >= Math.round(1024 * 0.085));
  assert.equal(firstLineTop(m), m.topPad);
  assert.ok(m.maxTextWidth >= 768 * 0.88);
});

test('resolvePosterTitleMetrics_两行不把首行往上挪', () => {
  const portrait = resolvePosterTitleMetrics(768, 1024, 'portrait');
  const landscape = resolvePosterTitleMetrics(1600, 900, 'landscape');
  assert.ok(firstLineTop(portrait) >= 16);
  assert.ok(firstLineTop(landscape) >= 16);
  const oldTwoLineStart = 1024 * 0.12 - portrait.lineGap / 2;
  const oldFirstTop = oldTwoLineStart - portrait.fontSize / 2;
  assert.ok(firstLineTop(portrait) > oldFirstTop, '新布局首行应低于旧公式避免贴顶裁切');
});

test('resolvePosterTitleMetrics_横图仍按高度定字号', () => {
  const m = resolvePosterTitleMetrics(1600, 900, 'landscape');
  assert.equal(m.isPortrait, false);
  assert.equal(m.fontSize, Math.max(26, Math.round(900 * 0.068)));
});

test('resolvePosterTitleMetrics_无orientation时按高宽比判断竖图', () => {
  assert.equal(resolvePosterTitleMetrics(768, 1024).isPortrait, true);
  assert.equal(resolvePosterTitleMetrics(1600, 900).isPortrait, false);
});

test('compositePosterTitle_海报换行且不依赖本机黄油体', () => {
  const src = readFileSync(join(root, 'src/lib/galgame/compositePosterTitle.ts'), 'utf8');
  assert.match(src, /wrapPosterTitleLines/);
  assert.doesNotMatch(src, /ensureCheesePosterFontLoaded|posterTitleFonts/);
});
