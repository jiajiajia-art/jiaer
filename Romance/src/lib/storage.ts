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
import { exportSaveData, loadGlobal, removeGlobal, purgeSaveData, getCurrentSaveId } from "./saveScope";
import { AUTHOR_PREVIEW_AUTO_SLOT, isAuthorPreview } from "./authorPreview";
import { resolveRomancePlayMode } from "./platformRomancePlay";
import { cloudDelete, cloudOffReason, cloudRename, flushCloudPushes, pullCloudSaves, queueCloudPush } from "./cloudSaves";

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
  gameId?: string; // 所属作品（平台 fileId；本机调试 = "local"）。旧存档没有此字段
};

/* ───────────── 按作品隔离 ─────────────
 * 旧版所有作品共用一个自动存档 + 6 个手动槽，玩 B 会覆盖 A 的自动存档。
 * 现在 key = slot:<gameId>:<id>；旧 key slot:<id> 仍可读（列表里标「旧版」），覆盖同槽时迁到新 key。 */
export function currentSaveGameId(search = typeof location !== "undefined" ? location.search : ""): string {
  return resolveRomancePlayMode(search).fileId || "local";
}
const isPreviewSlotId = (id: string) => id === AUTHOR_PREVIEW_AUTO_SLOT || id.startsWith("__author_preview");
const legacyKey = (id: string) => `slot:${id}`;
// 功能注释：作者预览测试槽保持旧 key（全局唯一，clearAuthorPreviewSave 按固定 id 清）
const slotKey = (id: string, gameId = currentSaveGameId()) => (isPreviewSlotId(id) ? legacyKey(id) : `slot:${gameId}:${id}`);

/* 列出全部存档：自动存档置顶，其余按更新时间倒序；作者测试槽不出现在正式列表 */
export async function listSaves(): Promise<SaveSlot[]> {
  return guard(
    "listSaves",
    async () => {
      const gameId = currentSaveGameId();
      const mine = new Map<string, SaveSlot>();
      const legacy: SaveSlot[] = [];
      await gameSaveDB.iterate<SaveSlot, void>((v) => {
        if (!v || !v.id || isPreviewSlotId(String(v.id))) return;
        if (v.gameId === gameId) mine.set(v.id, v);
        else if (!v.gameId) legacy.push(v);
      });
      // 功能注释：旧版未分作品的存档仍列出（同 id 已有新档时隐藏），避免老玩家进度「消失」
      const out: SaveSlot[] = [...mine.values(), ...legacy.filter((v) => !mine.has(v.id))];
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
      const gameId = slot.gameId ?? currentSaveGameId();
      const row: SaveSlot = isPreviewSlotId(slot.id) ? slot : { ...slot, gameId };
      await gameSaveDB.setItem(slotKey(slot.id, gameId), row);
      // 功能注释：覆盖旧版同 id 槽后删掉旧 key，完成迁移
      if (!isPreviewSlotId(slot.id)) await gameSaveDB.removeItem(legacyKey(slot.id));
      return true;
    },
    false,
  );
}

/* 本机写入成功后排队上传云端（未登录 / 无作品 / 预览 / 后端未开通时自动跳过） */
async function writeAndSync(slot: SaveSlot): Promise<boolean> {
  const ok = await writeSlot(slot);
  if (ok) queueCloudPush(currentSaveGameId(), slot, isAuthorPreview());
  return ok;
}

/* 写入自动存档（固定槽位，持续覆盖）；作者预览写入独立测试槽，不覆盖正式自动存档 */
export async function writeAutosave(state: GameState): Promise<boolean> {
  const preview = isAuthorPreview();
  return writeAndSync({
    id: preview ? AUTHOR_PREVIEW_AUTO_SLOT : AUTO_SLOT_ID,
    name: preview
      ? `作者测试 · ${state.player?.name ?? "未命名"}`
      : `自动存档 · ${state.player?.name ?? "未命名"}`,
    updatedAt: Date.now(),
    auto: true,
    state: withPrivate(state),
  });
}

/** 功能注释：清空作者预览测试存档（槽位 + 私有键），不影响正式玩家存档 */
export async function clearAuthorPreviewSave(gameId: string): Promise<void> {
  await deleteSlot(AUTHOR_PREVIEW_AUTO_SLOT);
  purgeSaveData(gameId);
}

/* 存入 / 覆盖一个手动槽（受 MAX_SLOTS 约束由 UI 层控制） */
export async function saveToSlot(id: string, state: GameState, name?: string): Promise<boolean> {
  // 作者预览禁止写入正式手动槽，一律落测试自动档
  if (isAuthorPreview()) return writeAutosave(state);
  // 覆盖：整槽替换（名称随新进度刷新，除非显式传入）
  return writeAndSync({
    id,
    name: name ?? `${state.player?.name ?? "存档"} · ${state.world?.time || "序章"}`,
    updatedAt: Date.now(),
    state: withPrivate(state),
  });
}
/* 随档附上该存档的私有数据快照（购买记录、App 缓存等），读档时恢复 */
const withPrivate = (state: GameState): GameState => ({ ...state, privateData: exportSaveData(state.id) });

/* 读取单个槽 */
export async function getSlot(id: string): Promise<SaveSlot | null> {
  return guard(
    "getSlot",
    async () => (await gameSaveDB.getItem<SaveSlot>(slotKey(id))) ?? (await gameSaveDB.getItem<SaveSlot>(legacyKey(id))) ?? null,
    null,
  );
}

/* 删除一个槽 */
export async function deleteSlot(id: string): Promise<boolean> {
  return guard(
    "deleteSlot",
    async () => {
      const gone = (await getSlot(id))?.state?.id;
      await gameSaveDB.removeItem(slotKey(id));
      await gameSaveDB.removeItem(legacyKey(id));
      const gameId = currentSaveGameId();
      if (!isPreviewSlotId(id) && !cloudOffReason(gameId, isAuthorPreview())) void cloudDelete(gameId, id).catch(() => undefined);
      // 该局已无任何存档位（含自动存档）且不在游玩中 → 清理它残留的私有数据，释放本地空间
      if (gone && gone !== getCurrentSaveId() && !(await listSaves()).some((x) => x.state?.id === gone)) purgeSaveData(gone);
      return true;
    },
    false,
  );
}

/* 重命名一个槽（仅改显示名，不动 state） */
export async function renameSlot(id: string, name: string): Promise<boolean> {
  const slot = await getSlot(id);
  if (!slot) return false;
  const next = { ...slot, name: name.trim() || slot.name };
  const ok = await writeSlot(next);
  const gameId = currentSaveGameId();
  if (ok && !isPreviewSlotId(id) && !cloudOffReason(gameId, isAuthorPreview())) void cloudRename(gameId, id, next.name).catch(() => undefined);
  return ok;
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

/** 丢弃尚未落库的防抖自动存档（读档 / 开新局时，避免旧局状态覆盖新进度）。 */
export function cancelAutosave(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = null;
  pendingState = null;
}

/** 立即把待写入的自动存档刷盘（如退出前 / 手动存档时调用）。 */
export async function flushAutosave(): Promise<boolean> {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  const s = pendingState;
  pendingState = null;
  const ok = s ? await writeAutosave(s) : true;
  void flushCloudPushes();
  return ok;
}

/** 功能注释：打开存档列表前调用——把云端比本机新的存档拉回本机（换设备继续玩） */
export async function syncCloudSaves(): Promise<number> {
  const gameId = currentSaveGameId();
  const local = new Map((await listSaves()).filter((s) => s.gameId === gameId).map((s) => [s.id, s.updatedAt] as const));
  return pullCloudSaves(gameId, isAuthorPreview(), local, (slot) =>
    writeSlot({ ...(slot as SaveSlot), gameId, auto: slot.id === AUTO_SLOT_ID || slot.auto }),
  );
}

/* ───────────── 旧版 localStorage 存档一次性迁移 ───────────── */
const LEGACY_KEY = "xh_saves";
let migrated = false;
export async function migrateLegacySaves(): Promise<void> {
  if (migrated) return;
  migrated = true;
  try {
    const old = loadGlobal<SaveSlot[] | null>(LEGACY_KEY, null); // 存档列表 = 全局公共数据
    if (!old) return;
    if (!Array.isArray(old) || old.length === 0) return;
    const existing = await listSaves();
    const have = new Set(existing.map((s) => s.id));
    for (const s of old) {
      if (s && s.id && !have.has(s.id)) await writeSlot({ ...s, updatedAt: s.updatedAt ?? Date.now() });
    }
    removeGlobal(LEGACY_KEY); // 迁移完成即清理，避免重复导入
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

/* ───────────── 时间线检查点（主线复盘 / 平行分支） ─────────────
 * 键 cp:<saveId>:<cpId>，值不带顶层 id 字段，不会混进存档列表。每个存档只保留最近 CHECKPOINT_MAX 个。 */
export const CHECKPOINT_MAX = 40;
type Checkpoint = { sid: string; cid: string; ts: number; state: GameState };
const cpKey = (sid: string, cid: string) => `cp:${sid}:${cid}`;
export async function writeCheckpoint(cid: string, state: GameState): Promise<boolean> {
  return guard("writeCheckpoint", async () => {
    await gameSaveDB.setItem<Checkpoint>(cpKey(state.id, cid), { sid: state.id, cid, ts: Date.now(), state: withPrivate(state) });
    const mine = (await gameSaveDB.keys()).filter((k) => k.startsWith(`cp:${state.id}:`));
    if (mine.length > CHECKPOINT_MAX) {
      const metas: { k: string; ts: number }[] = [];
      for (const k of mine) { const v = await gameSaveDB.getItem<Checkpoint>(k); metas.push({ k, ts: v?.ts ?? 0 }); }
      metas.sort((a, b) => a.ts - b.ts);
      for (const m of metas.slice(0, metas.length - CHECKPOINT_MAX)) await gameSaveDB.removeItem(m.k);
    }
    return true;
  }, false);
}
export async function getCheckpoint(sid: string, cid: string): Promise<GameState | null> {
  return guard("getCheckpoint", async () => (await gameSaveDB.getItem<Checkpoint>(cpKey(sid, cid)))?.state ?? null, null);
}
export async function listCheckpointIds(sid: string): Promise<Set<string>> {
  return guard("listCheckpointIds", async () => new Set((await gameSaveDB.keys()).filter((k) => k.startsWith(`cp:${sid}:`)).map((k) => k.slice(`cp:${sid}:`.length))), new Set<string>());
}
