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

test('estimateIdeaAssetCounts_短创意落在后端区间并随内容变化', async () => {
  const {
    estimateIdeaAssetCounts,
    IDEA_SCENE_COUNT_MIN,
    IDEA_SCENE_COUNT_MAX,
    IDEA_NPC_COUNT_MIN,
    IDEA_NPC_COUNT_MAX,
  } = await loadEstimate();

  const short = estimateIdeaAssetCounts('保姆给我洗澡，让我有了生理反应');
  assert.ok(short.sceneCount >= IDEA_SCENE_COUNT_MIN && short.sceneCount <= IDEA_SCENE_COUNT_MAX);
  assert.ok(short.npcCount >= IDEA_NPC_COUNT_MIN && short.npcCount <= IDEA_NPC_COUNT_MAX);
  assert.equal(short.portraitCount, short.npcCount + 1);
  // 命中「保姆」+「浴室」暗示，场景不应再写死为固定 6
  assert.equal(short.npcCount, IDEA_NPC_COUNT_MIN);
  assert.ok(short.sceneCount >= IDEA_SCENE_COUNT_MIN);

  const rich = estimateIdeaAssetCounts(
    '我是私校转学生，在宿舍认识室友与学姐，周末去图书馆、咖啡店和海边约会，'
    + '班主任与宿管也卷入秘密社团，礼堂晚会当晚还要面对侦探与记者的盘问。',
  );
  assert.ok(rich.npcCount > short.npcCount || rich.sceneCount > short.sceneCount);
  assert.ok(rich.sceneCount <= IDEA_SCENE_COUNT_MAX);
  assert.ok(rich.portraitCount <= IDEA_NPC_COUNT_MAX + 1);
});

test('estimateFullWorkPoints_可按创意描述重算积分', async () => {
  const { estimateFullWorkPoints, estimateIdeaAssetCounts, DEFAULT_FULL_ASSET_FLAGS } = await loadEstimate();
  const idea = '保姆给我洗澡，让我有了生理反应';
  const counts = estimateIdeaAssetCounts(idea);
  assert.equal(
    estimateFullWorkPoints({ mode: 'full', assets: DEFAULT_FULL_ASSET_FLAGS, idea }),
    10 + counts.portraitCount * 6 + counts.sceneCount * 6,
  );
});

test('estimateFullWorkPoints_勾选封面增加12', async () => {
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
  assert.equal(withCover, 22);
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
  assert.equal(r.portraitsTotal, 3);
  assert.equal(r.scenesTotal, 2);
  assert.equal(r.hasGaps, true);
});

test('summarizeAssetCompleteness_齐全无缺口', async () => {
  const { summarizeAssetCompleteness } = await loadCompleteness();
  const r = summarizeAssetCompleteness({
    playerImages: { base: '/p.webp' },
    npcs: [{ images: { base: '/n.webp' } }],
    scenes: [{ image: '/s.webp' }],
    coverUrl: '/cover.webp',
    portraitCoverUrl: '/portrait.webp',
  });
  assert.equal(r.missingPortraits, 0);
  assert.equal(r.missingScenes, 0);
  assert.equal(r.missingCover, false);
  assert.equal(r.hasGaps, false);
});

test('summarizeAssetCompleteness_按真实角色场景数统计缺口', async () => {
  const { summarizeAssetCompleteness, assetCompletenessFromEditorData } = await loadCompleteness();
  const r = summarizeAssetCompleteness({
    player: { images: { base: '' } },
    npcs: [
      { images: {} },
      { image: '/a.webp' },
      { images: { base: '/b.webp' } },
    ],
    scenes: [
      { image: '' },
      { image: '/s1.webp' },
      { image: '/s2.webp' },
      { images: { base: '' } },
      { image: '/s3.webp' },
    ],
    coverUrl: null,
  });
  // 缺：主角 + npc0；npc1/npc2 已有图 → missingPortraits=2；场景缺 2 张
  assert.equal(r.missingPortraits, 2);
  assert.equal(r.portraitsTotal, 4);
  assert.equal(r.missingScenes, 2);
  assert.equal(r.scenesTotal, 5);

  const fromEditor = assetCompletenessFromEditorData({
    worldSetting: { player: { name: '我', gender: '女', appearance: '', images: {} } },
    npcSetting: { npcs: [{ id: '1', images: {} }, { id: '2', images: { base: '/n.webp' } }] },
    sceneSetting: {
      scenes: [
        { id: 'a', image: '' },
        { id: 'b', image: '/ok.webp' },
        { id: 'c', image: '' },
      ],
    },
    coverUrl: '',
  });
  assert.equal(fromEditor.missingPortraits, 2);
  assert.equal(fromEditor.portraitsTotal, 3);
  assert.equal(fromEditor.missingScenes, 2);
  assert.equal(fromEditor.scenesTotal, 3);
});

test('hasUsableCharacterPortrait_忽略默认占位图', async () => {
  const { hasUsableCharacterPortrait, isUsableImagePath } = await loadCompleteness();
  assert.equal(isUsableImagePath('data/assets/创作界面切图/defaultNpc.png'), false);
  assert.equal(hasUsableCharacterPortrait({ images: { base: '/real.webp' } }), true);
  assert.equal(hasUsableCharacterPortrait({ image: '/legacy.png' }), true);
  assert.equal(
    hasUsableCharacterPortrait({ images: { base: '/funloom/data/assets/创作界面切图/defaultNpc.png' } }),
    false,
  );
});

test('countEditorAssetImages_统计真实已有场景图', async () => {
  const { countEditorAssetImages } = await loadCompleteness();
  const c = countEditorAssetImages({
    playerImages: { base: '/p.webp' },
    npcs: [{ images: { base: '' } }, { images: { base: '/n.webp' } }],
    scenes: [{ image: '/a.webp' }, { image: '' }, { image: '' }],
    coverUrl: '',
  });
  assert.equal(c.portraitsPresent, 2);
  assert.equal(c.portraitsTotal, 3);
  assert.equal(c.scenesPresent, 1);
  assert.equal(c.scenesTotal, 3);
});

test('reconcileJobCountsWithEditorImages_job虚报时以编辑器为准', async () => {
  const { reconcileJobCountsWithEditorImages } = await loadCompleteness();
  const r = reconcileJobCountsWithEditorImages({
    jobSuccess: 6,
    jobFailed: 0,
    jobTotal: 6,
    editorPresent: 2,
    editorTotal: 6,
  });
  assert.equal(r.completed, 2);
  assert.equal(r.failed, 4);
  assert.equal(r.total, 6);
});
