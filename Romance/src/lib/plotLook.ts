import type { ThemePref } from "./store";
import type { FixedCond } from "./types";
import type { GameState as SimState } from "../game/logic";
import { condsMet } from "../game/fixedEvents";

/* 剧情美化：满足条件时临时覆盖外观（不改玩家保存的设置，条件不再满足即自动恢复）。
 * 叠加顺序：玩家设置 → 世界作者的规则 → 玩家自己的规则 → 编辑器「试看」；同层列表靠后者优先。 */
export const LOOK_KEYS = ["mode", "accent", "skin", "font", "topbar", "topbarText", "dialogStyle", "bubbleStyle", "sceneBg", "sceneDim", "sceneBlur", "sceneTone", "portrait"] as const;
export type LookPatch = Partial<Pick<ThemePref, (typeof LOOK_KEYS)[number]>> & {
  tint?: string; // 主色覆盖（任意颜色）
  css?: string; // 条件 CSS：仅在规则生效时注入
};
export type LookRule = {
  id: string;
  name: string;
  enabled?: boolean; // 缺省开启
  match?: "all" | "any"; // 缺省 all
  conds: FixedCond[];
  look: LookPatch;
};

export const lookActive = (r: LookRule, sim?: SimState | null) =>
  !!sim && r.enabled !== false && !!r.conds?.length && condsMet(r.conds, sim, r.match);

function patchTheme(t: ThemePref, p: LookPatch): ThemePref {
  const out: ThemePref = { ...t };
  for (const k of LOOK_KEYS) if (p[k] !== undefined && p[k] !== "") (out as Record<string, unknown>)[k] = p[k];
  if (p.tint) {
    const f = t.free && t.free.on !== false ? t.free : { on: true };
    out.free = { ...f, on: true, colors: { ...(f.colors ?? {}), jade: p.tint } };
  }
  return out;
}

/* 此刻生效规则的指纹：只有生效集合变化时才重算外观，避免每回合重写样式 */
export function activeLookKey(theme: ThemePref, sim: SimState | null | undefined, worldRules: LookRule[] | undefined): string {
  const w = theme.plotLook !== false ? (worldRules ?? []).filter((r) => lookActive(r, sim)).map((r) => r.id) : [];
  const m = (theme.lookRules ?? []).filter((r) => lookActive(r, sim)).map((r) => r.id);
  return `${w.join(",")}|${m.join(",")}`;
}

export type LookResult = { look: ThemePref; active: { rule: LookRule; source: "world" | "mine" }[]; css: string };

export function resolveLook(theme: ThemePref, sim: SimState | null | undefined, worldRules: LookRule[] | undefined, preview?: LookPatch | null): LookResult {
  const active: LookResult["active"] = [];
  if (theme.plotLook !== false) for (const r of worldRules ?? []) if (lookActive(r, sim)) active.push({ rule: r, source: "world" });
  for (const r of theme.lookRules ?? []) if (lookActive(r, sim)) active.push({ rule: r, source: "mine" });
  let look = theme;
  const css: string[] = [];
  for (const { rule } of active) { look = patchTheme(look, rule.look ?? {}); if (rule.look?.css?.trim()) css.push(rule.look.css); }
  if (preview) { look = patchTheme(look, preview); if (preview.css?.trim()) css.push(preview.css); }
  return { look, active, css: css.join("\n") };
}

/* 条件 CSS 放在自由美化之后、玩家自定义 CSS 之前 */
export function applyLookCss(css: string) {
  if (typeof document === "undefined") return;
  let el = document.getElementById("look-css") as HTMLStyleElement | null;
  if (!el) { el = document.createElement("style"); el.id = "look-css"; document.head.appendChild(el); }
  if (el.textContent !== css) el.textContent = css;
  const user = document.getElementById("user-css");
  if (user && el.compareDocumentPosition(user) & Node.DOCUMENT_POSITION_PRECEDING) document.head.appendChild(user);
}

/* 补丁一览（编辑器卡片 / 生效提示用） */
const L: Record<string, Record<string, string>> = {
  mode: { auto: "跟随系统", light: "浅色", dark: "深色" },
  skin: { dream: "梦幻星紫", bloody: "血腥玛丽", cute: "可爱奢华", glass: "毛玻璃", paper: "古朴宣纸" },
  accent: { fuchsia: "星紫", plum: "酒红", rose: "蜜桃", gold: "流金", cyan: "海蓝", jade: "墨绿", coral: "朱红", ink: "黛黑" },
  font: { song: "宋体", round: "圆体", elegant: "雅致", brush: "毛笔" },
  sceneTone: { none: "原色", warm: "暖阳", cool: "清冷", dusk: "黄昏", vintage: "旧胶片", mono: "黑白" },
  dialogStyle: { soft: "柔光卡片", avg: "AVG 对话条", letter: "信笺", glass: "磨砂玻璃", minimal: "极简" },
  bubbleStyle: { frost: "磨砂气泡", solid: "实色气泡", outline: "描边气泡", comic: "漫画气泡", plain: "无框气泡" },
  topbar: { gradient: "流光顶栏", aurora: "极光顶栏", plain: "纯色顶栏" },
  portrait: { side: "立绘模式", stage: "立绘模式", off: "纯文字模式" },
};
export function lookSummary(p: LookPatch): string[] {
  const o: string[] = [];
  for (const k of ["mode", "skin", "accent", "font", "sceneTone", "dialogStyle", "bubbleStyle", "topbar", "portrait"] as const) if (p[k]) o.push(L[k][p[k] as string] ?? String(p[k]));
  if (p.tint) o.push("主色自定");
  if (p.sceneBg) o.push("换场景图");
  if (p.sceneDim != null) o.push(`遮罩 ${p.sceneDim}%`);
  if (p.sceneBlur) o.push(`模糊 ${p.sceneBlur}px`);
  if (p.topbarText) o.push(`标语「${p.topbarText}」`);
  if (p.css?.trim()) o.push("条件 CSS");
  return o;
}
