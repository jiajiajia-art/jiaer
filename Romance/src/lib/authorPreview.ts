/**
 * 作者预览：用编辑器当前草稿启动完整游玩流程；独立测试存档，不写正式自动存档 / 排行。
 * 通过事件与 registry 内存叠加层配合；退出后恢复生效模组组合。
 */
import type { Mod } from "../mods/types";
import {
  markAuthorPreviewBooting,
  markAuthorPreviewFailed,
  resetAuthorPreviewBoot,
} from "./authorPreviewBoot.ts";

export const AUTHOR_PREVIEW_GAME_ID = "__author_preview_game__";
export const AUTHOR_PREVIEW_AUTO_SLOT = "__author_preview_autosave__";
export const AUTHOR_PREVIEW_START = "star:author-preview-start";
export const AUTHOR_PREVIEW_END = "star:author-preview-end";
export const AUTHOR_PREVIEW_CLEAR = "star:author-preview-clear-save";
export const AUTHOR_PREVIEW_RESTART = "star:author-preview-restart";
export const AUTHOR_PREVIEW_FATAL = "star:author-preview-fatal";

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
  // 功能注释：先标 booting，避免 PlayScreens 尚未挂上时中间静默空白
  markAuthorPreviewBooting();
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

/** 功能注释：启动失败时在预览壳内展示原因；编辑器若仍挂载也可同步收到 */
export function reportAuthorPreviewFatal(errors: string[]) {
  const list = (errors || []).map((e) => String(e || "").trim()).filter(Boolean);
  markAuthorPreviewFailed(list);
  window.dispatchEvent(
    new CustomEvent(AUTHOR_PREVIEW_FATAL, { detail: { errors: list } }),
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
  resetAuthorPreviewBoot();
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

export type AuthorRequiredField =
  | "name"
  | "scriptTone"
  | "startDate"
  | "startMoney"
  | "rooms"
  | "startRoom"
  | "cover"
  | "opening";

export type AuthorRequiredIssue = {
  field: AuthorRequiredField;
  label: string;
  group: "base" | "grow" | "look";
  target: string;
};

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const START_DATE_RE = /^\d{4}[-./]\d{2}[-./]\d{2}$/;

/** 功能注释：作品展示封面须有背景图/视频；账号皮肤与文字装饰不算完成。 */
function hasOwnCover(mod: Mod): boolean {
  if (text(mod.cover)) return true;
  const cover = mod.content?.cover;
  if (!cover || typeof cover !== "object") return false;
  return !!(
    text(cover.image)
    || text(cover.video)
    || (Array.isArray(cover.cgs) && cover.cgs.some(text))
  );
}

/** 功能注释：开场只认自定义开场页或作者写的开场白正文，标题/图片等装饰不能单独算完成。 */
function hasOpeningCopy(mod: Mod): boolean {
  const opening = mod.content?.opening;
  if (!opening || typeof opening !== "object") return false;
  return !!(
    text(opening.page)
    || text(opening.html)
    || (Array.isArray(opening.paragraphs) && opening.paragraphs.some(text))
  );
}

/**
 * 功能注释：作者预览与发布共用唯一必填清单；0 元是有效资金，空值和失效引用均阻断。
 * 旧三栏只把「世界观设定」视为剧本基调正文，避免 GM/口吻占位误判成已填写。
 */
export function assessAuthorRequiredFields(mod: Mod): AuthorRequiredIssue[] {
  if (!mod || typeof mod !== "object" || mod.kind === "addon") return [];
  const c = mod.content ?? {};
  const issues: AuthorRequiredIssue[] = [];
  const add = (issue: AuthorRequiredIssue) => issues.push(issue);
  if (!text(mod.name)) add({ field: "name", label: "作品名称", group: "base", target: "author-field-name" });
  const unifiedTone = text(c.prompt?.scriptTone);
  const legacyWorld = text(c.prompt?.worldIntro);
  if (!unifiedTone && !legacyWorld) add({ field: "scriptTone", label: "剧本基调（或世界观设定）", group: "base", target: "author-field-script-tone" });
  if (!START_DATE_RE.test(text(c.startDate))) add({ field: "startDate", label: "开局日期", group: "base", target: "author-field-start-date" });
  // 功能注释：开局资金在①基础·建角；0 合法；货币名称必填；缺金额或缺名称才拦
  const moneyOk = typeof c.startMoney === "number" && Number.isFinite(c.startMoney) && c.startMoney >= 0;
  const moneyNameOk = !!text(c.moneyLabel);
  if (!moneyOk || !moneyNameOk) {
    add({ field: "startMoney", label: "开局资金", group: "base", target: "author-field-start-money" });
  }
  const rooms = c.rooms && typeof c.rooms === "object" ? c.rooms : {};
  const roomIds = Object.keys(rooms);
  if (!roomIds.length) add({ field: "rooms", label: "地点（至少一处）", group: "base", target: "author-field-rooms" });
  if (!text(c.startRoom) || !(c.startRoom! in rooms)) {
    add({ field: "startRoom", label: "开局地点（勾选「设为开局地点」）", group: "base", target: "author-field-start-room" });
  }
  if (!hasOwnCover(mod)) add({ field: "cover", label: "作品封面（列表 / 详情 / 书架）", group: "base", target: "author-field-cover" });
  if (!hasOpeningCopy(mod)) add({ field: "opening", label: "开场（自定义开场页或开场白）", group: "look", target: "author-field-opening" });
  return issues;
}

/** 功能注释：底层启动错误仍走 fatal；作者必填项由编辑器共用弹窗在启动前一次性阻断。 */
export function assessAuthorPreview(mod: Mod): { fatal: string[]; warnings: string[] } {
  const fatal: string[] = [];
  const warnings: string[] = [];
  if (!mod || typeof mod !== "object") {
    fatal.push("模组数据无效");
    return { fatal, warnings };
  }
  if (!String(mod.id || "").trim()) fatal.push("缺少模组 id");
  // 功能注释：人物、属性、主线、玩法、皮肤、音乐等都不是作者测试/发布门槛，不产生软警告。
  return { fatal, warnings };
}

/** 功能注释：预览壳横幅用——把必填缺口写成短句，生成失败漏项时也不会静默空屏。 */
export function authorPreviewMissingLabels(mod: Mod): string[] {
  return assessAuthorRequiredFields(mod).map((issue) => issue.label);
}
