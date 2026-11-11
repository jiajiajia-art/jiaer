/**
 * 功能注释：公开进入门禁 — 仅审核通过且在架可进；其余只展示说明文案。
 */

export type ListingStatusCode =
  | 'listed'
  | 'unpublished'
  | 'pending_review'
  | 'rejected'
  | 'delisted'
  | 'taken_down'
  | 'deleted';

export type PublicListingState = {
  canEnter: boolean;
  code: ListingStatusCode;
  message: string | null;
};

const MESSAGES: Record<Exclude<ListingStatusCode, 'listed'>, string> = {
  unpublished: '未上架',
  pending_review: '审核中',
  rejected: '未通过',
  delisted: '已下架',
  taken_down: '已下架',
  deleted: '已下架',
};

export function resolvePublicListingState(game: {
  is_public?: unknown;
  moderation_status?: unknown;
  moderationStatus?: unknown;
  listingStatus?: unknown;
  canEnter?: unknown;
} | null | undefined): PublicListingState {
  if (!game) {
    return { canEnter: false, code: 'unpublished', message: MESSAGES.unpublished };
  }
  if (game.canEnter === false && typeof game.listingStatus === 'string') {
    const code = game.listingStatus as ListingStatusCode;
    if (code !== 'listed') {
      return { canEnter: false, code, message: MESSAGES[code as Exclude<ListingStatusCode, 'listed'>] || MESSAGES.unpublished };
    }
  }
  const isPublic = Number(game.is_public);
  if (isPublic === 2) {
    return { canEnter: false, code: 'deleted', message: MESSAGES.deleted };
  }
  const mod = String(game.moderation_status || game.moderationStatus || 'none');
  if (mod === 'taken_down') {
    return { canEnter: false, code: 'taken_down', message: MESSAGES.taken_down };
  }
  if (mod === 'delisted') {
    return { canEnter: false, code: 'delisted', message: MESSAGES.delisted };
  }
  if (mod === 'pending_review') {
    return { canEnter: false, code: 'pending_review', message: MESSAGES.pending_review };
  }
  if (mod === 'rejected') {
    return { canEnter: false, code: 'rejected', message: MESSAGES.rejected };
  }
  if (isPublic !== 1) {
    return { canEnter: false, code: 'unpublished', message: MESSAGES.unpublished };
  }
  return { canEnter: true, code: 'listed', message: null };
}

/** 平台本体 /romance/：玩家不可进内置局，须从全部作品进 */
export function shouldGateRomancePlatformShell(input: {
  search?: string;
  hasWorldGenSession?: boolean;
  isAuthorPreview?: boolean;
  isStaff?: boolean;
}): boolean {
  const raw = String(input.search || '');
  const q = new URLSearchParams(raw.startsWith('?') ? raw.slice(1) : raw);
  if (q.get('createWorld') === '1' || q.get('createWorld') === 'true') return false;
  if (q.get('createPlayMod') === '1' || q.get('createPlayMod') === 'true') return false;
  // 功能注释：与 Romance platformShellGate 同源——玩家开玩 / 审核预览不得被门禁拦住
  if (q.get('play') === '1' || q.get('play') === 'true') return false;
  if (q.get('reviewPreview') === '1' || q.get('reviewPreview') === 'true') return false;
  if (q.get('platformTest') === '1') return false;
  if (input.hasWorldGenSession) return false;
  if (input.isAuthorPreview) return false;
  if (input.isStaff) return false;
  return true;
}
