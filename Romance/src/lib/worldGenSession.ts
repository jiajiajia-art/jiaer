/**
 * 生成世界向导会话：按「登录用户 + 平台作品 draftId」隔离持久化。
 * 生成完成进入编辑器后刷新须直接回到编辑器（带已生成基线），不得丢回重新生成表单。
 * 大体积 mod 双写 IndexedDB，避免 localStorage 配额把生成结果悄悄丢掉。
 * trim 崩页恢复仍强制 step1；仅用户主动离开/放弃时清除会话。
 */
import localforage from "localforage";
import { loadGlobal, removeGlobal, saveGlobal } from "./saveScope.ts";
import type { Mod } from "../mods/types.ts";
import type { WorldGenDraft, WorldGenStep1 } from "./worldGenWizard.ts";
import { WORLD_GEN_QUERY, defaultWorldGenStep1, normalizeWorldGenStep1 } from "./worldGenWizard.ts";
import { sanitizeModStrings } from "./sanitizeModStrings.ts";
import { readFunloomUserId } from "./platformAvatarLibrary.ts";

/** 功能注释：v2 起默认只勾基础世界模组；丢弃 v1 全选 59 项的残留会话 */
export const WORLD_GEN_SESSION_KEY = "star:worldGenSession.v2";
export const WORLD_GEN_SESSION_KEY_LEGACY = "star:worldGenSession.v1";
/** 功能注释：trim 崩页恢复中禁止把内存脏 mod 再写回 localStorage（防 beforeunload / 定时 persist 回写） */
export const WORLD_GEN_PERSIST_BLOCK_KEY = "star:wgPersistBlock";
/** 功能注释：本标签页刚做完 trim 恢复；加载会话时强制 step1，禁止再进编辑器死循环 */
export const WORLD_GEN_TRIM_RECOVER_KEY = "star:wgTrimRecover";

/** 功能注释：大体积会话走独立 IDB，与局内存档库隔离 */
const wgSessionDB = localforage.createInstance({
  name: "romanceWorldGenSessionDB",
  storeName: "sessions",
  description: "生成世界向导会话 · 按用户按作品",
});

/** 功能注释：书架「继续编辑」带 resume=1，须直接进已有内容而非重新生成入口 */
export function wantsResumeEditor(
  search = typeof location !== "undefined" ? location.search : "",
): boolean {
  try {
    return new URLSearchParams(search).get("resume") === "1";
  } catch {
    return false;
  }
}

/**
 * 功能注释：会话键 = 用户 + 作品 draftId。
 * 兼容旧键（仅 draftId / 无用户）读取迁移，避免刷新后「像丢了」。
 */
export function worldGenSessionKey(
  search = typeof location !== "undefined" ? location.search : "",
  userId = readFunloomUserId(),
): string {
  const draftId = new URLSearchParams(search).get("draftId")?.trim() || "";
  const uid = String(userId || "").trim();
  if (uid && draftId) return `${WORLD_GEN_SESSION_KEY}.u.${uid}.d.${draftId}`;
  if (draftId) return `${WORLD_GEN_SESSION_KEY}.${draftId}`;
  if (uid) return `${WORLD_GEN_SESSION_KEY}.u.${uid}`;
  return WORLD_GEN_SESSION_KEY;
}

/** 功能注释：读盘时按优先级尝试的键列表（新→旧），写盘只用权威键 */
export function worldGenSessionKeyCandidates(
  search = typeof location !== "undefined" ? location.search : "",
): string[] {
  const draftId = new URLSearchParams(search).get("draftId")?.trim() || "";
  const uid = readFunloomUserId();
  const keys: string[] = [];
  const push = (k: string) => {
    if (k && !keys.includes(k)) keys.push(k);
  };
  push(worldGenSessionKey(search, uid));
  if (draftId) push(`${WORLD_GEN_SESSION_KEY}.${draftId}`);
  if (uid) push(`${WORLD_GEN_SESSION_KEY}.u.${uid}`);
  push(WORLD_GEN_SESSION_KEY);
  return keys;
}

export type WorldGenSession = {
  step: 1 | 2;
  s1: WorldGenStep1;
  draft: WorldGenDraft | null;
  mod: Mod | null;
  /** 窗口滚动位置（编辑器外层） */
  scrollY: number;
  /** 编辑器分区（①基础…） */
  editorGroup?: string;
  /** 编辑器内容区内部滚动（若有） */
  editorScrollY?: number;
  updatedAt: number;
  /** 功能注释：localStorage 只写轻量 stub 时标记，完整 mod 在 IDB */
  heavyInIdb?: boolean;
};

/** 功能注释：恢复期挡住向导 persist，避免清会话后又被写回脏编辑器状态 */
export function blockWorldGenPersist(): void {
  try {
    sessionStorage.setItem(WORLD_GEN_PERSIST_BLOCK_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function clearWorldGenPersistBlock(): void {
  try {
    sessionStorage.removeItem(WORLD_GEN_PERSIST_BLOCK_KEY);
  } catch {
    /* ignore */
  }
}

export function isWorldGenPersistBlocked(): boolean {
  try {
    return sessionStorage.getItem(WORLD_GEN_PERSIST_BLOCK_KEY) === "1";
  } catch {
    return false;
  }
}

export function markWorldGenTrimRecover(): void {
  try {
    sessionStorage.setItem(WORLD_GEN_TRIM_RECOVER_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function clearWorldGenTrimRecover(): void {
  try {
    sessionStorage.removeItem(WORLD_GEN_TRIM_RECOVER_KEY);
  } catch {
    /* ignore */
  }
}

export function isWorldGenTrimRecovering(): boolean {
  try {
    return sessionStorage.getItem(WORLD_GEN_TRIM_RECOVER_KEY) === "1";
  } catch {
    return false;
  }
}

/** 功能注释：有基线或 IDB 待补齐时，step=2 保持编辑器；trim 恢复例外 */
export function resolveSessionStep(rawStep: 1 | 2, hasBaseline: boolean, heavyPending = false): 1 | 2 {
  if (isWorldGenTrimRecovering()) return 1;
  if (rawStep === 2 && (hasBaseline || heavyPending)) return 2;
  return 1;
}

function lightStub(session: WorldGenSession): WorldGenSession {
  return {
    step: session.step,
    s1: session.s1,
    draft: null,
    mod: null,
    scrollY: 0,
    editorGroup: undefined,
    editorScrollY: undefined,
    updatedAt: session.updatedAt,
    heavyInIdb: true,
  };
}

async function idbPut(key: string, session: WorldGenSession): Promise<boolean> {
  try {
    await wgSessionDB.setItem(key, { ...session, updatedAt: session.updatedAt || Date.now() });
    return true;
  } catch {
    return false;
  }
}

async function idbGet(key: string): Promise<WorldGenSession | null> {
  try {
    const raw = await wgSessionDB.getItem<unknown>(key);
    return parseWorldGenSession(raw);
  } catch {
    return null;
  }
}

async function idbRemove(key: string): Promise<void> {
  try {
    await wgSessionDB.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** 功能注释：丢掉脏 mod/draft，保留作品名与设定，强制回第 1 步 */
export function demoteWorldGenSessionToStep1(s1?: WorldGenStep1 | null): void {
  blockWorldGenPersist();
  markWorldGenTrimRecover();
  const safeS1 = normalizeWorldGenStep1(s1 && typeof s1 === "object" ? s1 : defaultWorldGenStep1());
  const next: WorldGenSession = {
    step: 1,
    s1: safeS1,
    draft: null,
    mod: null,
    scrollY: 0,
    editorGroup: "base",
    updatedAt: Date.now(),
  };
  const key = worldGenSessionKey();
  saveGlobal(key, next);
  void idbPut(key, next);
}

/** 功能注释：校验会话结构，坏数据当无会话；mod 深度清洗防 .trim 崩页 */
export function parseWorldGenSession(raw: unknown): WorldGenSession | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Partial<WorldGenSession>;
  if (s.step !== 1 && s.step !== 2) return null;
  if (!s.s1 || typeof s.s1 !== "object") return null;
  if (typeof s.s1.title !== "string" || typeof s.s1.setting !== "string") return null;
  if (!Array.isArray(s.s1.editorStepIds)) return null;
  if (isWorldGenTrimRecovering()) {
    return {
      step: 1,
      s1: normalizeWorldGenStep1(s.s1),
      draft: null,
      mod: null,
      scrollY: 0,
      editorGroup: "base",
      updatedAt: typeof s.updatedAt === "number" ? s.updatedAt : Date.now(),
    };
  }
  let mod: Mod | null = (s.mod as Mod | null) ?? null;
  if (mod && typeof mod === "object") {
    try {
      mod = sanitizeModStrings(mod);
    } catch {
      mod = null;
    }
  } else {
    mod = null;
  }
  const hasBaseline = !!mod && !!s.draft;
  const draft = hasBaseline ? ((s.draft as WorldGenDraft | null) ?? null) : null;
  const safeMod = hasBaseline ? mod : null;
  const heavyPending = s.heavyInIdb === true && !hasBaseline;
  return {
    step: resolveSessionStep(s.step, hasBaseline, heavyPending),
    s1: s.s1,
    draft,
    mod: safeMod,
    scrollY: 0,
    editorGroup: undefined,
    editorScrollY: undefined,
    updatedAt: typeof s.updatedAt === "number" ? s.updatedAt : Date.now(),
    heavyInIdb: heavyPending || undefined,
  };
}

function readRawFromCandidates(): { key: string; raw: unknown } | null {
  for (const key of worldGenSessionKeyCandidates()) {
    const raw = loadGlobal<unknown>(key, null);
    if (raw != null) return { key, raw };
  }
  return null;
}

export function loadWorldGenSession(): WorldGenSession | null {
  const hit = readRawFromCandidates();
  if (hit) {
    const cur = parseWorldGenSession(hit.raw);
    if (cur) {
      const authKey = worldGenSessionKey();
      if (hit.key !== authKey) {
        saveGlobal(authKey, cur);
        void idbGet(hit.key).then((full) => {
          if (full?.mod && full?.draft) void idbPut(authKey, full);
        });
      }
      return cur;
    }
  }
  try {
    removeGlobal(WORLD_GEN_SESSION_KEY_LEGACY);
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * 功能注释：异步补齐 IDB 里的完整 mod/draft。
 * localStorage 配额失败或只写了 stub 时，刷新仍能恢复生成完成态。
 */
export async function loadWorldGenSessionAsync(): Promise<WorldGenSession | null> {
  const sync = loadWorldGenSession();
  if (sync?.mod && sync?.draft) return sync;
  for (const key of worldGenSessionKeyCandidates()) {
    const full = await idbGet(key);
    if (full?.mod && full?.draft) {
      const authKey = worldGenSessionKey();
      const stamped = { ...full, updatedAt: Math.max(full.updatedAt, sync?.updatedAt ?? 0) };
      if (!saveGlobal(authKey, stamped)) {
        saveGlobal(authKey, lightStub(stamped));
      }
      await idbPut(authKey, stamped);
      return stamped;
    }
  }
  return sync;
}

export function saveWorldGenSession(session: WorldGenSession): boolean {
  if (isWorldGenPersistBlocked() || isWorldGenTrimRecovering()) {
    if (session.step === 2 || session.mod || session.draft) return false;
  }
  const key = worldGenSessionKey();
  const stamped: WorldGenSession = { ...session, updatedAt: Date.now(), heavyInIdb: undefined };
  const ok = saveGlobal(key, stamped);
  void idbPut(key, stamped);
  if (!ok && (stamped.mod || stamped.draft || stamped.step === 2)) {
    saveGlobal(key, lightStub(stamped));
    return true;
  }
  return ok;
}

export function clearWorldGenSession(): void {
  blockWorldGenPersist();
  markWorldGenTrimRecover();
  for (const key of worldGenSessionKeyCandidates()) {
    removeGlobal(key);
    void idbRemove(key);
  }
  try {
    removeGlobal(WORLD_GEN_SESSION_KEY_LEGACY);
  } catch {
    /* ignore */
  }
}

/** 功能注释：有未完成向导会话时，刷新后应重新打开向导而非游戏 */
export function shouldResumeWorldGenSession(): boolean {
  const s = loadWorldGenSession();
  if (!s) return false;
  if (Date.now() - s.updatedAt > 7 * 24 * 60 * 60 * 1000) {
    clearWorldGenSession();
    return false;
  }
  return true;
}

/** 功能注释：向导打开期间把 createWorld 写回 URL，刷新仍能识别入口 */
export function ensureWorldGenQuery(): void {
  if (typeof location === "undefined" || typeof history === "undefined") return;
  try {
    const url = new URL(location.href);
    if (url.searchParams.get(WORLD_GEN_QUERY) === "1") return;
    url.searchParams.set(WORLD_GEN_QUERY, "1");
    history.replaceState(history.state, "", `${url.pathname}${url.search}${url.hash}`);
  } catch {
    /* ignore */
  }
}
