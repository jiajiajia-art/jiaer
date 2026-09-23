/* ══════════════════════════════════════════════════════════════════════
 * storage.ts — 大容量游戏存档持久层（localforage / IndexedDB）
 *
 * 设计要点（对应需求）：
 *  1) 全局强制 IndexedDB 驱动，禁止自动降级到 localStorage / WebSQL，
 *     杜绝同步 IO 阻塞造成的界面卡顿；
 *  2) 防抖存档：高频对话 / 属性变动时合并写入，默认 300ms；
 *  3) 轻量配置（AI 配置、界面主题等几十字节的东西）仍走原生 localStorage，
 *     大容量游戏 JSON / 完整存档 / 对话记录全部落到 gameSaveDB；
 *  4) 所有读写统一 async/await，无任何同步阻塞存储逻辑；
 *  5) 仅一个独立实例 gameSaveDB，存放玩家存档 / 历史对话 / 角色属性 / 道具；
 *  7) 全局捕获存储异常（磁盘不足、库损坏、权限报错），绝不让页面崩溃；
 *  8) 全程使用 localforage，不手写原生 IndexedDB。
 *
 * 所有可调参数集中在文件顶部，方便后续快速修改。
 * ════════════════════════════════════════════════════════════════════ */
import localforage from "localforage";
import type { GameState } from "./types";

/* ───────────── 顶部统一配置区（改这里即可） ───────────── */
export const DB_NAME = "gameSaveDB"; // 独立数据库实例名
export const DB_STORE = "saves"; // 对象仓库名
export const SAVE_DEBOUNCE_MS = 300; // 防抖存档延迟（毫秒）
export const MAX_SLOTS = 6; // 手动存档位上限
export const AUTO_SLOT_ID = "autosave"; // 自动存档专用槽位 id
/* ─────────────────────────────────────────────────────── */

/* 单一实例：只放玩家游戏存档、历史对话、角色属性、道具数据（无草稿库） */
const gameSaveDB = localforage.createInstance({
  name: DB_NAME,
  storeName: DB_STORE,
  description: "玩家游戏存档 · 历史对话 · 角色属性 · 道具数据",
});

/* 强制驱动为 IndexedDB，禁止降级；失败仅记录，不抛出以免影响启动 */
let driverReady: Promise<void> | null = null;
function ensureDriver(): Promise<void> {
  if (!driverReady) {
    driverReady = gameSaveDB
      .setDriver(localforage.INDEXEDDB)
      .catch((e) => {
        // 环境不支持 IndexedDB：只告警，后续读写会走统一异常捕获返回兜底值
        console.warn("[storage] IndexedDB 驱动不可用，存档能力受限：", e);
      });
  }
  return driverReady;
}

/* 统一异常捕获：磁盘满 / 库损坏 / 权限报错都在这里兜底，绝不让 UI 崩溃 */
async function guard<T>(label: string, op: () => Promise<T>, fallback: T): Promise<T> {
  try {
    await ensureDriver();
    return await op();
  } catch (e) {
    console.error(`[storage] ${label} 失败：`, e);
    return fallback;
  }
}

/* ───────────── 存档槽数据结构 ───────────── */
export type SaveSlot = {
  id: string; // 槽位 id（AUTO_SLOT_ID 或手动槽 uid）
  name: string; // 存档显示名（可重命名）
  updatedAt: number; // 最近写入时间戳
  auto?: boolean; // 是否为自动存档槽
  state: GameState; // 完整游戏状态（大容量 JSON）
};

const slotKey = (id: string) => `slot:${id}`;

/* 列出全部存档：自动存档置顶，其余按更新时间倒序 */
export async function listSaves(): Promise<SaveSlot[]> {
  return guard(
    "listSaves",
    async () => {
      const out: SaveSlot[] = [];
      await gameSaveDB.iterate<SaveSlot, void>((v) => {
        if (v && v.id) out.push(v);
      });
      out.sort((a, b) => {
        if (a.auto && !b.auto) return -1;
        if (b.auto && !a.auto) return 1;
        return b.updatedAt - a.updatedAt;
      });
      return out;
    },
    [],
  );
}

/* 仅手动存档槽（不含自动存档） */
export async function listManualSaves(): Promise<SaveSlot[]> {
  return (await listSaves()).filter((s) => !s.auto);
}

/* 写入 / 覆盖一个存档槽 */
export async function writeSlot(slot: SaveSlot): Promise<boolean> {
  return guard(
    "writeSlot",
    async () => {
      await gameSaveDB.setItem(slotKey(slot.id), slot);
      return true;
    },
    false,
  );
}

/* 写入自动存档（固定槽位，持续覆盖） */
export async function writeAutosave(state: GameState): Promise<boolean> {
  return writeSlot({
    id: AUTO_SLOT_ID,
    name: `自动存档 · ${state.player?.name ?? "未命名"}`,
    updatedAt: Date.now(),
    auto: true,
    state,
  });
}

/* 存入 / 覆盖一个手动槽（受 MAX_SLOTS 约束由 UI 层控制） */
export async function saveToSlot(id: string, state: GameState, name?: string): Promise<boolean> {
  const prev = await getSlot(id);
  return writeSlot({
    id,
    name: name ?? prev?.name ?? `${state.player?.name ?? "存档"} · ${state.world?.time || "序章"}`,
    updatedAt: Date.now(),
    state,
  });
}

/* 读取单个槽 */
export async function getSlot(id: string): Promise<SaveSlot | null> {
  return guard("getSlot", async () => (await gameSaveDB.getItem<SaveSlot>(slotKey(id))) ?? null, null);
}

/* 删除一个槽 */
export async function deleteSlot(id: string): Promise<boolean> {
  return guard(
    "deleteSlot",
    async () => {
      await gameSaveDB.removeItem(slotKey(id));
      return true;
    },
    false,
  );
}

/* 重命名一个槽（仅改显示名，不动 state） */
export async function renameSlot(id: string, name: string): Promise<boolean> {
  const slot = await getSlot(id);
  if (!slot) return false;
  return writeSlot({ ...slot, name: name.trim() || slot.name });
}

/* ───────────── 防抖存档 ───────────── */
// 频繁对话 / 属性变动时不会重复高频写库；同一时间窗内只落最后一次。
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingState: GameState | null = null;

/** 防抖写入自动存档：立即返回，真正落库延迟 SAVE_DEBOUNCE_MS。 */
export function autosaveDebounced(state: GameState): void {
  pendingState = state;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const s = pendingState;
    debounceTimer = null;
    pendingState = null;
    if (s) void writeAutosave(s);
  }, SAVE_DEBOUNCE_MS);
}

/** 立即把待写入的自动存档刷盘（如退出前 / 手动存档时调用）。 */
export async function flushAutosave(): Promise<boolean> {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  const s = pendingState;
  pendingState = null;
  return s ? writeAutosave(s) : true;
}

/* ───────────── 旧版 localStorage 存档一次性迁移 ───────────── */
const LEGACY_KEY = "xh_saves";
let migrated = false;
export async function migrateLegacySaves(): Promise<void> {
  if (migrated) return;
  migrated = true;
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return;
    const old = JSON.parse(raw) as SaveSlot[];
    if (!Array.isArray(old) || old.length === 0) return;
    const existing = await listSaves();
    const have = new Set(existing.map((s) => s.id));
    for (const s of old) {
      if (s && s.id && !have.has(s.id)) await writeSlot({ ...s, updatedAt: s.updatedAt ?? Date.now() });
    }
    localStorage.removeItem(LEGACY_KEY); // 迁移完成即清理，避免重复导入
  } catch (e) {
    console.warn("[storage] 旧存档迁移跳过：", e);
  }
}

/* ═══════════════════════ 基础调用示例 ═══════════════════════
 * // 保存存档（存入手动槽 "slot-1"）：
 * import { saveToSlot, listManualSaves, getSlot, autosaveDebounced } from "./storage";
 * await saveToSlot("slot-1", gameState, "第一周 · 初入行");
 *
 * // 读取存档：
 * const slot = await getSlot("slot-1");
 * if (slot) startGame(slot.state);
 *
 * // 列出手动存档位：
 * const slots = await listManualSaves();
 *
 * // 自动存档（防抖，玩家每次行动后调用，UI 不卡顿）：
 * autosaveDebounced(gameState);
 * ═══════════════════════════════════════════════════════════ */
