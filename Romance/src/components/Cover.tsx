import { lazyPanel } from "../lib/lazyPanel";
import { FrameOverlay } from "./FrameDiy";
import { useEffect, useMemo, useState } from "react";
import { useGame } from "../store/gameCtx";
import { deleteSlot, listSaves, type CoverDiy, type SaveSlot } from "../lib/store";
import { Modal } from "./ui";
const AIConfigPanel = lazyPanel(() => import("./AIConfigPanel"));
import { IconHeart, IconPlay, IconRefresh, IconSettings, IconSpark } from "../lib/icons";
import { getWorld } from "../mods/registry";
import { isAuthorPreview } from "../lib/authorPreview";
import type { CoverCgOpts, CoverCopy } from "../mods/types";
import { FONTS } from "../lib/skins";
import { coverMode, scopeCoverCss, withAuthorStyle } from "../lib/coverAi";


/* —— 封面 DIY 的样式表 —— */
const TINT: Record<Exclude<NonNullable<CoverDiy["tint"]>, "custom">, [string, string]> = {
  night: ["#2b1d47", "#1c1233"], rose: ["#4a1533", "#250a1a"], ocean: ["#10284a", "#06121f"], gold: ["#3d2a0c", "#1a1105"], none: ["#000000", "#000000"],
};
const TITLE_SIZE = { s: "text-3xl sm:text-4xl", m: "text-4xl sm:text-5xl", l: "text-5xl sm:text-6xl", xl: "text-6xl sm:text-7xl" } as const;
const TITLE_GRAD = {
  gold: "bg-gradient-to-r from-[#fff3c4] via-[#f5c26b] to-[#fde68a]",
  pink: "bg-gradient-to-r from-[#ffd1ec] via-[#e2a6d6] to-[#c7b6ff]",
  accent: "bg-gradient-to-r from-[var(--coral)] via-[var(--gold)] to-[var(--jade)]",
} as const;
const SHAPE = { pill: "rounded-full", rounded: "rounded-xl", square: "rounded-none", gem: "rounded-[10px_2px_10px_2px]" } as const;
const BTN = {
  dream: { main: "bg-gradient-to-r from-[#a68bec] via-[#c79ae4] to-[#e2a6d6] text-white font-bold shadow-[0_14px_34px_-10px_rgba(150,110,220,0.9)] ring-1 ring-white/40", sub: "border border-white/45 bg-white/10 text-white backdrop-blur-md hover:border-white/70 hover:bg-white/20" },
  solid: { main: "bg-jade text-white font-bold shadow-[0_14px_30px_-12px_var(--jade)]", sub: "bg-white/90 text-[#2b1d47] font-semibold hover:bg-white" },
  glass: { main: "border border-white/60 bg-white/25 text-white font-bold backdrop-blur-xl", sub: "border border-white/40 bg-white/10 text-white backdrop-blur-xl hover:bg-white/20" },
  outline: { main: "border-2 border-white text-white font-bold hover:bg-white/15", sub: "border border-white/60 text-white/90 hover:border-white hover:text-white" },
  gold: { main: "bg-gradient-to-r from-[#d8b46a] to-[#f1d89a] text-[#3a2a10] font-bold shadow-[0_14px_30px_-12px_rgba(216,180,106,0.9)]", sub: "border border-[#f1d89a]/60 bg-black/20 text-[#f6e7c1] backdrop-blur-md hover:bg-black/30" },
  jade: { main: "bg-jade text-white font-bold", sub: "border border-jade/60 bg-black/20 text-white backdrop-blur-md hover:bg-black/30" },
  paper: { main: "bg-[#f6f1e7] text-[#2a2520] font-bold shadow-sm", sub: "border border-[#f6f1e7]/60 bg-[#f6f1e7]/15 text-[#f6f1e7] hover:bg-[#f6f1e7]/25" },
  rose: { main: "bg-gradient-to-r from-[#e88aa6] to-[#f4b7c6] text-white font-bold shadow-[0_14px_30px_-12px_rgba(232,138,166,0.9)]", sub: "border border-white/45 bg-white/10 text-white backdrop-blur-md hover:bg-white/20" },
  text: { main: "text-white font-black tracking-[0.3em] hover:tracking-[0.4em]", sub: "text-white/80 tracking-[0.25em] hover:text-white hover:tracking-[0.35em]" },
} as const;
const DEF_LABEL = { start: "开始游戏", continue: "继续游戏", config: "配置 AI" } as const;

/* 氛围特效：星光 / 花瓣 / 雪 / 萤火 / 爱心（确定性伪随机，避免每次渲染跳动） */
export function CoverFx({ kind }: { kind: NonNullable<CoverDiy["fx"]> }) {
  if (kind === "none") return null;
  const r = (i: number, k: number) => ((i * 9301 + k * 49297 + 233) % 233280) / 233280;
  return (
    <div aria-hidden className={`cover-fx cover-fx-${kind}`}>
      {Array.from({ length: kind === "stars" ? 28 : 20 }, (_, i) => (
        <i key={i} className="inline-flex text-current" style={{ left: `${r(i, 1) * 100}%`, top: kind === "stars" ? `${r(i, 2) * 100}%` : undefined, animationDelay: `${-r(i, 3) * 12}s`, animationDuration: `${(kind === "stars" ? 2.5 : 8) + r(i, 4) * 7}s`, fontSize: `${8 + r(i, 5) * 10}px`, ["--sw" as string]: `${(r(i, 6) - 0.5) * 80}px` }}>
          {kind === "stars" ? <IconSpark size={12} /> : kind === "hearts" ? <IconHeart size={12} /> : null}
        </i>
      ))}
    </div>
  );
}

/* —— 背景 CG：固定 / 轮播 / 视频 —— */
type CgSrc = CoverCgOpts & { image?: string; video?: string };
export type CoverBgPlan = { kind: "video"; video: string; poster?: string } | { kind: "images"; images: string[] } | { kind: "none" };
export const cgKind = (c: CgSrc) => c.cgMode ?? (c.video ? "video" : "fixed");
/** 按背景类型取要显示的内容；该类型没填内容时退回能用的那项（视频 → 固定 CG；轮播 → 固定 CG） */
export function resolveCoverBg(c: CgSrc): CoverBgPlan {
  const kind = cgKind(c);
  const cgs = (c.cgs ?? []).filter(Boolean);
  if (kind === "video" && c.video) return { kind: "video", video: c.video, poster: c.image };
  if (kind === "carousel" && cgs.length) return { kind: "images", images: cgs };
  if (c.image) return { kind: "images", images: [c.image] };
  if (cgs.length) return { kind: "images", images: cgs };
  return c.video ? { kind: "video", video: c.video } : { kind: "none" };
}

/** 功能注释：作品展示用封面图（列表/详情/书架）；取背景固定图、轮播首张或视频海报 */
export function coverDisplayUrl(c?: CoverCgOpts & { image?: string; video?: string } | null): string | undefined {
  if (!c) return undefined;
  const bg = resolveCoverBg(c);
  if (bg.kind === "images") return bg.images[0];
  if (bg.kind === "video") return bg.poster || undefined;
  return undefined;
}

const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/* 背景 CG 层：一张 = 固定；多张 = 自动轮播（淡入淡出 / 滑动 / 缓推），底部页码点可手动切换 */
function CoverBg({ images, opts, blur, preview }: { images: string[]; opts: CoverCgOpts; blur: number; preview?: boolean }) {
  const sig = images.join("\n");
  const list = useMemo(() => {
    if (!opts.cgShuffle) return images;
    const a = [...images];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, opts.cgShuffle]);
  const n = list.length;
  const sec = Math.max(2, Math.min(60, opts.cgInterval ?? 6));
  const still = reducedMotion();
  const fx = still ? "fade" : opts.cgFx ?? "fade";
  const [pos, setPos] = useState({ cur: 0, prev: -1 });
  const cur = n ? pos.cur % n : 0;
  const go = (k: number) => setPos((p) => (k === p.cur ? p : { cur: k, prev: p.cur }));
  // 自动轮播：每次切换后重新计时（手动点页码也会重置）
  useEffect(() => {
    if (n < 2) return;
    const t = setTimeout(() => go((cur + 1) % n), sec * 1000);
    return () => clearTimeout(t);
  }, [cur, n, sec]);
  // 预加载，避免切到下一张时闪白
  useEffect(() => { if (n > 1) list.forEach((src) => { const im = new Image(); im.src = src; }); }, [list, n]);
  useEffect(() => { if (pos.cur >= n && n) setPos({ cur: 0, prev: -1 }); }, [n, pos.cur]);

  const fadeMs = still ? 400 : 1200;
  return (
    <>
    {/* isolate：图片切换用的 z-index 只在本层内比较，不能盖过遮罩、标题和按钮 */}
    <div className="cover-cg absolute inset-0 isolate overflow-hidden">
      {list.map((src, k) => {
        const on = k === cur, was = k === pos.prev;
        const base = blur ? 1.06 : 1;
        let style: React.CSSProperties;
        if (fx === "slide" && n > 1) {
          const x = on ? 0 : was ? -100 : 100;
          style = { transform: `translateX(${x}%) scale(${base})`, transition: on || was ? "transform 900ms cubic-bezier(.65,0,.35,1)" : "none", zIndex: on ? 2 : was ? 1 : 0 };
        } else {
          const zoom = fx === "zoom" && n > 1;
          style = {
            opacity: on ? 1 : 0, zIndex: on ? 2 : was ? 1 : 0,
            transform: `scale(${zoom && on ? base * 1.1 : base})`,
            // 缓推：当前这张在停留期间慢慢推近；淡出后再瞬间复位
            transition: zoom ? (on ? `opacity ${fadeMs}ms ease, transform ${sec + 1.2}s linear` : `opacity ${fadeMs}ms ease, transform 0s ${fadeMs}ms`) : `opacity ${fadeMs}ms ease`,
          };
        }
        return <div key={k} aria-hidden className="cover-bg absolute inset-0 bg-cover bg-center will-change-transform" style={{ backgroundImage: `url(${src})`, ...(blur ? { filter: `blur(${blur}px)` } : {}), ...style }} />;
      })}
    </div>
      {n > 1 && !opts.cgHideDots && (
        <div className="cover-cg-dots absolute inset-x-0 bottom-4 z-10 flex justify-center gap-1.5" role="group" aria-label="封面 CG" aria-hidden={preview || undefined}>
          {list.map((_, k) => (
            <button key={k} type="button" tabIndex={preview ? -1 : 0} aria-label={`第 ${k + 1} 张`} aria-current={k === cur || undefined} onClick={() => go(k)}
              className={`h-1.5 rounded-full bg-white shadow-[0_0_6px_rgba(0,0,0,0.4)] transition-all duration-500 ${k === cur ? "w-5 opacity-95" : "w-1.5 opacity-45 hover:opacity-80"}`} />
          ))}
        </div>
      )}
    </>
  );
}

type CoverHandlers = { onStart: () => void; onContinue: () => void; onConfig: () => void };

/* 封面主体：世界封面（cv）+ 玩家 DIY（d），玩家填写的项优先；preview=编辑器缩略预览（不响应点击） */
export function CoverView({ cv, d: d0, preview, ...h }: { cv: CoverCopy; d?: CoverDiy; preview?: boolean } & CoverHandlers) {
  // 作者样式层（模组 cover.style）打底，玩家 DIY 叠在上面；玩家关掉「我的封面」时只剩作者样式
  const d: CoverDiy = withAuthorStyle(cv.style, d0 && d0.on !== false ? d0 : {});
  // 玩家自己的背景优先；没填则用世界封面（媒体模式）
  const own = resolveCoverBg(d);
  const ownBg = own.kind !== "none";
  const mode = ownBg ? "media" : coverMode(cv);
  const htmlMode = mode === "html" && !!cv.html;
  const showUI = !htmlMode || cv.htmlUI !== false;
  const bg: CoverBgPlan = ownBg ? own : mode === "media" ? resolveCoverBg(cv) : { kind: "none" };
  const cgOpts: CoverCgOpts = ownBg ? d : cv;
  const dim = Math.max(0, Math.min(80, d.dim ?? cv.dim ?? 40)) / 100;
  const blur = d.blur ?? 0;
  const [c1, c2] = d.tint === "custom" && d.tintColor ? [d.tintColor, d.tintColor] : TINT[(d.tint as keyof typeof TINT) ?? "night"] ?? TINT.night;
  const align = d.align ?? "left";
  const tAlign = align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left";
  const btn = BTN[d.btnStyle ?? "dream"];
  const shape = SHAPE[d.btnShape ?? "pill"];
  const layout = d.btnStyle === "text" ? "stack" : d.btnLayout ?? "grid";
  // 功能注释：labels 值可能被 AI 写成非字符串，禁止 ?.trim()
  const label = (k: keyof typeof DEF_LABEL) => (typeof d.labels?.[k] === "string" ? d.labels[k]!.trim() : "") || DEF_LABEL[k];
  const font = d.titleFont && d.titleFont !== "default" ? FONTS.find((f) => f.id === d.titleFont)?.family : undefined;
  const tc = d.titleColor ?? "white";
  const grad = tc === "gold" || tc === "pink" || tc === "accent" ? TITLE_GRAD[tc] : "";
  const panel = d.panel ?? "none";
  const panelCls = panel === "glass" ? "rounded-3xl border border-white/25 bg-white/10 p-6 backdrop-blur-xl" : panel === "dark" ? "rounded-3xl bg-black/45 p-6 backdrop-blur-md" : panel === "paper" ? "rounded-[18px] border border-[#e8dcc6] bg-[#fbf6ec]/92 p-6 shadow-[0_18px_50px_-20px_rgba(0,0,0,0.6)] [text-shadow:none] [&_.cover-intro_p]:!text-[#4a3b2a] [&_.cover-kicker]:!text-[#8a6d4a] [&_.cover-subtitle]:!text-[#9b5d73]" : "";
  // 封面专属 CSS（AI 对话生成或手写）：自动收进 .cover-root，只影响封面
  const css = useMemo(() => (typeof d.css === "string" && d.css.trim() ? scopeCoverCss(d.css) : ""), [d.css]);
  const vpos = d.vpos ?? "center";
  // 编辑器：文字只来自封面设置；标题兜底用当前作品名，其余留空就不显示
  const kicker = d.kicker || cv.kicker || "";
  const title = d.title || cv.title || getWorld().chain[0]?.name || "未命名作品";
  const subtitle = d.subtitle || cv.subtitle || "";
  const intro = d.intro || cv.intro || "";

  const btnBase = `group relative flex items-center justify-center gap-2 overflow-hidden ${shape} py-3 text-sm transition-all duration-300 hover:-translate-y-0.5`;
  const subs = ([
    ["continue", h.onContinue, <IconRefresh key="i" width={16} height={16} className="transition-transform duration-500 group-hover:rotate-180" />],
    ["config", h.onConfig, <IconSettings key="i" width={16} height={16} />],
  ] as const).filter(([k]) => !d.hide?.[k]);
  const gridCls = layout === "row" ? "flex flex-wrap gap-2.5 [&>*]:min-w-[7rem] [&>*]:flex-1" : layout === "stack" ? "grid gap-2.5" : "grid gap-2.5 sm:grid-cols-2";

  return (
    <div className={`cover-root relative flex flex-col items-center overflow-hidden px-6 ${preview ? "pointer-events-none h-full py-10" : "min-h-screen py-16"} ${vpos === "top" ? "justify-start pt-20" : vpos === "bottom" ? "justify-end pb-16" : "justify-center"}`}>
      {css && <style>{css}</style>}
      {htmlMode ? (
        <iframe title="封面" sandbox="allow-scripts allow-popups" srcDoc={cv.html} className="absolute inset-0 h-full w-full border-0" />
      ) : bg.kind === "video" ? (
        <video className="cover-bg absolute inset-0 h-full w-full object-cover" style={blur ? { filter: `blur(${blur}px)`, transform: "scale(1.06)" } : undefined} src={bg.video} autoPlay muted loop playsInline poster={bg.poster} aria-hidden />
      ) : (
        bg.kind === "images" ? <CoverBg images={bg.images} opts={cgOpts} blur={blur} preview={preview} />
          : <div className="cover-bg absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,#3a3550_0%,#1c1a26_55%,#121118_100%)]" aria-hidden />
      )}
      {!htmlMode && <div className="pointer-events-none absolute inset-0" style={{ opacity: Math.min(1, dim * 1.6), background: `linear-gradient(to bottom, ${c1}, color-mix(in srgb, ${c1} 50%, transparent), ${c2})` }} aria-hidden />}
      {!htmlMode && d.fx && <CoverFx kind={d.fx} />}
      {!htmlMode && <FrameOverlay f={d.frame} />}

      {showUI && <div className={`relative w-full max-w-xl ${htmlMode ? "mt-auto pointer-events-auto" : ""}`}><div className={`cover-panel ${tAlign} [text-shadow:0_2px_18px_rgba(20,12,40,0.85)] ${panelCls}`}>
        {!htmlMode && <>
        {!d.hideKicker && kicker && (
          <p className={`cover-kicker mb-3 flex items-center gap-2 text-[11.5px] font-medium tracking-[0.18em] text-white/75 ${align === "center" ? "justify-center" : align === "right" ? "justify-end" : ""}`}>
            {kicker}
          </p>
        )}
        {d.logo ? (
          <img src={d.logo} alt={title} className={`cover-logo max-h-36 max-w-full object-contain drop-shadow-[0_6px_24px_rgba(0,0,0,0.45)] ${align === "center" ? "mx-auto" : align === "right" ? "ml-auto" : ""}`} />
        ) : (
          <h1 className={`cover-title font-black leading-tight tracking-wide drop-shadow-[0_2px_12px_rgba(0,0,0,0.35)] ${TITLE_SIZE[d.titleSize ?? "m"]} ${grad ? `${grad} bg-clip-text text-transparent [text-shadow:none]` : tc === "custom" ? "" : "text-white"}`}
            style={{ fontFamily: font, color: tc === "custom" ? d.titleCustom : undefined }}>
            {title}
          </h1>
        )}
        {subtitle && <p className="cover-subtitle mt-2 text-[15px] font-medium text-white/85">{subtitle}</p>}

        {!d.hideIntro && intro && (
          <div className={`cover-intro mt-6 ${align === "center" ? "" : align === "right" ? "border-r-2 border-white/40 pr-4" : "border-l-2 border-white/40 pl-4"}`}>
            <p className="story-prose text-[13.5px] leading-relaxed text-white/90">{intro}</p>
          </div>
        )}

        <div className="my-6 h-px w-full bg-gradient-to-r from-transparent via-white/35 to-transparent" />
        </>}

        <div className={`cover-btns [text-shadow:none] ${gridCls}`}>
          <button onClick={h.onStart} className={`cover-btn cover-btn-main ${btnBase} ${layout === "grid" ? "col-span-full" : ""} py-3.5 text-base tracking-wide ${btn.main}`}>
            {d.btnStyle !== "text" && <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 group-hover:translate-x-full" aria-hidden />}
            <IconPlay width={18} height={18} /> {label("start")}
          </button>
          {subs.map(([k, on, icon], i) => (
            <button key={k} onClick={on} className={`cover-btn cover-btn-sub ${btnBase} ${btn.sub} ${layout === "grid" && i === subs.length - 1 && subs.length % 2 === 1 ? "col-span-full" : ""}`}>
              {icon} {label(k)}
            </button>
          ))}
        </div>
      </div></div>}
    </div>
  );
}

export default function Cover() {
  const { go, loadState, look } = useGame();
  /* 功能注释：作品 content.cover 只给列表/详情/书架展示，开局菜单不再套用该图；玩家可在美化·封面 DIY。 */
  const [modal, setModal] = useState<null | "config" | "continue">(null);
  const [saves, setSaves] = useState<SaveSlot[]>([]);
  const cv: CoverCopy = {};

  const refresh = async () => setSaves(await listSaves());
  const openContinue = () => {
    void refresh();
    setModal("continue");
  };
  const removeSave = async (id: string) => {
    await deleteSlot(id);
    void refresh();
  };

  return (
    <div className="relative">
      {/* 功能注释：开局菜单用默认底；作品展示封面不在此屏出现 */}
      <CoverView cv={cv} d={isAuthorPreview() ? undefined : look.cover} onStart={() => go("create")} onContinue={openContinue} onConfig={() => setModal("config")} />

      {modal === "config" && (
        <Modal title="AI 配置" onClose={() => setModal(null)}>
          <AIConfigPanel />
        </Modal>
      )}

      {modal === "continue" && (
        <Modal title="继续游戏 · 读取存档" onClose={() => setModal(null)}>
          {saves.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-soft">暂无存档，先开始一段新的故事吧。</p>
          ) : (
            <div className="space-y-2">
              {saves.map((s) => (
                <div key={s.id} className="flex items-center gap-3 rounded-xl border border-line bg-paper p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-serif font-bold text-ink">{s.name}</p>
                    {s.state.saveSummary && <p className="truncate text-[12px] text-ink">{s.state.saveSummary}</p>}
                    <p className="text-[11px] text-ink-soft">
                      {s.state.world.time} · {s.state.world.location} · 第 {s.state.turnCount} 回合 · {new Date(s.updatedAt).toLocaleString("zh-CN")}
                    </p>
                  </div>
                  <button onClick={() => loadState(s.state)} className="rounded-lg bg-jade px-3 py-1.5 text-xs font-medium text-paper-2 transition hover:brightness-110">
                    读取
                  </button>
                  <button
                    onClick={() => void removeSave(s.id)}
                    className="rounded-lg border border-line px-2 py-1.5 text-xs text-ink-soft transition hover:border-danger hover:text-danger"
                  >
                    删除
                  </button>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
