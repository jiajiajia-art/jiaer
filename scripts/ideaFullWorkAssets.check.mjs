/**
 * 一句话完整作品预计积分 + 素材完整性
 */
import test from 'node:test';
import assert from 'node:assert/strict';

async function loadEstimate() {
  return import('../src/lib/galgame/ideaFullWorkEstimate.ts');
}

async function loadCompleteness() {
  return import('../src/lib/galgame/assetCompleteness.ts');
}

test('estimateFullWorkPoints_仅文本为10', async () => {
  const { estimateFullWorkPoints } = await loadEstimate();
  assert.equal(
    estimateFullWorkPoints({
      mode: 'text',
      assets: { portraits: true, scenes: true, cover: true },
    }),
    10,
  );
});

test('estimateFullWorkPoints_完整默认勾选立绘场景', async () => {
  const {
    estimateFullWorkPoints,
    DEFAULT_FULL_ASSET_FLAGS,
    EST_PORTRAIT_COUNT,
    EST_SCENE_COUNT,
  } = await loadEstimate();
  // 10 + 4*6 + 6*6 = 10 + 24 + 36 = 70
  assert.equal(
    estimateFullWorkPoints({ mode: 'full', assets: DEFAULT_FULL_ASSET_FLAGS }),
    10 + EST_PORTRAIT_COUNT * 6 + EST_SCENE_COUNT * 6,
  );
});

test('estimateFullWorkPoints_勾选封面增加6', async () => {
  const { estimateFullWorkPoints } = await loadEstimate();
  const base = estimateFullWorkPoints({
    mode: 'full',
    assets: { portraits: false, scenes: false, cover: false },
  });
  const withCover = estimateFullWorkPoints({
    mode: 'full',
    assets: { portraits: false, scenes: false, cover: true },
  });
  assert.equal(base, 10);
  assert.equal(withCover, 16);
});

test('shouldGenerateAssetsAfterIdea_full且有勾选', async () => {
  const { shouldGenerateAssetsAfterIdea } = await loadEstimate();
  assert.equal(
    shouldGenerateAssetsAfterIdea({
      mode: 'full',
      assets: { portraits: true, scenes: false, cover: false },
    }),
    true,
  );
  assert.equal(
    shouldGenerateAssetsAfterIdea({
      mode: 'full',
      assets: { portraits: false, scenes: false, cover: false },
    }),
    false,
  );
  assert.equal(
    shouldGenerateAssetsAfterIdea({
      mode: 'text',
      assets: { portraits: true, scenes: true, cover: true },
    }),
    false,
  );
});

test('summarizeAssetCompleteness_空数据缺主角立绘与封面', async () => {
  const { summarizeAssetCompleteness } = await loadCompleteness();
  const r = summarizeAssetCompleteness({
    playerImages: { base: '' },
    npcs: [{ images: { base: '' } }, { images: { base: '/x.webp' } }],
    scenes: [{ image: '' }, { image: '/s.webp' }],
    coverUrl: '',
  });
  assert.equal(r.missingPortraits, 2);
  assert.equal(r.missingScenes, 1);
  assert.equal(r.missingCover, true);
  assert.equal(r.hasGaps, true);
});

test('summarizeAssetCompleteness_齐全无缺口', async () => {
  const { summarizeAssetCompleteness } = await loadCompleteness();
  const r = summarizeAssetCompleteness({
    playerImages: { base: '/p.webp' },
    npcs: [{ images: { base: '/n.webp' } }],
    scenes: [{ image: '/s.webp' }],
    coverUrl: '/cover.webp',
  });
  assert.equal(r.missingPortraits, 0);
  assert.equal(r.missingScenes, 0);
  assert.equal(r.missingCover, false);
  assert.equal(r.hasGaps, false);
});
