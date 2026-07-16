import type { UserGameData } from '../api/home/getGameData.type';

export const NOVEL_ENGINE = 'NOVEL';

/** 创建回放时默认勾选「创建成小说」 */
export const DEFAULT_CREATE_AS_NOVEL = true;

const REPLAY_TITLE_SUFFIX_PATTERNS = [
  /\s*[·•\-—]\s*回放\s*$/u,
  /\s*回放\s*$/u,
  /\s*[·•\-—]\s*我的回放\s*$/u,
  /\s*我的回放\s*$/u,
  /\s*[·•\-—]\s*replay\s*$/iu,
  /\s*[·•\-—]\s*my replay\s*$/iu,
];

/** 去掉标题末尾的回放标记，供「创建成小说」使用 */
export function stripReplayMarkerFromTitle(title: string): string {
  let result = String(title ?? '').trim();
  if (!result) return result;

  for (const pattern of REPLAY_TITLE_SUFFIX_PATTERNS) {
    result = result.replace(pattern, '').trim();
  }

  return result;
}

export function resolveReplayModalTitle(title: string, createAsNovel: boolean, replayLabel: string): string {
  const trimmed = String(title ?? '').trim();
  if (!createAsNovel) {
    if (!trimmed) return replayLabel;
    if (stripReplayMarkerFromTitle(trimmed) === trimmed && !/回放|replay/i.test(trimmed)) {
      return `${trimmed} · ${replayLabel}`.slice(0, 20);
    }
    return trimmed;
  }
  return stripReplayMarkerFromTitle(trimmed);
}

const normalizeRawGameType = (value?: string | null): string => {
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

export function isNovelEngine(engine?: string | null, gameTags?: string | null): boolean {
  return normalizeRawGameType(engine) === NOVEL_ENGINE
    || normalizeRawGameType(gameTags) === NOVEL_ENGINE;
}

export function resolveCreateAsNovelFlag(value?: boolean): boolean {
  return value !== false;
}

export type CreatorGameBuckets = {
  publishedGames: UserGameData[];
  draftGames: UserGameData[];
  novelGames: UserGameData[];
};

/** 将创作者作品列表拆分为已发布、草稿（含未发布小说） */
export function partitionCreatorGames(fileMetas: UserGameData[]): CreatorGameBuckets {
  const publishedGames: UserGameData[] = [];
  const draftGames: UserGameData[] = [];
  const novelGames: UserGameData[] = [];

  fileMetas.forEach((game) => {
    if (game.is_public === 1) {
      publishedGames.push(game);
      if (isNovelEngine(game.engine, game.game_tags)) {
        novelGames.push(game);
      }
      return;
    }

    draftGames.push(game);
  });

  return { publishedGames, draftGames, novelGames };
}

export function getNovelSourceFileId(game: Pick<UserGameData, 'source_file_id'> & { sourceFileId?: string }): string {
  return String(game.source_file_id || game.sourceFileId || '').trim();
}

export function buildNovelReadPath(novelFileId: string): string {
  return `/novel/${encodeURIComponent(novelFileId)}/read`;
}

export function buildSourceGameDetailPath(sourceFileId: string): string {
  return `/game/${encodeURIComponent(sourceFileId)}`;
}

/** 文本模式中可展示的 step 类型（排除 scene_change 等无文案步骤） */
export function countVisibleNovelTextSteps(steps: Array<{ type?: string }>): number {
  return steps.filter((step) => {
    const type = String(step?.type || '').trim();
    return type && type !== 'scene_change';
  }).length;
}

export type PublishModalMode = 'publish' | 'novel-edit';

/** 小说上架仍可用 novel-edit 弹窗；创作台「编辑修改」已改为续玩，不再走此 intent。 */
export function resolvePublishModalMode(options: {
  isNovel: boolean;
  intent: 'edit' | 'publish';
}): PublishModalMode {
  if (options.isNovel && options.intent === 'edit') {
    return 'novel-edit';
  }
  return 'publish';
}

/**
 * 判断是否应打开小说编辑弹窗。
 * 小说 engine=NOVEL 不在 resolveCreatorEngine 白名单，编辑入口需单独判断。
 */
export function shouldOpenNovelEditModal(engine?: string | null, gameTags?: string | null): boolean {
  return isNovelEngine(engine, gameTags);
}
