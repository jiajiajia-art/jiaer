/* 绿信设置：持久化到 localStorage，跨组件订阅同步 */
import { loadGlobal, saveGlobal } from "../../lib/saveScope";
import { useSyncExternalStore } from "react";

export type WxFont = "small" | "standard" | "large" | "xlarge";
/* 聊天样式（全局默认；单个会话里设过的气泡 / 背景优先） */
export type WxChatStyle = {
  bubble: string; // 预设 id
  radius: number; // 气泡圆角 px
  border: boolean; borderColor: string; // 描边
  meColor: string; themColor: string; // 自定义底色（空 = 用预设）
  meText: string; themText: string; // 自定义文字色（空 = 用预设）
  alpha: number; // 自定义底色不透明度 0~100
  avatarRadius: number; // 头像圆角 px（20 = 圆形）
  chatBg: string; // 默认聊天背景：预设 id 或 data: 图片
};
export const WX_CHAT_DEFAULT: WxChatStyle = { bubble: "classic", radius: 4, border: false, borderColor: "#8fa8cc", meColor: "", themColor: "", meText: "", themText: "", alpha: 100, avatarRadius: 4, chatBg: "" };
export type WxSettings = { notify: boolean; momentsPush: boolean; enterSend: boolean; font: WxFont; proactive: boolean; status: string; chat: WxChatStyle };

const KEY = "star2005.wx.settings";
const DEFAULTS: WxSettings = { notify: true, momentsPush: true, enterSend: true, font: "standard", proactive: true, status: "", chat: WX_CHAT_DEFAULT };
export const WX_FONT_LABEL: Record<WxFont, string> = { small: "小", standard: "标准", large: "大", xlarge: "特大" };
export const WX_FONT_PX: Record<WxFont, number> = { small: 14, standard: 16, large: 17.5, xlarge: 19.5 };
export const WX_FONT_ORDER: WxFont[] = ["small", "standard", "large", "xlarge"];

function load(): WxSettings {
  try {
    const j = loadGlobal<any>(KEY, null); // 绿信外观设置 = 全局 UI 设置
    if (!j || typeof j !== "object") return DEFAULTS;
    return { ...DEFAULTS, ...j, chat: { ...WX_CHAT_DEFAULT, ...(j.chat ?? {}) } };
  } catch {
    return DEFAULTS;
  }
}

let current = load();
const subs = new Set<() => void>();

export function setWxSettings(patch: Partial<WxSettings>) {
  current = { ...current, ...patch };
  saveGlobal(KEY, current);
  subs.forEach((f) => f());
}

export const setWxChat = (p: Partial<WxChatStyle>) => setWxSettings({ chat: { ...current.chat, ...p } });
/** 十六进制色 + 不透明度 → rgba */
export function withAlpha(hex: string, a: number): string {
  const m = hex.replace("#", "").match(/^([0-9a-f]{6})$/i);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(100, a)) / 100})`;
}

export function useWxSettings(): WxSettings {
  return useSyncExternalStore(
    (f) => { subs.add(f); return () => { subs.delete(f); }; },
    () => current,
  );
}
