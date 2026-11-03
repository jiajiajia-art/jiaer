/**
 * 书架纯逻辑：时间文案、状态文案、「继续游玩」去向决策、批量选择 / 乐观移除回滚、页签与滚动位置恢复。
 * 页面只负责请求与渲染，可测分支全部集中在这里。
 */

export type ShelfTab = 'recent' | 'favorites';
export type ShelfGameStatus = 'available' | 'offline' | 'private' | 'deleted' | 'missing';

/** 与后端 toShelfItem 输出一一对应 */
export interface ShelfItem {
  fileId: string;
  title: string;
  author: string;
  coverUrl: string;
  portraitCoverUrl: string;
  gameMode: string;
  status: ShelfGameStatus;
  canPlay: boolean;
  isFavorited: boolean;
  favoritedAt: string | null;
  hasPlayRecord: boolean;
  lastPlayedAt: string | null;
  lastAction: 'session' | 'save' | 'load' | null;
  lastSaveId: string | null;
  playerName: string | null;
  gameDate: string | null;
  isPaidGame: boolean;
  purchased: boolean;
}

/** GET /visual/saves?includeInvalid=1 的单项 */
export interface ShelfSaveEntry {
  saveId: string;
  status: 'ok' | 'corrupted' | 'incompatible';
  reason?: string;
  summaryPreview?: string;
  createdAt: number;
  updatedAt?: number;
  playerName?: string | null;
  gameDate?: string | null;
  turnCount?: number | null;
}

/** 选择存档弹窗里的一行：上次自动进度 或 某个手动存档 */
export interface ShelfResumeOption {
  key: string;
  kind: 'session' | 'save';
  saveId: string | null;
  savedAt: number;
  playerName: string | null;
  gameDate: string | null;
  turnCount: number | null;
  summary: string;
}

export type ShelfContinuePlan =
  | { kind: 'blocked'; reason: string }
  | { kind: 'resume'; saveId: string | null }
  | { kind: 'choose'; options: ShelfResumeOption[]; invalid: ShelfSaveEntry[]; defaultKey: string }
  | { kind: 'noValidSave'; invalid: ShelfSaveEntry[] };

/** 只有 TXT（视觉小说）有多存档槽；其余引擎只有一条续玩进度 */
export function shelfSupportsSaveSlots(gameMode: string): boolean {
  return String(gameMode || '').toUpperCase() === 'TXT';
}

/** 功能注释：剧本状态 → 卡片角标文案；可正常游玩时返回空串不显示角标。 */
export function shelfStatusLabel(status: ShelfGameStatus): string {
  switch (status) {
    case 'offline': return '已下架';
    case 'private': return '已设为私密';
    case 'deleted': return '已删除';
    case 'missing': return '已不存在';
    default: return '';
  }
}

/** 功能注释：不可游玩时的提示文案（与平台权限一致，后端 canPlay 为准）。 */
export function shelfBlockedReason(item: Pick<ShelfItem, 'status' | 'canPlay'>): string {
  if (item.canPlay) return '';
  switch (item.status) {
    case 'offline': return '该剧本已下架，暂不可游玩';
    case 'private': return '该剧本已设为私密，暂不可游玩';
    case 'deleted': return '该剧本已被作者删除';
    case 'missing': return '该剧本已不存在';
    default: return '该剧本暂不可游玩';
  }
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * 功能注释：最后游玩时间相对文案：刚刚 / N分钟前 / N小时前 / 昨天 / N天前（<7天）/ 同年 MM-DD / YYYY-MM-DD。
 * 非法时间返回空串，卡片不显示该行。
 */
export function formatShelfPlayedAt(value: string | number | null | undefined, now: number = Date.now()): string {
  if (value === null || value === undefined || value === '') return '';
  const ts = typeof value === 'number' ? value : Date.parse(value);
  if (!Number.isFinite(ts) || ts <= 0) return '';
  const diff = Math.max(0, now - ts);
  const minute = 60_000;
  const hour = 60 * minute;
  if (diff < minute) return '刚刚';
  if (diff < hour) return `${Math.floor(diff / minute)}分钟前`;
  const date = new Date(ts);
  const today = new Date(now);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  if (ts >= startOfToday) return `${Math.floor(diff / hour)}小时前`;
  const dayMs = 24 * hour;
  if (ts >= startOfToday - dayMs) return '昨天';
  const days = Math.ceil((startOfToday - ts) / dayMs);
  if (days < 7) return `${days}天前`;
  const md = `${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  return date.getFullYear() === today.getFullYear() ? md : `${date.getFullYear()}-${md}`;
}

/** 功能注释：存档时间（毫秒）→ YYYY-MM-DD HH:mm。 */
export function formatShelfSaveTime(ms: number | null | undefined): string {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return '';
  const d = new Date(n);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** 功能注释：卡片第二行「主角名 · 游戏内日期」，缺什么就省什么，都缺返回空串（不编造）。 */
export function shelfProgressLine(item: Pick<ShelfItem, 'playerName' | 'gameDate'>): string {
  return [item.playerName, item.gameDate].map((s) => String(s || '').trim()).filter(Boolean).join(' · ');
}

/** 功能注释：存档进度文案：游戏内日期优先，其次回合数，都没有返回空串。 */
export function shelfSaveProgressLabel(entry: Pick<ShelfSaveEntry, 'gameDate' | 'turnCount'>): string {
  const date = String(entry.gameDate || '').trim();
  if (date) return date;
  const turn = Number(entry.turnCount);
  return Number.isFinite(turn) && turn > 0 ? `第 ${turn} 回合` : '';
}

/**
 * 功能注释：「继续游玩」去向决策。
 * - 不可游玩 → blocked
 * - 非 TXT → 直接续上唯一进度
 * - TXT：候选 = 上次自动进度（最近一次是开局/续玩时）+ 可读手动存档；
 *   0 个候选但有坏档 → noValidSave（提示原因，不自动清档）；1 个直接进；多个弹【选择存档】，默认选中最近一次实际游玩的那条。
 */
export function resolveShelfContinuePlan(
  item: Pick<ShelfItem, 'canPlay' | 'status' | 'gameMode' | 'lastAction' | 'lastSaveId' | 'lastPlayedAt' | 'playerName' | 'gameDate'>,
  saves: ShelfSaveEntry[] | null,
): ShelfContinuePlan {
  if (!item.canPlay) return { kind: 'blocked', reason: shelfBlockedReason(item) };
  if (!shelfSupportsSaveSlots(item.gameMode) || saves === null) return { kind: 'resume', saveId: null };

  const valid = saves.filter((s) => s.status === 'ok');
  const invalid = saves.filter((s) => s.status !== 'ok');
  const options: ShelfResumeOption[] = [];
  const lastPlayedMs = item.lastPlayedAt ? Date.parse(item.lastPlayedAt) : 0;
  const hasSessionProgress = item.lastAction === 'session' || (item.lastAction !== null && !item.lastSaveId);
  if (hasSessionProgress) {
    options.push({
      key: 'session',
      kind: 'session',
      saveId: null,
      savedAt: Number.isFinite(lastPlayedMs) ? lastPlayedMs : 0,
      playerName: item.playerName,
      gameDate: item.gameDate,
      turnCount: null,
      summary: '上次游玩的自动进度',
    });
  }
  for (const s of valid) {
    options.push({
      key: `save:${s.saveId}`,
      kind: 'save',
      saveId: s.saveId,
      savedAt: Number(s.updatedAt || s.createdAt || 0),
      playerName: s.playerName ?? null,
      gameDate: s.gameDate ?? null,
      turnCount: s.turnCount ?? null,
      summary: String(s.summaryPreview || ''),
    });
  }

  if (options.length === 0) {
    return invalid.length > 0 ? { kind: 'noValidSave', invalid } : { kind: 'resume', saveId: null };
  }
  if (options.length === 1 && invalid.length === 0) {
    return { kind: 'resume', saveId: options[0].saveId };
  }
  const lastSaveKey = item.lastSaveId ? `save:${item.lastSaveId}` : '';
  const defaultKey = !hasSessionProgress && options.some((o) => o.key === lastSaveKey)
    ? lastSaveKey
    : options[0].key;
  return { kind: 'choose', options, invalid, defaultKey };
}

/** 功能注释：批量选择切换（不可变），重复点击取消选中。 */
export function toggleShelfSelection(selected: string[], fileId: string): string[] {
  return selected.includes(fileId) ? selected.filter((id) => id !== fileId) : [...selected, fileId];
}

/**
 * 功能注释：乐观移除：返回移除后的列表与快照，失败时用 restoreShelfItems 原位放回，保持原顺序。
 */
export function removeShelfItems(items: ShelfItem[], fileIds: string[]): { next: ShelfItem[]; removed: Array<{ index: number; item: ShelfItem }> } {
  const ids = new Set(fileIds);
  const removed: Array<{ index: number; item: ShelfItem }> = [];
  const next: ShelfItem[] = [];
  items.forEach((item, index) => {
    if (ids.has(item.fileId)) removed.push({ index, item });
    else next.push(item);
  });
  return { next, removed };
}

export function restoreShelfItems(items: ShelfItem[], removed: Array<{ index: number; item: ShelfItem }>): ShelfItem[] {
  const out = items.filter((i) => !removed.some((r) => r.item.fileId === i.fileId));
  for (const { index, item } of [...removed].sort((a, b) => a.index - b.index)) {
    out.splice(Math.min(index, out.length), 0, item);
  }
  return out;
}

/** 功能注释：分页追加时按 fileId 去重，防止翻页期间列表变动导致重复卡片。 */
export function mergeShelfPage(prev: ShelfItem[], page: ShelfItem[]): ShelfItem[] {
  const seen = new Set(prev.map((i) => i.fileId));
  return [...prev, ...page.filter((i) => !seen.has(i.fileId) && seen.add(i.fileId))];
}

export const SHELF_VIEW_STORAGE_KEY = 'funloom:bookshelf:view';

export const SHELF_PAGE_SIZE = 20;
const SHELF_PAGE_MAX = 50;

export interface ShelfViewState {
  tab: ShelfTab;
  scrollY: number;
  /** 离开时已加载的卡片数，返回时首屏一次拉够以便恢复滚动位置 */
  loaded: number;
}

/** 功能注释：解析 sessionStorage 中保存的页签与滚动位置；脏数据回落默认（最近游玩、顶部）。 */
export function parseShelfViewState(raw: string | null | undefined): ShelfViewState {
  const fallback: ShelfViewState = { tab: 'recent', scrollY: 0, loaded: 0 };
  if (!raw) return fallback;
  try {
    const data = JSON.parse(raw) as Partial<ShelfViewState>;
    const tab: ShelfTab = data?.tab === 'favorites' ? 'favorites' : 'recent';
    const y = Number(data?.scrollY);
    const loaded = Number(data?.loaded);
    return {
      tab,
      scrollY: Number.isFinite(y) && y > 0 ? Math.floor(y) : 0,
      loaded: Number.isFinite(loaded) && loaded > 0 ? Math.floor(loaded) : 0,
    };
  } catch {
    return fallback;
  }
}

/** 功能注释：首屏拉取条数：恢复场景按离开时已加载数（上限 50），否则默认一页。 */
export function shelfFirstPageSize(restoredLoaded: number): number {
  const n = Math.floor(Number(restoredLoaded) || 0);
  return Math.min(Math.max(n, SHELF_PAGE_SIZE), SHELF_PAGE_MAX);
}

/** 功能注释：搜索框输入归一（去首尾空白、限长 50，与后端一致）。 */
export function normalizeShelfKeyword(raw: string): string {
  return String(raw || '').trim().slice(0, 50);
}
