import { useEffect, useRef, useState } from "react";
import { loadGlobal, saveGlobal, removeGlobal } from "./saveScope";

/* 编辑器本机草稿：编辑中自动缓存到浏览器（防抖），刷新 / 崩溃 / 误关后再次打开，
 * 若草稿与已保存版本不一致，返回 pending 供界面询问「恢复草稿 / 使用已保存版本」。
 * 草稿属于编辑器素材 → 全局数据，不随存档隔离。 */
type Draft<T> = { at: number; base: string; value: T };
const PREFIX = "star2005.draft.";

export function useDraft<T>(id: string, value: T, baseline: string, dirty: boolean) {
  const key = PREFIX + id;
  const [pending, setPending] = useState<Draft<T> | null>(() => {
    const d = loadGlobal<Draft<T> | null>(key, null);
    return d && d.value !== undefined && JSON.stringify(d.value) !== baseline ? d : null;
  });
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 有改动且未在询问恢复时，800ms 防抖写入草稿；改回与已保存一致则清掉草稿
  useEffect(() => {
    if (pending) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (dirty) { const at = Date.now(); if (saveGlobal(key, { at, base: baseline, value })) setSavedAt(at); }
      else { removeGlobal(key); setSavedAt(null); }
    }, 800);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [key, value, baseline, dirty, pending]);

  // 有未保存改动时关闭 / 刷新页面，浏览器先提醒一次
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  return {
    pending,
    /** 草稿生成后，已保存版本又被别处改过（草稿基于旧版本） */
    stale: !!pending && pending.base !== baseline,
    savedAt,
    restore: () => { const v = pending?.value; setPending(null); return v; },
    discard: () => { removeGlobal(key); setPending(null); },
    clear: () => { if (timer.current) clearTimeout(timer.current); removeGlobal(key); setSavedAt(null); },
  };
}

export const fmtDraftTime = (t: number) => {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, "0");
  const today = new Date().toDateString() === d.toDateString();
  return `${today ? "今天" : `${d.getMonth() + 1}月${d.getDate()}日`} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
