/**
 * 创作台「开始测试 / 编辑修改」进游玩页的会话策略。
 * - TXT 开始测试：弹出与详情页一致的「开始方式」选择（新的开始 / 继续体验 / 读取存档）
 * - TXT「新的开始」：optical 新建（restart=true）→ /galgame
 * - TXT「继续体验」：optical 续玩（restart=false）→ /galgame
 * - NOVEL 开始测试：直接进小说阅读页 `/novel/:id/read`（不进原作 AI 文游）
 * - 编辑修改（仅视觉小说 NOVEL）：optical 续玩原作（restart=false），载入历史接着玩
 * - AI文游 TXT 编辑仍进 /gameSettingsEditor，不走续玩
 * - 不自动弹出历史面板
 */

export type CreatorPlayIntent = 'start-test' | 'continue-play' | 'edit-continue';

export type CreatorPlayMode =
  | 'TXT'
  | 'NOVEL'
  | 'AVG'
  | 'customif'
  | 'st'
  | 'interactive-video'
  | 'ROMANCE'
  | '';

function normalizeRawGameType(value?: string | null): string {
  if (!value) return '';
  return String(value)
    .trim()
    .replace(/^\[\s*/, '')
    .replace(/\s*\]$/, '')
    .split(',')[0]
    .replace(/^["']|["']$/g, '')
    .trim()
    .toUpperCase();
}

/** 与 GameStatsView 开始测试分发一致的模式归一化。 */
export function normalizeCreatorPlayMode(
  engine?: string | null,
  gameTags?: string | null,
): CreatorPlayMode {
  const normalizedEngine = normalizeRawGameType(engine);
  if (normalizedEngine === 'CUSTOM') return 'customif';
  if (normalizedEngine === 'ST') return 'st';
  if (normalizedEngine === 'IVG') return 'interactive-video';
  if (normalizedEngine === 'NOVEL') return 'NOVEL';
  // 功能注释：Romance 与详情页进局一致，创作台测玩须识别，避免「未知的游戏类型」
  if (normalizedEngine === 'ROMANCE') return 'ROMANCE';
  if (normalizedEngine === 'TXT' || normalizedEngine === 'AVG' || normalizedEngine === 'RPG') {
    return normalizedEngine === 'RPG' ? 'TXT' : (normalizedEngine as 'TXT' | 'AVG');
  }

  const normalizedTags = normalizeRawGameType(gameTags);
  if (normalizedTags === 'CUSTOM') return 'customif';
  if (normalizedTags === 'IVG') return 'interactive-video';
  if (normalizedTags === 'NOVEL') return 'NOVEL';
  if (normalizedTags === 'ROMANCE') return 'ROMANCE';
  if (normalizedTags === 'TXT' || normalizedTags === 'AVG' || normalizedTags === 'RPG') {
    return normalizedTags === 'RPG' ? 'TXT' : (normalizedTags as 'TXT' | 'AVG');
  }

  return '';
}

/**
 * 功能注释：创作台 / 详情页 Romance 测玩路径，与 GameDetail play=1 约定一致（读已发布包）。
 */
export function buildRomanceCreatorPlayPath(fileId: string): string {
  const id = String(fileId || '').trim();
  return `/romance/?play=1&fileId=${encodeURIComponent(id)}`;
}

/**
 * AI文游（TXT）开始测试需要弹窗选择开始方式；其它模式仍直接进入。
 */
export function shouldOpenCreatorStartOptions(
  engine?: string | null,
  gameTags?: string | null,
): boolean {
  return normalizeCreatorPlayMode(engine, gameTags) === 'TXT';
}

/** 「编辑修改」仅视觉小说续玩进 /galgame；AI文游走设定编辑页，其它类型走各自编辑页。 */
export function shouldContinuePlayOnEdit(
  engine?: string | null,
  gameTags?: string | null,
): boolean {
  return normalizeCreatorPlayMode(engine, gameTags) === 'NOVEL';
}

/**
 * 续玩 / 测玩使用的 fileId：
 * - 小说走原作 sourceFileId
 * - 其它用作品自身 file_id
 */
export function resolveContinuePlayFileId(input: {
  engine?: string | null;
  gameTags?: string | null;
  fileId?: string | null;
  id?: string | null;
  sourceFileId?: string | null;
}): string {
  const mode = normalizeCreatorPlayMode(input.engine, input.gameTags);
  if (mode === 'NOVEL') {
    return String(input.sourceFileId || '').trim();
  }
  return String(input.fileId || input.id || '').trim();
}

/** start-test 必须 restart；continue-play / edit-continue 禁止 restart，才能载入历史。 */
export function shouldRestartPlaySession(intent: CreatorPlayIntent): boolean {
  return intent === 'start-test';
}

/** optical 续玩请求体（不含 playerName）。 */
export function buildCreatorPlaySessionRequest(input: {
  intent: CreatorPlayIntent;
  fileId: string;
  source?: 'link' | 'game_detail' | 'history' | 'other';
}): { fileId: string; restart: boolean; source: 'link' | 'game_detail' | 'history' | 'other'; billingMode?: 'creator_test' } {
  return {
    fileId: String(input.fileId || '').trim(),
    restart: shouldRestartPlaySession(input.intent),
    source: input.source || 'other',
    ...(input.intent !== 'edit-continue' ? { billingMode: 'creator_test' as const } : {}),
  };
}

/**
 * 解析 optical create 返回的 session_id。
 * 兼容：session 为对象 `{ session_id }` / `{ sessionId }`，或历史字符串。
 */
export function parseOpticalPlaySessionId(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const root = data as Record<string, unknown>;
  const session = root.session ?? root;
  if (typeof session === 'string') {
    const id = session.trim();
    return id || null;
  }
  if (session && typeof session === 'object') {
    const row = session as Record<string, unknown>;
    const id = String(row.session_id || row.sessionId || '').trim();
    return id || null;
  }
  return null;
}

/** 进游玩页路由：不自动打开历史面板。 */
export function buildGalgameContinueNavigate(): {
  path: '/galgame';
  state: { from: 'creator-edit-continue'; openHistory: false };
} {
  return {
    path: '/galgame',
    state: {
      from: 'creator-edit-continue',
      openHistory: false,
    },
  };
}

/**
 * optical 侧是否应复用已有会话（与后端 gamesSession 规则对齐，便于单测）。
 * hasExisting=true 且 restart≠true → 复用。
 */
export function shouldReuseExistingPlaySession(input: {
  restart?: boolean;
  hasExisting: boolean;
}): boolean {
  return Boolean(input.hasExisting) && input.restart !== true;
}
