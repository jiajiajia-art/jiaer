import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DRAFT_BOX_FILTER_ORDER,
  filterDraftGamesByType,
  resolveDraftBoxFilterKey,
} from '../src/utils/draftBoxFilter.ts';
import { partitionCreatorGames } from '../src/utils/novelGame.ts';

function createGame(overrides = {}) {
  return {
    id: '1',
    file_id: 'file-1',
    is_public: 0,
    engine: 'TXT',
    game_tags: 'TXT',
    ...overrides,
  };
}

test('resolveDraftBoxFilterKey maps engines to draft filters', () => {
  assert.equal(resolveDraftBoxFilterKey({ engine: 'TXT', game_tags: 'TXT' }), 'role-playing');
  assert.equal(resolveDraftBoxFilterKey({ engine: 'RPG', game_tags: 'RPG' }), 'role-playing');
  assert.equal(resolveDraftBoxFilterKey({ engine: 'AVG', game_tags: 'AVG' }), 'world');
  assert.equal(resolveDraftBoxFilterKey({ engine: 'CUSTOM', game_tags: 'CUSTOM' }), 'custom');
  assert.equal(resolveDraftBoxFilterKey({ engine: 'IVG', game_tags: 'IVG' }), 'ivg');
  // ST 并入酒馆卡，草稿箱不再单独展示 ST 分类
  assert.equal(resolveDraftBoxFilterKey({ engine: 'ST', game_tags: 'ST' }), 'world');
  assert.equal(resolveDraftBoxFilterKey({ engine: 'NOVEL', game_tags: 'NOVEL' }), 'novel');
});

test('filterDraftGamesByType returns all or matching drafts', () => {
  const games = [
    createGame({ file_id: 'txt-1', engine: 'TXT' }),
    createGame({ file_id: 'avg-1', engine: 'AVG' }),
    createGame({ file_id: 'novel-1', engine: 'NOVEL', game_tags: 'NOVEL' }),
  ];

  assert.equal(filterDraftGamesByType(games, 'all').length, 3);
  assert.deepEqual(
    filterDraftGamesByType(games, 'novel').map((game) => game.file_id),
    ['novel-1'],
  );
});

test('partitionCreatorGames puts unpublished novels into draft box', () => {
  const buckets = partitionCreatorGames([
    createGame({ file_id: 'pub-1', is_public: 1, engine: 'TXT' }),
    createGame({ file_id: 'draft-1', is_public: 0, engine: 'TXT' }),
    createGame({ file_id: 'novel-draft', is_public: 0, engine: 'NOVEL', game_tags: 'NOVEL' }),
    createGame({ file_id: 'novel-pub', is_public: 1, engine: 'NOVEL', game_tags: 'NOVEL' }),
  ]);

  assert.deepEqual(buckets.publishedGames.map((game) => game.file_id), ['pub-1', 'novel-pub']);
  assert.deepEqual(buckets.draftGames.map((game) => game.file_id), ['draft-1', 'novel-draft']);
  assert.deepEqual(buckets.novelGames.map((game) => game.file_id), ['novel-pub']);
});

test('DRAFT_BOX_FILTER_ORDER excludes ST and keeps remaining tabs', () => {
  assert.deepEqual(DRAFT_BOX_FILTER_ORDER, [
    'all',
    'role-playing',
    'world',
    'custom',
    'ivg',
    'novel',
  ]);
  assert.ok(!DRAFT_BOX_FILTER_ORDER.includes('st'));
});
