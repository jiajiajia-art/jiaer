import { loadGlobal, saveGlobal } from "./saveScope";
import { buildTopbarCss, type TopbarDiy } from "./topbarDiy";

/* 自由美化（类酒馆）：任意颜色 / 字体文件 / 各部位贴图。
 * 生成一段 <style id="free-style">，放在皮肤之后、用户 CSS 之前；选择器加权以压过皮肤变量。 */
export type FreeImg = { url: string; opacity?: number; fit?: "cover" | "contain" | "repeat" };
export type FreeStyle = {
  on?: boolean;
  colors?: Partial<Record<FreeColorKey, string>>;
  font?: { name: string; url: string };
  imgs?: Partial<Record<FreeSlot, FreeImg>>;
};
export const FREE_COLORS = [
  ["jade", "主色"], ["coral", "辅色"], ["gold", "点缀"], ["paper", "页面底色"], ["paper-2", "卡片底色"], ["ink", "正文字"], ["ink-soft", "次要字"], ["line", "描边"],
] as const;
export type FreeColorKey = (typeof FREE_COLORS)[number][0];
export const FREE_SLOTS = [
  ["page", "全局背景", "整个游戏界面的底图"],
  ["topbar", "顶栏", "顶部状态栏背景"],
  ["dialog", "对话框", "「对话·叙事」面板底图"],
  ["bubble", "台词气泡", "NPC 台词气泡底纹"],
  ["me", "我的气泡", "主角发言气泡底纹"],
] as const;
export type FreeSlot = (typeof FREE_SLOTS)[number][0];

const SEL: Record<FreeSlot, string> = {
  page: ".app-root", topbar: ".app-topbar", dialog: ".dialogue-panel", bubble: ".dlg-bubble", me: ".dlg-bubble-me",
};
const R = "html:root:root"; // 加权，压过 .skin-xxx / .dark 上的变量
const q = (u: string) => `url("${u.replace(/["\\\n]/g, "")}")`;

export function buildFreeCss(f?: FreeStyle): string {
  if (!f || f.on === false) return "";
  const out: string[] = [];
  const vars = Object.entries(f.colors ?? {}).filter(([, v]) => v).map(([k, v]) => `--${k}: ${v};`);
  if (f.colors?.jade) vars.push(`--jade-deep: color-mix(in srgb, ${f.colors.jade} 78%, black);`);
  if (f.font?.url && f.font.name) {
    const fam = `"${f.font.name.replace(/"/g, "")}"`;
    out.push(`@font-face { font-family: ${fam}; src: ${q(f.font.url)}; font-display: swap; }`);
    vars.push(`--font-serif: ${fam}, 'Noto Serif SC', serif;`, `--font-sans: ${fam}, 'Noto Sans SC', sans-serif;`);
  }
  if (vars.length) out.push(`${R} { ${vars.join(" ")} }`);
  for (const [slot, img] of Object.entries(f.imgs ?? {}) as [FreeSlot, FreeImg][]) {
    if (!img?.url) continue;
    const s = `${R} ${SEL[slot]}`;
    const fit = img.fit ?? "cover";
    const size = fit === "repeat" ? "auto" : fit;
    const op = Math.max(0, Math.min(1, (img.opacity ?? 100) / 100));
    // 贴图放在 ::after 底层，透明度可调且不影响文字
    out.push(`${s} { position: relative; isolation: isolate; }`);
    // 气泡的 ::after 已被「漫画」尾巴占用，改用 ::before；面板的 ::before 是主色描线，用 ::after
    const pseudo = slot === "bubble" || slot === "me" ? "::before" : "::after";
    out.push(`${s}${pseudo} { content: ""; position: ${slot === "page" ? "fixed" : "absolute"}; inset: 0; z-index: -1; pointer-events: none; border-radius: inherit;
      background: ${q(img.url)} center / ${size} ${fit === "repeat" ? "repeat" : "no-repeat"}; opacity: ${op}; }`);
  }
  return out.join("\n");
}

export function applyFreeStyle(f?: FreeStyle, d?: DialogDiy, tb?: TopbarDiy) {
  if (typeof document === "undefined") return;
  let el = document.getElementById("free-style") as HTMLStyleElement | null;
  if (!el) { el = document.createElement("style"); el.id = "free-style"; document.head.appendChild(el); }
  el.textContent = [buildFreeCss(f), buildDialogCss(d), buildTopbarCss(tb)].filter(Boolean).join("\n");
  const user = document.getElementById("user-css");
  if (user) document.head.appendChild(user); // 用户 CSS 永远最后
}

/* —— 图床 / 素材库：全局保存，不进存档 —— */
/* 功能注释：temp = 生图自动收进来的临时素材，7 天内没被使用就自动清除；收藏（去掉 temp）后长期保留 */
export type Asset = { id: string; name: string; url: string; at: number; temp?: boolean; usedAt?: number };
const K_ASSETS = "star:assets", K_HOST = "star:imghost";
export const TEMP_ASSET_TTL = 7 * 24 * 3600 * 1000;
const lastUse = (a: Asset) => Math.max(a.at, a.usedAt ?? 0);
export const assetDaysLeft = (a: Asset, now = Date.now()) => Math.max(0, Math.ceil((lastUse(a) + TEMP_ASSET_TTL - now) / 86400000));
const emitAssets = () => { if (typeof window !== "undefined") window.dispatchEvent(new Event("star:assets")); };
export const saveAssets = (a: Asset[]) => saveGlobal(K_ASSETS, a);
export const loadAssets = (): Asset[] => {
  const all = loadGlobal<Asset[]>(K_ASSETS, []) || [];
  const now = Date.now();
  const kept = all.filter((a) => !a.temp || now - lastUse(a) < TEMP_ASSET_TTL);
  if (kept.length !== all.length) saveAssets(kept);
  return kept;
};
const newId = () => Math.random().toString(36).slice(2, 9);
/** 生图结果自动收进素材库（临时）；已存在则只刷新使用时间 */
export function addTempAsset(url: string, name = "AI 生图") {
  const a = loadAssets();
  const hit = a.find((x) => x.url === url);
  if (hit) { hit.usedAt = Date.now(); saveAssets(a); }
  else saveAssets([{ id: newId(), name: name.slice(0, 24), url, at: Date.now(), temp: true }, ...a]);
  emitAssets();
}
/** 收藏：长期保留（不在库里则直接加入） */
export function keepAsset(url: string, name = "AI 生图") {
  const a = loadAssets();
  const hit = a.find((x) => x.url === url);
  if (hit) { delete hit.temp; saveAssets(a); }
  else saveAssets([{ id: newId(), name: name.slice(0, 24), url, at: Date.now() }, ...a]);
  emitAssets();
}
export const isAssetKept = (url: string) => loadAssets().some((x) => x.url === url && !x.temp);
/** 素材被用上时刷新使用时间，临时素材重新计 7 天 */
export function touchAsset(url: string) {
  const a = loadAssets();
  const hit = a.find((x) => x.url === url);
  if (!hit) return;
  hit.usedAt = Date.now(); saveAssets(a); emitAssets();
}
export type ImgHost = { kind: "none" | "imgbb"; key?: string };
export const loadHost = (): ImgHost => loadGlobal<ImgHost>(K_HOST, { kind: "none" }) || { kind: "none" };
export const saveHost = (h: ImgHost) => saveGlobal(K_HOST, h);

/* 本地图片压缩成 dataURL（长边 ≤ max，JPEG/WebP），避免撑爆本地存储 */
export function compressImage(file: File, max = 1600, quality = 0.85): Promise<string> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      const png = file.type === "image/png" || file.type === "image/gif";
      res(c.toDataURL(png ? "image/webp" : "image/jpeg", quality));
    };
    img.onerror = () => rej(new Error("无法读取这张图片"));
    img.src = URL.createObjectURL(file);
  });
}

/* 上传到图床（imgbb，需玩家自填 API Key）；返回公网直链 */
export async function uploadToHost(file: File, host: ImgHost): Promise<string> {
  if (host.kind !== "imgbb" || !host.key) throw new Error("未配置图床");
  const body = new FormData(); body.append("image", file);
  const r = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(host.key)}`, { method: "POST", body });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.data?.url) throw new Error(j?.error?.message || `图床返回错误 ${r.status}`);
  return j.data.url as string;
}

/* 统一上传入口：配置了图床就传图床（公网链接），否则本地压缩；结果同时收进素材库 */
export async function uploadImage(file: File, max = 1600): Promise<{ url: string; hosted: boolean }> {
  const host = loadHost();
  const hosted = host.kind === "imgbb" && !!host.key;
  const url = hosted ? await uploadToHost(file, host) : await compressImage(file, max);
  const a = loadAssets();
  if (!a.some((x) => x.url === url)) saveAssets([{ id: Math.random().toString(36).slice(2, 9), name: file.name.replace(/\.[^.]+$/, "").slice(0, 24) || "图片", url, at: Date.now() }, ...a]);
  window.dispatchEvent(new Event("star:assets")); // 通知素材库面板刷新
  return { url, hosted };
}

/* —— 对话框 DIY：颜色 / 边框 / 模糊 / 字号行距 / 内边距 / 阴影 / 名字牌 / 气泡 —— */
export type DialogDiy = {
  on?: boolean;
  bg?: string; bgAlpha?: number; blur?: number;
  border?: string; borderW?: number; borderStyle?: "solid" | "dashed" | "dotted" | "double" | "none";
  shadow?: "none" | "soft" | "strong" | "glow";
  text?: string; textSoft?: string; fontSize?: number; lineHeight?: number; letter?: number; pad?: number;
  nameBg?: string; nameText?: string; nameShape?: "tag" | "pill" | "plain" | "underline";
  bubbleBg?: string; bubbleText?: string; bubbleBorder?: string; meBg?: string; meText?: string; bubbleRadius?: number;
};
const SH: Record<NonNullable<DialogDiy["shadow"]>, string> = {
  none: "none", soft: "0 10px 30px -18px rgba(0,0,0,.35)", strong: "0 18px 40px -14px rgba(0,0,0,.55)",
  glow: "0 0 0 1px color-mix(in srgb, var(--jade) 30%, transparent), 0 0 26px -4px var(--jade)",
};
export function buildDialogCss(d?: DialogDiy): string {
  if (!d || d.on === false) return "";
  const P = `${R} .dialogue-panel`;
  const o: string[] = [];
  const panel: string[] = [];
  if (d.bg) panel.push(`background: color-mix(in srgb, ${d.bg} ${d.bgAlpha ?? 100}%, transparent) !important;`);
  else if (d.bgAlpha != null) panel.push(`background: color-mix(in srgb, var(--paper-2) ${d.bgAlpha}%, transparent) !important;`);
  if (d.blur) panel.push(`backdrop-filter: blur(${d.blur}px) saturate(1.15) !important;`);
  if (d.border) panel.push(`border-color: ${d.border} !important;`);
  if (d.borderW != null) panel.push(`border-width: ${d.borderW}px !important;`);
  if (d.borderStyle) panel.push(`border-style: ${d.borderStyle} !important;`);
  if (d.shadow) panel.push(`box-shadow: ${SH[d.shadow]} !important;`);
  if (d.pad != null) panel.push(`padding: ${d.pad}px ${d.pad + 4}px !important;`);
  if (d.text) panel.push(`--ink: ${d.text}; --color-ink: ${d.text};`);
  if (d.textSoft) panel.push(`--ink-soft: ${d.textSoft}; --color-ink-soft: ${d.textSoft};`);
  if (panel.length) o.push(`${P} { ${panel.join(" ")} }`);
  // 功能注释：字号须覆盖小说内容卡 / 叠图旁白，不能只限 .dialogue-panel（预览正文不在对话框里）
  const txt: string[] = [];
  if (d.fontSize) {
    txt.push(`font-size: ${d.fontSize}px !important;`);
    o.push(`${R} { --story-font-size: ${d.fontSize}px; }`);
  }
  if (d.lineHeight) txt.push(`line-height: ${d.lineHeight} !important;`);
  if (d.letter != null) txt.push(`letter-spacing: ${d.letter / 100}em !important;`);
  if (txt.length) {
    o.push(
      `${P} .story-prose, ${P} .dlg-bubble, ${P} .dlg-bubble-me, ` +
        `${R} .novel-read-card .story-prose, ${R} .novel-read-card .dlg-bubble, ${R} .novel-read-card .dlg-bubble-me, ` +
        `${R} [data-slot="scene-prose"] .story-prose, ${R} .story-narration-panel { ${txt.join(" ")} }`,
    );
  }
  const nm: string[] = [];
  if (d.nameBg) nm.push(`background: ${d.nameBg} !important;`);
  if (d.nameText) nm.push(`color: ${d.nameText} !important;`);
  if (d.nameShape === "pill") nm.push("border-radius: 9999px !important;");
  if (d.nameShape === "plain") nm.push("background: transparent !important; box-shadow: none !important; padding-left: 0 !important; color: " + (d.nameText ?? "var(--jade)") + " !important;");
  if (d.nameShape === "underline") nm.push("background: transparent !important; box-shadow: none !important; border-radius: 0 !important; padding: 0 2px 2px !important; border-bottom: 2px solid " + (d.nameBg ?? "var(--jade)") + "; color: " + (d.nameText ?? "var(--ink)") + " !important;");
  if (nm.length) o.push(`${R} .dlg-nametag { ${nm.join(" ")} }`);
  if (d.nameText) o.push(`${R} .dlg-name { color: ${d.nameText} !important; }`);
  const bb: string[] = [];
  if (d.bubbleBg) bb.push(`background: ${d.bubbleBg} !important; backdrop-filter: none !important;`);
  if (d.bubbleText) bb.push(`color: ${d.bubbleText} !important;`);
  if (d.bubbleBorder) bb.push(`border-color: ${d.bubbleBorder} !important;`);
  if (d.bubbleRadius != null) bb.push(`border-radius: ${d.bubbleRadius}px !important;`);
  if (bb.length) o.push(`${R} .dlg-bubble { ${bb.join(" ")} }`);
  const me: string[] = [];
  if (d.meBg) me.push(`background: ${d.meBg} !important;`);
  if (d.meText) me.push(`color: ${d.meText} !important;`);
  if (d.bubbleRadius != null) me.push(`border-radius: ${d.bubbleRadius}px !important;`);
  if (me.length) o.push(`${R} .dlg-bubble-me { ${me.join(" ")} }`);
  return o.join("\n");
}
