import { useEffect, useRef, useState } from "react";
import { loadGlobal, saveGlobal, removeGlobal } from "./saveScope.ts";

/* 编辑器本机草稿：编辑中自动缓存到浏览器（防抖），刷新 / 崩溃 / 误关后再次打开，
 * 若草稿与已保存版本不一致，返回 pending 供界面询问「继续填写草稿 / 从已保存版本开始」。
 * 未点保存的填写只进本机草稿，不写已保存作品；停留位置只记在草稿里，选「继续填写」才恢复。
 * 草稿属于编辑器素材 → 全局数据，不随存档隔离。 */

/** 功能注释：草稿附带的填写位置；仅「继续填写草稿」时恢复，不单独记成作品停留位 */
export type DraftCursor = {
  group?: string;
  scrollY?: number;
};

export type DraftRecord<T> = {
  at: number;
  base: string;
  value: T;
  cursor?: DraftCursor;
};

export const DRAFT_STORAGE_PREFIX = "star2005.draft.";
/** 功能注释：已保存版本的落盘时间，供草稿冲突弹窗与本机草稿时间对照 */
export const SAVED_VERSION_AT_PREFIX = "star2005.savedAt.";

export function draftStorageKey(id: string): string {
  return DRAFT_STORAGE_PREFIX + id;
}

export function savedVersionAtKey(id: string): string {
  return SAVED_VERSION_AT_PREFIX + id;
}

/** 功能注释：读本机记下的「已保存版本」时间；没有则 null（弹窗侧再决定兜底） */
export function readSavedVersionAt(id: string): number | null {
  const raw = loadGlobal<{ at?: unknown } | number | null>(savedVersionAtKey(id), null);
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
  if (raw && typeof raw === "object" && typeof raw.at === "number" && Number.isFinite(raw.at) && raw.at > 0) return raw.at;
  return null;
}

/** 功能注释：点保存 / 生成完成 / 会话基线更新时写入，冲突弹窗用来显示「已保存版本（某月某日…）」 */
export function writeSavedVersionAt(id: string, at = Date.now()): void {
  if (!Number.isFinite(at) || at <= 0) return;
  saveGlobal(savedVersionAtKey(id), { at });
}

/** 功能注释：草稿与已保存 baseline 是否实质相同（相同则不应弹窗） */
export function isDraftSameAsBaseline<T>(draft: DraftRecord<T> | null | undefined, baseline: string): boolean {
  if (!draft || draft.value === undefined) return true;
  try {
    return JSON.stringify(draft.value) === baseline;
  } catch {
    return false;
  }
}

/**
 * 功能注释：读本机未完成草稿；与已保存版本相同则视为无草稿（并顺手清掉脏键）。
 * 供入口在打开表单前先 peek，避免先把人送进上次填写位置。
 */
export function peekDraft<T>(id: string, baseline: string): DraftRecord<T> | null {
  const key = draftStorageKey(id);
  const d = loadGlobal<DraftRecord<T> | null>(key, null);
  if (!d || d.value === undefined) return null;
  if (isDraftSameAsBaseline(d, baseline)) {
    removeGlobal(key);
    return null;
  }
  return d;
}

export function discardDraftById(id: string): void {
  removeGlobal(draftStorageKey(id));
}

/**
 * @param cursor 当前分区/滚动；脏写草稿时一并记下，供「继续填写草稿」还原位置
 */
export function useDraft<T>(id: string, value: T, baseline: string, dirty: boolean, cursor?: DraftCursor) {
  const key = draftStorageKey(id);
  const [pending, setPending] = useState<DraftRecord<T> | null>(() => peekDraft<T>(id, baseline));
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cursorRef = useRef(cursor);
  cursorRef.current = cursor;

  // 有改动且未在询问恢复时，800ms 防抖写入草稿；改回与已保存一致则清掉草稿
  useEffect(() => {
    if (pending) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (dirty) {
        const at = Date.now();
        const cur = cursorRef.current;
        const row: DraftRecord<T> = {
          at,
          base: baseline,
          value,
          ...(cur && (cur.group || typeof cur.scrollY === "number") ? { cursor: { ...cur } } : {}),
        };
        if (saveGlobal(key, row)) setSavedAt(at);
      } else {
        removeGlobal(key);
        setSavedAt(null);
      }
    }, 800);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [key, value, baseline, dirty, pending, cursor?.group, cursor?.scrollY]);

  // 有未保存改动时关闭 / 刷新页面，浏览器先提醒一次
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  return {
    pending,
    /** 草稿生成后，已保存版本又被别处改过（草稿基于旧版本） */
    stale: !!pending && pending.base !== baseline,
    savedAt,
    restore: () => {
      const row = pending;
      setPending(null);
      return row ? { value: row.value, cursor: row.cursor } : null;
    },
    discard: () => {
      removeGlobal(key);
      setPending(null);
    },
    clear: () => {
      if (timer.current) clearTimeout(timer.current);
      removeGlobal(key);
      setSavedAt(null);
    },
  };
}

/** 功能注释：草稿/已保存时间统一格式——今天用「今天 HH:MM」，否则「M月D日 HH:MM」 */
export const fmtDraftTime = (t: number) => {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, "0");
  const today = new Date().toDateString() === d.toDateString();
  return `${today ? "今天" : `${d.getMonth() + 1}月${d.getDate()}日`} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/**
 * 功能注释：冲突弹窗里「已保存版本」的时间。
 * 优先用本机记下的保存时刻；没有则用会话/上层传入的兜底；再没有则不编造。
 */
export function resolveSavedVersionAt(draftId: string, fallbackAt?: number | null): number | null {
  return readSavedVersionAt(draftId) ?? (typeof fallbackAt === "number" && fallbackAt > 0 ? fallbackAt : null);
}
