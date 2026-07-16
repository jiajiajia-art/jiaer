import type { UserGameData } from '../api/home/getGameData.type';
import { isNovelEngine } from './novelGame.ts';

export type DraftBoxFilterKey =
  | 'all'
  | 'role-playing'
  | 'world'
  | 'custom'
  | 'ivg'
  | 'novel';

export const DRAFT_BOX_FILTER_ORDER: DraftBoxFilterKey[] = [
  'all',
  'role-playing',
  'world',
  'custom',
  'ivg',
  'novel',
];

const normalizeEngineValue = (value?: string | null): string => {
  if (!value) return '';
  return String(value)
    .trim()
    .replace(/^\[\s*/, '')
    .replace(/\s*\]$/, '')
    .split(',')[0]
    .replace(/^["']|["']$/g, '')
    .trim()
    .toUpperCase();
};

export function resolveDraftBoxFilterKey(
  game: Pick<UserGameData, 'engine' | 'game_tags'>,
): DraftBoxFilterKey | null {
  if (isNovelEngine(game.engine, game.game_tags)) {
    return 'novel';
  }

  const normalized = normalizeEngineValue(game.game_tags || game.engine);
  if (!normalized) return null;

  if (normalized === 'TXT' || normalized === 'RPG' || normalized === 'ROLE-PLAYING' || normalized === '文字互动' || normalized === '剧情推理') {
    return 'role-playing';
  }
  // ST 与 AVG 同属酒馆卡玩法入口，草稿箱不再单独拆 ST 分类
  if (normalized === 'AVG' || normalized === 'WORLD' || normalized === '世界互动' || normalized === 'ST') {
    return 'world';
  }
  if (normalized === 'CUSTOM' || normalized === '自定义') {
    return 'custom';
  }
  if (normalized === 'IVG') {
    return 'ivg';
  }

  return null;
}

export function filterDraftGamesByType(
  games: UserGameData[],
  filterKey: DraftBoxFilterKey,
): UserGameData[] {
  if (filterKey === 'all') {
    return games;
  }

  return games.filter((game) => resolveDraftBoxFilterKey(game) === filterKey);
}

export function getDraftBoxFilterLabelKey(filterKey: DraftBoxFilterKey): string {
  return `create.draftFilters.${filterKey}`;
}
