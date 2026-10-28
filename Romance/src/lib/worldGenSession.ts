/**
 * 生成世界向导会话：刷新后仍停留在向导/编辑器，恢复设定、草稿模组、步骤与滚动位置。
 * 仅在用户主动「上一步离开 / 保存并返回 / 放弃」时清除；禁止刷新后掉进游戏封面。
 */
import { loadGlobal, removeGlobal, saveGlobal } from "./saveScope.ts";
import type { Mod } from "../mods/types.ts";
import type { WorldGenDraft, WorldGenStep1 } from "./worldGenWizard.ts";
import { WORLD_GEN_QUERY, defaultWorldGenStep1, normalizeWorldGenStep1 } from "./worldGenWizard.ts";
import { sanitizeModStrings } from "./sanitizeModStrings.ts";

/** 功能注释：v2 起默认只勾基础世界模组；丢弃 v1 全选 59 项的残留会话 */
export const WORLD_GEN_SESSION_KEY = "star:worldGenSession.v2";
export const WORLD_GEN_SESSION_KEY_LEGACY = "star:worldGenSession.v1";
/** 功能注释：trim 崩页恢复中禁止把内存脏 mod 再写回 localStorage（防 beforeunload / 定时 persist 回写） */
export const WORLD_GEN_PERSIST_BLOCK_KEY = "star:wgPersistBlock";
/** 功能注释：本标签页刚做完 trim 恢复；加载会话时强制 step1，禁止再进编辑器死循环 */
export const WORLD_GEN_TRIM_RECOVER_KEY = "star:wgTrimRecover";

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

/** 功能注释：丢掉脏 mod/draft，保留作品名与设定，强制回第 1 步 */
export function demoteWorldGenSessionToStep1(s1?: WorldGenStep1 | null): void {
  blockWorldGenPersist();
  markWorldGenTrimRecover();
  const safeS1 = normalizeWorldGenStep1(s1 && typeof s1 === "object" ? s1 : defaultWorldGenStep1());
  saveGlobal(WORLD_GEN_SESSION_KEY, {
    step: 1,
    s1: safeS1,
    draft: null,
    mod: null,
    scrollY: 0,
    editorGroup: "base",
    updatedAt: Date.now(),
  } satisfies WorldGenSession);
}

/** 功能注释：校验会话结构，坏数据当无会话，避免刷新进半残状态；mod 同步深度清洗防 .trim 崩页 */
export function parseWorldGenSession(raw: unknown): WorldGenSession | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Partial<WorldGenSession>;
  if (s.step !== 1 && s.step !== 2) return null;
  if (!s.s1 || typeof s.s1 !== "object") return null;
  if (typeof s.s1.title !== "string" || typeof s.s1.setting !== "string") return null;
  if (!Array.isArray(s.s1.editorStepIds)) return null;
  // 功能注释：刚 trim 恢复时无论磁盘写了什么，都只回第 1 步，打断「报错→又进编辑器」循环
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
  const canEditor = s.step === 2 && !!mod && !!s.draft;
  return {
    step: (canEditor ? 2 : 1) as 1 | 2,
    s1: s.s1,
    draft: canEditor ? ((s.draft as WorldGenDraft | null) ?? null) : null,
    mod: canEditor ? mod : null,
    scrollY: typeof s.scrollY === "number" && s.scrollY >= 0 ? s.scrollY : 0,
    editorGroup: typeof s.editorGroup === "string" ? s.editorGroup : undefined,
    editorScrollY: typeof s.editorScrollY === "number" ? s.editorScrollY : undefined,
    updatedAt: typeof s.updatedAt === "number" ? s.updatedAt : Date.now(),
  };
}

export function loadWorldGenSession(): WorldGenSession | null {
  const cur = parseWorldGenSession(loadGlobal<unknown>(WORLD_GEN_SESSION_KEY, null));
  if (cur) return cur;
  // 功能注释：清掉旧版「默认全选全部模组」会话，避免刷新后仍生成 59 项扩展玩法
  try {
    removeGlobal(WORLD_GEN_SESSION_KEY_LEGACY);
  } catch {
    /* ignore */
  }
  return null;
}

export function saveWorldGenSession(session: WorldGenSession): boolean {
  // 功能注释：恢复挡板开启时禁止写回 step2/脏 mod
  if (isWorldGenPersistBlocked() || isWorldGenTrimRecovering()) {
    if (session.step === 2 || session.mod || session.draft) return false;
  }
  return saveGlobal(WORLD_GEN_SESSION_KEY, { ...session, updatedAt: Date.now() });
}

export function clearWorldGenSession(): void {
  blockWorldGenPersist();
  markWorldGenTrimRecover();
  removeGlobal(WORLD_GEN_SESSION_KEY);
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
  // 超过 7 天的残留会话丢弃，避免永久挡游戏
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
