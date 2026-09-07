/**
 * 小说作品工具单测：分区、默认开关、标签与路由
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_CREATE_AS_NOVEL,
  NOVEL_ENGINE,
  partitionCreatorGames,
  resolveCreateAsNovelFlag,
  isNovelEngine,
  buildNovelReadPath,
  buildSourceGameDetailPath,
  getNovelSourceFileId,
} from '../src/utils/novelGame.ts';
import { getGameTypeLabel, getGameTypeLabelFromMeta, getGameTypeTone } from '../src/utils/gameTypeLabel.ts';
import { GAME_TYPE_TONE_PALETTE, resolveGameTypeToneStyle } from '../src/utils/gameTypeToneClass.ts';

function createGame(overrides = {}) {
  return {
    id: '1',
    file_id: 'file-1',
    creator_user_id: 'u1',
    title: 'Test',
    subtitle: '',
    description: '',
    cover_url: '',
    doc_url: '',
    files: '',
    price_amount: null,
    special_price_amount: 0,
    rating_avg: null,
    rating_count: null,
    created_at: '',
    updated_at: '',
    author_name: 'Author',
    is_public: 0,
    like_count: 0,
    dislike_count: 0,
    reaction: '',
    avatarUrl: '',
    game_tags: 'TXT',
    is_preset: 0,
    needDeleted: false,
    display_cover_url: '',
    ...overrides,
  };
}

test('DEFAULT_CREATE_AS_NOVEL is true', () => {
  assert.equal(DEFAULT_CREATE_AS_NOVEL, true);
});

test('stripReplayMarkerFromTitle removes replay suffix', async () => {
  const { stripReplayMarkerFromTitle, resolveReplayModalTitle, buildExportVisualNovelDefaultTitle } = await import('../src/utils/novelGame.ts');
  assert.equal(stripReplayMarkerFromTitle('隋末风云 · 回放'), '隋末风云');
  assert.equal(resolveReplayModalTitle('隋末风云 · 回放', true, '回放'), '隋末风云');
  assert.equal(resolveReplayModalTitle('隋末风云', false, '回放'), '隋末风云 · 回放');
  assert.equal(buildExportVisualNovelDefaultTitle('跨洋之刃：华盛顿时代的远东征伐'), '跨洋之刃：华盛顿时代的远东征伐小说'.slice(0, 20));
  assert.equal(buildExportVisualNovelDefaultTitle('我的视觉小说'), '我的视觉小说');
  assert.equal(buildExportVisualNovelDefaultTitle('', '我的视觉小说'), '我的视觉小说');
});

test('resolveCreateAsNovelFlag only false when explicitly false', () => {
  assert.equal(resolveCreateAsNovelFlag(undefined), true);
  assert.equal(resolveCreateAsNovelFlag(true), true);
  assert.equal(resolveCreateAsNovelFlag(false), false);
});

test('isNovelEngine detects engine and game_tags', () => {
  assert.equal(isNovelEngine('NOVEL', 'NOVEL'), true);
  assert.equal(isNovelEngine('TXT', 'TXT'), false);
});

test('partitionCreatorGames splits novels from drafts and published', () => {
  const buckets = partitionCreatorGames([
    createGame({ file_id: 'pub-1', is_public: 1, engine: 'TXT' }),
    createGame({ file_id: 'draft-1', is_public: 0, engine: 'TXT' }),
    createGame({ file_id: 'novel-1', is_public: 0, engine: 'NOVEL', game_tags: 'NOVEL' }),
    createGame({ file_id: 'novel-pub', is_public: 1, engine: 'NOVEL', game_tags: 'NOVEL' }),
  ]);

  assert.equal(buckets.publishedGames.length, 2);
  assert.equal(buckets.draftGames.length, 2);
  assert.equal(buckets.novelGames.length, 1);
  assert.equal(buckets.draftGames.some((game) => game.file_id === 'novel-1'), true);
  assert.equal(buckets.novelGames[0].file_id, 'novel-pub');
});

test('buildNovelReadPath and buildSourceGameDetailPath encode file id', () => {
  assert.equal(buildNovelReadPath('abc'), '/novel/abc/read');
  assert.equal(buildSourceGameDetailPath('src-1'), '/game/src-1');
});

test('getNovelSourceFileId reads snake_case field', () => {
  assert.equal(getNovelSourceFileId({ source_file_id: 'origin-1' }), 'origin-1');
});

test('getGameTypeLabel maps NOVEL / 小说 to 视觉小说', () => {
  assert.equal(getGameTypeLabel('NOVEL', null), '视觉小说');
  assert.equal(getGameTypeLabel('小说', null), '视觉小说');
  assert.equal(getGameTypeLabelFromMeta({ game_tags: 'NOVEL', engine: 'NOVEL' }), '视觉小说');
  assert.equal(NOVEL_ENGINE, 'NOVEL');
});

test('getGameTypeLabel maps TXT / Role-Playing / 角色扮演 to AI文游', () => {
  assert.equal(getGameTypeLabel('TXT', null), 'AI文游');
  assert.equal(getGameTypeLabel('Role-Playing', null), 'AI文游');
  assert.equal(getGameTypeLabel('角色扮演', null), 'AI文游');
  assert.equal(getGameTypeLabel('文字互动', null), 'AI文游');
  assert.equal(getGameTypeLabelFromMeta({ game_tags: 'TXT', engine: 'TXT' }), 'AI文游');
});

test('getGameTypeLabel maps AVG / World / 世界互动 to 酒馆卡', () => {
  assert.equal(getGameTypeLabel('AVG', null), '酒馆卡');
  assert.equal(getGameTypeLabel('World', null), '酒馆卡');
  assert.equal(getGameTypeLabel('世界互动', null), '酒馆卡');
  assert.equal(getGameTypeLabelFromMeta({ game_tags: 'AVG', engine: 'AVG' }), '酒馆卡');
});

test('getGameTypeLabel maps CUSTOM / Custom / 自定义 to 自定义', () => {
  assert.equal(getGameTypeLabel('CUSTOM', null), '自定义');
  assert.equal(getGameTypeLabel('Custom', null), '自定义');
  assert.equal(getGameTypeLabel('自定义', null), '自定义');
  assert.equal(getGameTypeLabelFromMeta({ game_tags: 'CUSTOM', engine: 'CUSTOM' }), '自定义');
});

test('getGameTypeTone maps engines to distinct tone keys', () => {
  assert.equal(getGameTypeTone('TXT', null), 'aiWenyou');
  assert.equal(getGameTypeTone('AVG', null), 'tavern');
  assert.equal(getGameTypeTone('ST', null), 'tavern');
  assert.equal(getGameTypeTone('CUSTOM', null), 'custom');
  assert.equal(getGameTypeTone('NOVEL', null), 'visualNovel');
  assert.equal(getGameTypeTone('IVG', null), 'ivg');
});

test('resolveGameTypeToneStyle returns distinct background colors', () => {
  assert.equal(
    resolveGameTypeToneStyle('aiWenyou').backgroundColor,
    GAME_TYPE_TONE_PALETTE.aiWenyou.backgroundColor,
  );
  assert.equal(
    resolveGameTypeToneStyle('tavern').backgroundColor,
    GAME_TYPE_TONE_PALETTE.tavern.backgroundColor,
  );
  assert.notEqual(
    resolveGameTypeToneStyle('aiWenyou').backgroundColor,
    resolveGameTypeToneStyle('visualNovel').backgroundColor,
  );
  assert.equal(resolveGameTypeToneStyle('aiWenyou').color, '#fff');
});

test('countVisibleNovelTextSteps excludes scene_change only steps', async () => {
  const { countVisibleNovelTextSteps } = await import('../src/utils/novelGame.ts');
  assert.equal(countVisibleNovelTextSteps([
    { type: 'narration' },
    { type: 'scene_change' },
    { type: 'dialogue' },
  ]), 2);
  assert.equal(countVisibleNovelTextSteps([]), 0);
});

test('resolvePublishModalMode uses novel-edit for novel draft edit', async () => {
  const { resolvePublishModalMode, shouldOpenNovelEditModal } = await import('../src/utils/novelGame.ts');
  assert.equal(resolvePublishModalMode({ isNovel: true, intent: 'edit' }), 'novel-edit');
  assert.equal(resolvePublishModalMode({ isNovel: true, intent: 'publish' }), 'publish');
  assert.equal(resolvePublishModalMode({ isNovel: false, intent: 'edit' }), 'publish');
  assert.equal(shouldOpenNovelEditModal('NOVEL', 'NOVEL'), true);
  assert.equal(shouldOpenNovelEditModal('TXT', 'TXT'), false);
});

test('resolvePublishButtonAction_已发布也应打开弹窗', async () => {
  const { resolvePublishButtonAction } = await import('../src/utils/novelGame.ts');
  /* 功能注释：回归「已上架点发布作品无反应」——不得因 isPublished 返回不打开 */
  const published = resolvePublishButtonAction({ isNovel: false, isPublished: true });
  assert.equal(published.openModal, true);
  assert.equal(published.mode, 'publish');
  const draft = resolvePublishButtonAction({ isNovel: true, isPublished: false });
  assert.equal(draft.openModal, true);
  assert.equal(draft.mode, 'publish');
});

test('CreateGame_发布按钮不得在已发布时静默 return', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const tsx = fs.readFileSync(path.join(root, 'src/page/CreateGame.tsx'), 'utf8');
  assert.match(tsx, /resolvePublishButtonAction/);
  assert.doesNotMatch(
    tsx,
    /onPublish=\{\(\)\s*=>\s*\{\s*if\s*\(\s*!isPublished\s*\)/,
  );
  const stats = fs.readFileSync(path.join(root, 'src/components/CreateGame/GameStatsView.tsx'), 'utf8');
  assert.match(stats, /createGame\.publishSettings/);
});
