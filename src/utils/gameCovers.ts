/**
 * 作品双封面：横 16:9 与竖 3:4 是否都齐，以及列表卡优先用竖图。
 */

export type CoverOrientation = 'landscape' | 'portrait';

export type GameCoverFields = {
  cover_url?: string | null;
  portrait_cover_url?: string | null;
  display_cover_url?: string | null;
  coverUrl?: string | null;
  portraitCoverUrl?: string | null;
} | null | undefined;

export function trimCoverUrl(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function landscapeCoverUrl(game: GameCoverFields): string {
  return trimCoverUrl(game?.cover_url) || trimCoverUrl(game?.coverUrl);
}

export function portraitCoverUrl(game: GameCoverFields): string {
  return trimCoverUrl(game?.portrait_cover_url) || trimCoverUrl(game?.portraitCoverUrl);
}

export function hasBothGameCovers(game: GameCoverFields): boolean {
  return Boolean(landscapeCoverUrl(game) && portraitCoverUrl(game));
}
