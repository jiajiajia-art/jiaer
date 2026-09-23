/**
 * 功能注释：首页/列表卡片作者 byline（头像 + 昵称）展示用纯函数。
 */

export const GAME_CARD_DEFAULT_AVATAR_PATH = 'data/assets/defaultAvatar.png';

export interface GameCardAuthorSource {
  author_name?: unknown;
  avatarUrl?: unknown;
}

export interface ResolveGameCardAuthorOptions {
  unknownAuthor?: string;
}

export interface GameCardAuthorView {
  name: string;
  avatarUrl: string;
  hasNamedAuthor: boolean;
}

export function resolveGameCardAuthor(
  game: GameCardAuthorSource,
  opts: ResolveGameCardAuthorOptions = {},
): GameCardAuthorView {
  const name = String(game?.author_name || '').trim();
  const avatarUrl = String(game?.avatarUrl || '').trim();
  return {
    name: name || String(opts.unknownAuthor || '未知作者'),
    avatarUrl,
    hasNamedAuthor: Boolean(name),
  };
}
