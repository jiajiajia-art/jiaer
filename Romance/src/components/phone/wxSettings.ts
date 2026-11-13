/* 绿信设置：持久化到 localStorage，跨组件订阅同步 */
import { loadGlobal, saveGlobal } from "../../lib/saveScope";
import { useSyncExternalStore } from "react";

export type WxFont = "small" | "smaller" | "standard" | "large" | "xlarge";
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
  customCss: string; // 已应用的自定义气泡 CSS（气泡选「自定义」时生效）
  customSlots: string[]; // 自定义 CSS 存档位（3 个）
};
export const WX_CHAT_DEFAULT: WxChatStyle = { bubble: "classic", radius: 4, border: false, borderColor: "#8fa8cc", meColor: "", themColor: "", meText: "", themText: "", alpha: 100, avatarRadius: 4, chatBg: "", customCss: "", customSlots: ["", "", ""] };
export type WxSettings = {
  notify: boolean; momentsPush: boolean; enterSend: boolean; font: WxFont; proactive: boolean; status: string; chat: WxChatStyle;
  pat: boolean; // 拍一拍：双击好友头像拍 TA；关闭后 AI 收不到、界面也不显示拍一拍消息
  groupShowMyName: boolean; // 群聊里自己的消息上方显示名字
  privateShowNames: boolean; // 私聊双方消息上方都显示名字
  bubbleTime: boolean; // 普通 / 引用 / 语音气泡下方显示发送时间
  batchReply: boolean; // 攒几条再回：发送只发出，点左下角羽毛才让对方回复
  builtinStickers: boolean; // 内置表情包（关闭后不能用，AI 也拿不到这些表情）
  customStickerPrompt: boolean; // 把自己添加的表情包提示给 AI
};

const KEY = "star2005.wx.settings";
const DEFAULTS: WxSettings = { notify: true, momentsPush: true, enterSend: true, font: "standard", proactive: true, status: "", chat: WX_CHAT_DEFAULT, pat: true, groupShowMyName: false, privateShowNames: false, bubbleTime: false, batchReply: false, builtinStickers: true, customStickerPrompt: false };
export const WX_FONT_LABEL: Record<WxFont, string> = { small: "小", smaller: "较小", standard: "默认", large: "较大", xlarge: "大" };
export const WX_FONT_PX: Record<WxFont, number> = { small: 13.5, smaller: 15, standard: 16, large: 17.5, xlarge: 19.5 };
export const WX_FONT_ORDER: WxFont[] = ["small", "smaller", "standard", "large", "xlarge"];

function load(): WxSettings {
  try {
    const j = loadGlobal<any>(KEY, null); // 绿信外观设置 = 全局 UI 设置
    if (!j || typeof j !== "object") return DEFAULTS;
    const chat = { ...WX_CHAT_DEFAULT, ...(j.chat ?? {}) };
    if (!Array.isArray(chat.customSlots) || chat.customSlots.length !== 3) chat.customSlots = [0, 1, 2].map((i) => String(chat.customSlots?.[i] ?? ""));
    return { ...DEFAULTS, ...j, font: j.font in WX_FONT_PX ? j.font : "standard", chat };
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

/** 非组件处读当前设置 */
export const getWxSettings = (): WxSettings => current;

export function useWxSettings(): WxSettings {
  return useSyncExternalStore(
    (f) => { subs.add(f); return () => { subs.delete(f); }; },
    () => current,
  );
}
