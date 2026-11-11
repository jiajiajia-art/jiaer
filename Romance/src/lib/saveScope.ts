/* 存档隔离存储层 —— 全项目唯一允许直接触碰 localStorage 的地方（存档本体在 lib/storage.ts 的 localforage 里）。
 *
 * 两类数据，分开处理：
 *  · 全局公共数据（不隔离）：AI 配置、存档列表、UI/皮肤设置、模组与编辑器素材 → saveGlobal / loadGlobal
 *  · 存档私有数据（必须隔离）：玩家在某一局里产生的一切（购买、收藏、备忘、App 缓存…）
 *    → saveData / loadData，实际 key = `${currentSaveId}_${key}`
 *
 * 兜底：loadData 读不到「当前存档」的 key 时直接返回调用方给的全新默认值，绝不回退去读别的存档或旧版无前缀数据。
 * 没有激活任何存档（封面 / 建角页）时，saveData 不落盘、loadData 只返回默认值。 */

let currentSaveId = "";
export const getCurrentSaveId = () => currentSaveId;

const scoped = (key: string) => `${currentSaveId}_${key}`;

/* ——— 存档私有数据 ——— */
export function saveData<T>(key: string, data: T): boolean {
  if (!currentSaveId) return false;
  try { localStorage.setItem(scoped(key), JSON.stringify(data)); return true; } catch { return false; } // 配额满 / 隐私模式
}
export function loadData<T>(key: string, fallback: T): T {
  if (!currentSaveId) return fallback;
  try {
    const raw = localStorage.getItem(scoped(key));
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch { return fallback; }
}
export function removeData(key: string) {
  if (!currentSaveId) return;
  try { localStorage.removeItem(scoped(key)); } catch { /* 忽略 */ }
}
/** 导出某存档的全部私有数据快照（写入存档槽时随档保存，读档时原样恢复 → 同一局的不同存档位也互不串味） */
export function exportSaveData(saveId: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!saveId || saveId !== currentSaveId) return out; // 只导出正在游玩的存档，绝不把别档数据写进来
  try {
    const pfx = `${saveId}_`;
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k?.startsWith(pfx)) out[k.slice(pfx.length)] = localStorage.getItem(k) ?? ""; }
  } catch { /* 忽略 */ }
  return out;
}
export function purgeSaveData(saveId: string) {
  try {
    const pfx = `${saveId}_`;
    for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k?.startsWith(pfx)) localStorage.removeItem(k); }
  } catch { /* 忽略 */ }
}
/** 用存档快照覆盖该存档的私有数据：先清空同前缀残留，再写回快照（无快照 = 全新空白） */
function importSaveData(saveId: string, snap: Record<string, string> | undefined) {
  purgeSaveData(saveId);
  if (!snap) return;
  try { for (const [k, v] of Object.entries(snap)) localStorage.setItem(`${saveId}_${k}`, v); } catch { /* 配额满：保留已写部分 */ }
}

/* ——— 全局公共数据（不加前缀） ——— */
export function saveGlobal<T>(key: string, data: T): boolean {
  try { localStorage.setItem(key, JSON.stringify(data)); return true; } catch { return false; }
}
export function loadGlobal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    try { return JSON.parse(raw) as T; } catch { return raw as unknown as T; } // 兼容旧版直接存的纯字符串
  } catch { return fallback; }
}
export function removeGlobal(key: string) {
  try { localStorage.removeItem(key); } catch { /* 忽略 */ }
}

/* ——— 内存缓存登记：模块级缓存变量在这里登记清理函数，切档时统一清空 ——— */
const clearers = new Set<() => void>();
export function onClearPlayerMemory(fn: () => void) { clearers.add(fn); return () => { clearers.delete(fn); }; }
export const SAVE_SWITCH_EVENT = "star:save-switch";

/** 切换存档的第一步前置：清空页面所有玩家内存缓存变量，并通知 UI 丢弃旧 DOM（由 GameProvider 换 key 整树重挂载） */
export function clearPlayerMemory() {
  clearers.forEach((fn) => { try { fn(); } catch { /* 单个清理失败不影响其余 */ } });
  window.dispatchEvent(new CustomEvent(SAVE_SWITCH_EVENT));
}

/**
 * 切换存档 · 严格 5 步：
 *  ① 保存当前存档全部玩家数据（flushCurrent：落库尚在防抖中的存档）
 *  ② 清空页面所有内存缓存变量（clearPlayerMemory）
 *  ③ 更新全局 currentSaveId
 *  ④ 读取新存档专属数据（各模块 reload 回调用 loadData，缺省即全新默认值）
 *  ⑤ 重新渲染（render：换 key 重挂载整棵游戏 UI，清空旧 DOM 残留）
 */
export function switchSave(nextId: string, steps: { flushCurrent: () => unknown; render: () => void; snapshot?: Record<string, string>; existing?: boolean }) {
  // ① 同步取走待写快照并发起落库（flushAutosave 在首个 await 前就已摘下 pendingState，新档写入排在其后）
  if (currentSaveId) void steps.flushCurrent();
  clearPlayerMemory(); // ②
  currentSaveId = nextId; // ③
  importSaveData(nextId, steps.snapshot); // ④ 先把本存档快照落回存储（缺省 = 全新空白）
  // 旧版无前缀数据只可能属于「升级前就存在的老存档」：仅在读取已有存档时迁移，新开局一律全新空白
  if (steps.existing) migrateLegacyPrivate(nextId, !!steps.snapshot);
  reloaders.forEach((fn) => { try { fn(); } catch { /* 忽略 */ } }); // ④
  steps.render(); // ⑤
}
const reloaders = new Set<() => void>();
/** 登记「新存档激活后重新读取」的回调（模块级缓存在这里从 loadData 重新装载） */
export function onLoadPlayerData(fn: () => void) { reloaders.add(fn); return () => { reloaders.delete(fn); }; }

/* ——— 旧版无前缀私有数据：一次性迁给第一个读进来的存档，随即删除旧 key（之后不会再被任何存档读到） ——— */
const LEGACY_FLAG = "star2005.legacy-private-migrated";
const LEGACY_PREFIXES = ["star2005.phone.mem.", "star2005.phone.feed.", "star2005.profile.", "star2005.widget.", "uapp."];
const LEGACY_KEYS = [
  "star2005.wx.favs", "star2005.wx.strangers", "star2005.wx.proactive.last", "star2005.wx.proactive.stamp",
  "star2005.phone.music.likes", "bosspin.role", "star2005.peek.v3", "star2005.forum.user.v2",
  "star2005.phone.pomodoro", "star2005.phone.alarms", "star2005.phone.memos", "star2005.phone.callSeen",
];
const isLegacy = (k: string) => LEGACY_KEYS.includes(k) || (LEGACY_PREFIXES.some((p) => k.startsWith(p)) && !k.startsWith("uapp.selftest."));
function migrateLegacyPrivate(saveId: string, hasSnapshot: boolean) {
  try {
    if (localStorage.getItem(LEGACY_FLAG)) return;
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && isLegacy(k)) keys.push(k); }
    for (const k of keys) {
      const v = localStorage.getItem(k);
      // 已有本档快照的数据优先；旧数据只补缺，不覆盖。旧版字符串值统一转成 JSON 格式
      if (v != null && !hasSnapshot && localStorage.getItem(`${saveId}_${k}`) == null) {
        let json = v; try { JSON.parse(v); } catch { json = JSON.stringify(v); }
        localStorage.setItem(`${saveId}_${k}`, json);
      }
      localStorage.removeItem(k);
    }
    localStorage.setItem(LEGACY_FLAG, "1");
  } catch { /* 配额满：下次再试 */ }
}
