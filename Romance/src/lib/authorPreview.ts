/**
 * 作者预览：用编辑器当前草稿启动完整游玩流程；独立测试存档，不写正式自动存档 / 排行。
 * 通过事件与 registry 内存叠加层配合；退出后恢复生效模组组合。
 */
import type { Mod } from "../mods/types";

export const AUTHOR_PREVIEW_GAME_ID = "__author_preview_game__";
export const AUTHOR_PREVIEW_AUTO_SLOT = "__author_preview_autosave__";
export const AUTHOR_PREVIEW_START = "star:author-preview-start";
export const AUTHOR_PREVIEW_END = "star:author-preview-end";
export const AUTHOR_PREVIEW_CLEAR = "star:author-preview-clear-save";
export const AUTHOR_PREVIEW_RESTART = "star:author-preview-restart";

export type AuthorPreviewSession = {
  mod: Mod;
  warnings: string[];
  scrollY: number;
  startedAt: number;
};

let session: AuthorPreviewSession | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* ignore */
    }
  });
}

export function subscribeAuthorPreview(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function getAuthorPreviewSession() {
  return session;
}

export function isAuthorPreview() {
  return !!session;
}

/** 功能注释：进入预览前记录草稿与滚动；由 GameProvider 切屏并激活 registry 叠加 */
export function requestAuthorPreview(mod: Mod, warnings: string[], scrollY = 0) {
  session = {
    mod: structuredClone(mod),
    warnings: [...warnings],
    scrollY,
    startedAt: Date.now(),
  };
  emit();
  window.dispatchEvent(
    new CustomEvent(AUTHOR_PREVIEW_START, { detail: session }),
  );
}

/** 退出预览后，模组管理页可取回草稿并重新打开编辑器（向导路径则靠隐藏挂载恢复） */
let reopenEditorMod: Mod | null = null;

export function takeReopenEditorMod(): Mod | null {
  const m = reopenEditorMod;
  reopenEditorMod = null;
  return m;
}

export function requestAuthorPreviewEnd() {
  const prev = session;
  if (prev?.mod) reopenEditorMod = structuredClone(prev.mod);
  session = null;
  emit();
  window.dispatchEvent(
    new CustomEvent(AUTHOR_PREVIEW_END, { detail: prev }),
  );
  return prev;
}

export function requestAuthorPreviewClearSave() {
  window.dispatchEvent(new CustomEvent(AUTHOR_PREVIEW_CLEAR));
}

export function requestAuthorPreviewRestart() {
  window.dispatchEvent(new CustomEvent(AUTHOR_PREVIEW_RESTART));
}

/** 功能注释：预览前软校验——缺项进警告列表仍可进；致命项阻断启动 */
export function assessAuthorPreview(mod: Mod): { fatal: string[]; warnings: string[] } {
  const fatal: string[] = [];
  const warnings: string[] = [];
  if (!mod || typeof mod !== "object") {
    fatal.push("模组数据无效");
    return { fatal, warnings };
  }
  if (!String(mod.id || "").trim()) fatal.push("缺少模组 id");
  if (!String(mod.name || "").trim()) warnings.push("未填写模组名称");
  if (mod.kind !== "world" && mod.kind !== "addon") {
    warnings.push("kind 未设为 world/addon，预览将按世界观处理");
  }
  const c = mod.content ?? {};
  if (mod.kind !== "addon") {
    if (!c.rooms || !Object.keys(c.rooms).length) {
      warnings.push("未配置地点 rooms（开局可能落在默认点）");
    } else if (c.startRoom && !(c.startRoom in c.rooms)) {
      fatal.push(`开局地点 startRoom「${c.startRoom}」不在 rooms 中`);
    }
  }
  const npcs = Array.isArray(c.npcs) ? c.npcs : [];
  for (const n of npcs) {
    // 功能注释：AI 脏会话里 name/gender 可能是对象，禁止 ?.trim() 直接调用
    const nm = typeof n?.name === "string" ? n.name.trim() : "";
    const gender = typeof n?.gender === "string" ? n.gender.trim() : "";
    if (!nm) warnings.push(`人物「${n?.id || "?"}」未填名字`);
    if (!(typeof n?.age === "number" && n.age >= 0)) warnings.push(`人物「${nm || n?.id || "?"}」未填年龄`);
    if (!gender) warnings.push(`人物「${nm || n?.id || "?"}」未填性别`);
  }
  if (!c.opening && !c.cover) warnings.push("未配置开局封面 / 序章文案");
  return { fatal, warnings };
}
