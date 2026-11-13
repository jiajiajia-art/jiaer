import { getWorld } from "../mods/registry";
import { Fragment, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { limitDays, type GameState } from "../lib/types";
import { walletDef, wallet } from "../game/wallet";
import { apPerMove, tripPoints, tripPointsMax } from "../game/mud";
import { startDateLabel } from "../game/logic";
import { IconClock, IconFlag, IconPin, IconWallet, IconMenu } from "../lib/icons";
import DiyIcon from "./DiyIcon";
import {
  AVATAR_TOKEN, MODULE_LABELS, apText, applyTopbarRegex, daysText, escapeHtml, rawBarText, renderTopbarTemplate, resolveTopbarDiy,
  type RxOut, type TopbarAvatarFrame, type TopbarAvatarShape, type TopbarBarStyle, type TopbarBg, type TopbarCardStyle,
  type TopbarData, type TopbarDiy, type TopbarModuleKey, type TopbarRegexTarget,
} from "../lib/topbarDiy";

/* 顶栏：竖屏主界面、横屏顶栏与「美化 · 顶栏」预览共用这一个组件，所见即所得。
 * 结构由 TopbarDiy 自由组合；颜色 / 贴图 / 正则 CSS 由 buildTopbarCss 注入到 .app-topbar。 */

export function topbarDataOf(game: GameState, worldName = ""): TopbarData {
  const time = game.world?.time ?? "";
  const parts = time.split(" · ");
  const weekTxt = parts[0] ?? "";
  const sim = game.sim;
  // 周数以引擎为准：world.time 若是「2005.01.04 上午 08:12」这类串，取首个数字会把年份当成周数
  const weekNum = String(sim?.week ?? weekTxt.match(/第\s*(\d+)\s*周/)?.[1] ?? 1).padStart(2, "0");
  const name = game.player?.name || "叶见月";
  const ap = sim ? tripPoints(sim) : undefined;
  return {
    name,
    age: (game.player as { age?: string | number } | undefined)?.age ?? 22,
    avatar: game.player?.avatar || undefined,
    initial: name.trim()[0] ?? "?",
    week: `第 ${weekNum} 周`,
    weekNum,
    date: parts.slice(1).join(" · ") || weekTxt,
    time,
    location: game.world?.location ?? "",
    weather: game.world?.weather || undefined,
    money: sim ? wallet.short(wallet.balance(game), game) : undefined,
    negative: sim ? wallet.balance(game) < 0 : false,
    ap,
    apMax: sim ? tripPointsMax() : undefined,
    apLow: sim ? (ap ?? 0) <= apPerMove() : false,
    daysLeft: game.timeLimit && sim ? Math.max(0, limitDays(game.timeLimit, game.startDate || startDateLabel()) - sim.day) : undefined,
    world: worldName.split(" ")[0] || "",
  };
}

const CalGlyph = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <rect x="3.5" y="5" width="17" height="16" rx="2.5" /><path d="M3.5 9.5h17M8 3v4M16 3v4" />
  </svg>
);
const CloudGlyph = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M7 18a4.2 4.2 0 0 1-.6-8.36 5 5 0 0 1 9.65-1.2A3.8 3.8 0 0 1 18 16.9V17H7Z" />
  </svg>
);

/* 正则结果：有改动 → 渲染过滤后的 HTML；否则原样文字 */
function Rx({ v }: { v: RxOut }) {
  return v.changed ? <span className="tb-rx" dangerouslySetInnerHTML={{ __html: v.html }} /> : <>{v.text}</>;
}

/* 预览里不渲染真按钮（避免按钮套按钮，也不响应点击） */
function Press({ preview, label, title, expanded, onPress, className, children }: {
  preview?: boolean; label: string; title?: string; expanded?: boolean; onPress?: () => void; className: string; children: ReactNode;
}) {
  if (preview) return <span className={className}>{children}</span>;
  return (
    <button type="button" aria-label={label} title={title} aria-expanded={expanded} className={className}
      onClick={(e) => { e.stopPropagation(); onPress?.(); }}>
      {children}
    </button>
  );
}

/* 头像：形状（圆 / 圆角方 / 菱形）× 外框（流光 / 鎏金 / 白边 / 主色 / 无）× 可叠一张头像框贴图 */
export function TopbarAvatar({ data, shape, frame, size, frameImg, frameScale = 145 }: {
  data: TopbarData; shape: TopbarAvatarShape; frame: TopbarAvatarFrame; size: number; frameImg?: string; frameScale?: number;
}) {
  if (shape === "hidden") return null;
  const diamond = shape === "diamond";
  const r = shape === "circle" ? "rounded-full" : diamond ? "rounded-[22%]" : "rounded-[30%]";
  const core = Math.round(diamond ? size * 0.74 : size);
  const face = (
    <span className={`relative block overflow-hidden bg-gradient-to-br from-jade/25 to-coral/15 ${r}`} style={{ width: core, height: core }}>
      {data.avatar ? (
        <img src={data.avatar} alt="" className={`h-full w-full object-cover object-top ${diamond ? "-rotate-45 scale-[1.42]" : ""}`} />
      ) : (
        <span className={`flex h-full w-full items-center justify-center font-serif font-bold text-jade ${diamond ? "-rotate-45" : ""}`} style={{ fontSize: Math.round(size * 0.42) }}>
          {data.initial}
        </span>
      )}
    </span>
  );
  const ringed =
    frame === "halo" ? (
      /* 流光：渐变双环，不加外发光 */
      <span className={`relative block ${r} bg-gradient-to-br from-[var(--jade)] via-[var(--coral)] to-[var(--jade)] p-[2px]`}>
        <span className={`block ${r} bg-paper-2 p-[1.5px]`}>{face}</span>
      </span>
    ) : frame === "gold" ? (
      <span className={`relative block ${r} bg-gradient-to-br from-[var(--gold)] via-paper-2 to-[var(--gold)] p-[2px] shadow-[0_3px_12px_-4px_var(--gold)]`}>
        <span className={`block ${r} bg-paper-2 p-[1px]`}>{face}</span>
      </span>
    ) : frame === "white" ? (
      <span className={`relative block ${r} bg-white/90 p-[2px] shadow-[0_3px_10px_-4px_rgba(0,0,0,0.3)]`}>{face}</span>
    ) : frame === "solid" ? (
      <span className={`relative block ${r} bg-jade p-[2px]`}>{face}</span>
    ) : (
      face
    );
  const fs = Math.round((size * frameScale) / 100);
  return (
    <span className="relative flex shrink-0 items-center justify-center" style={diamond ? { width: size + 4, height: size + 4 } : undefined}>
      <span className={`relative block ${diamond ? "rotate-45" : ""}`}>{ringed}</span>
      {frameImg && (
        <img src={frameImg} alt="" aria-hidden style={{ width: fs, height: fs }}
          className="pointer-events-none absolute left-1/2 top-1/2 z-10 max-w-none -translate-x-1/2 -translate-y-1/2 object-contain" />
      )}
    </span>
  );
}

const CARD_CLS: Record<TopbarCardStyle, string> = {
  none: "",
  glass: "rounded-2xl border border-white/50 bg-paper/55 py-1 pl-1 pr-3 shadow-sm ring-1 ring-inset ring-white/40 backdrop-blur-md",
  pill: "rounded-full border border-line/80 bg-paper/85 py-1 pl-1 pr-3.5 shadow-sm backdrop-blur-md transition hover:border-jade/60",
  card: "rounded-xl border border-line bg-paper px-2 py-1.5 shadow-[0_6px_16px_-10px_var(--dream-glow)]",
  tag: "rounded-l-md rounded-r-full border-l-[3px] border-jade bg-gradient-to-r from-jade/20 via-paper/60 to-transparent py-1 pl-2 pr-5",
};
const BAR_BOX: Record<TopbarBarStyle, string> = {
  pill: "rounded-2xl border border-white/50 bg-paper/65 px-2.5 py-1.5 shadow-[0_4px_16px_-8px_var(--dream-glow)] ring-1 ring-inset ring-white/50 backdrop-blur-md",
  grid: "rounded-xl border border-line/80 bg-paper/75 shadow-[0_4px_14px_-10px_var(--dream-glow)] backdrop-blur-md",
  chips: "",
  minimal: "py-0.5",
  underline: "border-b-2 border-jade/45 pb-1 pt-0.5",
};
const JUSTIFY = { between: "justify-between", left: "justify-start", center: "justify-center" } as const;
type ModView = { k: TopbarModuleKey; body: ReactNode; icon?: ReactNode; grow?: boolean; noLabel?: boolean };

type Props = {
  data: TopbarData;
  diy?: TopbarDiy;
  topbar?: TopbarBg;
  topbarText?: string;
  compact?: boolean; // 横屏：压成单行
  preview?: boolean; // 美化面板里的预览：不可点击、不挂引导锚点
  /** 功能注释：作者预览只显示当前主线步骤，隐藏周数/日期/地点/金钱等模块 */
  questOnly?: boolean;
  /**
   * 功能注释：小说模式固定三行排版（名牌 / 状态 / 可展开主线），
   * 颜色与圆角只读皮肤变量，不跟 mock 色板走。
   */
  novelLayout?: boolean;
  menuOpen?: boolean;
  onProfile?: () => void;
  onMenu?: () => void;
  onEnd?: () => void;
  children?: ReactNode; // 顶栏下方附加行（置顶属性 / 世界提示 / 存档提示）
};

export default function TopbarView({ data, diy, topbar = "gradient", topbarText, compact = false, preview = false, questOnly = false, novelLayout = false, menuOpen = false, onProfile, onMenu, onEnd, children }: Props) {
  const c = resolveTopbarDiy(diy);
  // 功能注释：剧情模式主线行点开任务弹窗（与状态行一致），不再本地折叠展开
  const rules = c.active ? c.regexRules : undefined;
  const rx = (t: TopbarRegexTarget, s: string) => applyTopbarRegex(s, t, rules);
  let layout = c.layout;
  if (compact && (layout === "double" || layout === "reverse")) layout = "single";
  const small = compact || layout === "single" || layout === "statusOnly";
  const ava = compact ? Math.min(c.avatarSize, 32) : c.avatarSize; // 横屏顶栏保持原有高度
  const slogan = topbarText?.trim();
  const nameRx = rx("name", data.name);
  const apRx = rx("ap", apText(data));
  const titleMain = slogan || c.titleMain?.trim() || getWorld().chain[0]?.name || "未命名作品";

  /* —— 名牌 —— */
  const hasText = c.showName || c.showAge || c.showArchiveBtn;
  const profile = layout === "statusOnly" || (c.avatarShape === "hidden" && !hasText) ? null : (
    <Press preview={preview} label="打开人物档案" onPress={onProfile}
      className={`topbar-profile-card group relative z-10 flex min-w-0 shrink items-center text-left ${small ? "gap-2" : "gap-2.5"} ${CARD_CLS[c.cardStyle]}`}>
      <TopbarAvatar data={data} shape={c.avatarShape} frame={c.avatarFrame} size={ava} frameImg={c.active ? c.avatarFrameImg : undefined} frameScale={c.frameScale} />
      {hasText && (
        <span className="min-w-0 leading-tight">
          {(c.showName || c.showAge) && (
            <span className="flex items-center gap-1.5">
              {c.showName && (
                <span className={`truncate font-serif font-black tracking-wide text-jade-deep ${small ? "text-[14px]" : "text-[17.5px]"}`}><Rx v={nameRx} /></span>
              )}
              {c.showAge && <span className="shrink-0 rounded-full bg-jade/12 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-jade-deep">{data.age}岁</span>}
            </span>
          )}
          {c.showArchiveBtn && (small ? (
            <span className="block text-[9.5px] font-bold tracking-[0.14em] text-ink-soft group-hover:text-jade">{c.archiveText}</span>
          ) : (
            <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-white/50 bg-paper-2/65 px-2 py-0.5 text-[10px] font-bold tracking-[0.12em] text-ink-soft shadow-sm transition group-hover:border-[var(--jade)] group-hover:text-jade-deep">
              <span className="text-[6px] text-jade">●</span>
              <span>{c.archiveText}</span>
            </span>
          ))}
        </span>
      )}
    </Press>
  );

  /* —— 居中标题：有标语 → 流光渐变字；否则世界名 + 主标（窄屏收起） —— */
  const showTitle = c.showCenterTitle && (layout === "double" || layout === "reverse" || layout === "profileOnly");
  const title = !showTitle ? null : slogan ? (
    <span className="topbar-title mx-2 min-w-0 flex-1 truncate bg-gradient-to-r from-jade via-gold to-coral bg-clip-text text-center font-serif text-[15px] font-extrabold tracking-[0.16em] text-transparent">
      <Rx v={rx("title", slogan)} />
    </span>
  ) : (
    <div className="topbar-title pointer-events-none absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 flex-col items-center leading-none @min-[40rem]:flex" aria-hidden>
      <span className="font-serif text-[10.5px] font-bold tracking-[0.36em] text-ink-soft/70">{c.titleSub?.trim() || data.world}</span>
      <span className="mt-1 font-serif text-[15.5px] font-black tracking-[0.14em] text-jade-deep drop-shadow-[0_1px_6px_var(--dream-glow)]">
        <Rx v={rx("title", titleMain)} />
      </span>
    </div>
  );

  /* —— 右侧：行动点胶囊 + 结束 + 菜单（菜单始终保留，免得自定义后打不开） —— */
  const actions = (
    <div className="topbar-actions relative z-10 ml-auto flex shrink-0 items-center gap-2">
      {c.apRight && data.ap != null && (
        <div data-tour={preview ? undefined : "ap"} title="行动点：每回合回满，换地点扣点"
          className="topbar-ap flex items-center gap-1.5 rounded-full border border-white/55 bg-paper/75 px-2.5 py-1.5 shadow-[0_3px_10px_-4px_var(--dream-glow)] ring-1 ring-inset ring-white/40 backdrop-blur-sm">
          <span className="text-[10px] font-bold tracking-wider text-jade-deep">行动</span>
          <span className={`font-serif text-[13.5px] font-black leading-none tabular-nums ${data.apLow ? "text-danger" : "text-ink"}`}>
            {apRx.changed ? <Rx v={apRx} /> : <>{data.ap}<span className="text-[10px] font-normal text-ink-soft">/{data.apMax}</span></>}
          </span>
        </div>
      )}
      {c.showEndBtn && (
        <Press preview={preview} label="结束游戏" title="结束游戏 / 结算结局" onPress={onEnd}
          className="diy-btn flex h-9 w-9 items-center justify-center rounded-full border border-white/55 bg-paper/75 text-[15px] text-ink-soft shadow-[0_3px_10px_-4px_var(--dream-glow)] ring-1 ring-inset ring-white/40 backdrop-blur-sm transition hover:border-danger/50 hover:text-danger">
          <DiyIcon slot="top.flag" size={16}><IconFlag width={15} height={15} /></DiyIcon>
        </Press>
      )}
      <Press preview={preview} label="牌坊菜单" expanded={menuOpen} onPress={onMenu}
        className={`diy-btn flex h-9 w-9 items-center justify-center rounded-full text-[16px] font-bold shadow-[0_3px_10px_-4px_var(--dream-glow)] ring-1 ring-inset transition ${
          menuOpen
            ? "border border-transparent bg-gradient-to-br from-[var(--jade)] to-[var(--coral)] text-white ring-white/40"
            : "border border-white/55 bg-paper/75 text-jade-deep ring-white/40 backdrop-blur-sm hover:border-jade/50 hover:text-jade"
        }`}>
        {/* 功能注释：必须有默认菜单图标；DIY 未换图时若无 children 会变成空白圆按钮 */}
        <DiyIcon slot="top.menu" size={18}><IconMenu width={17} height={17} /></DiyIcon>
      </Press>
    </div>
  );

  /* —— 状态栏模块 —— */
  const ic = c.showIcons;
  const mv = (k: TopbarModuleKey): ModView | null => {
    switch (k) {
      case "week":
        return {
          k, noLabel: true,
          body: <span className="topbar-week whitespace-nowrap rounded-full bg-gradient-to-r from-[var(--jade)] to-[var(--coral)] px-2 py-0.5 text-[0.875em] font-bold leading-tight text-white shadow-sm"><Rx v={rx("week", data.week)} /></span>,
        };
      case "date":
        return { k, icon: ic && <span className="shrink-0 text-jade"><CalGlyph /></span>, body: <span className="whitespace-nowrap font-semibold tabular-nums"><Rx v={rx("date", data.date)} /></span> };
      case "location":
        return { k, grow: true, icon: ic && <IconPin width={13} height={13} className="shrink-0 text-coral" />, body: <span className="truncate font-semibold"><Rx v={rx("location", data.location)} /></span> };
      case "weather":
        return data.weather
          ? { k, icon: ic && <span className="shrink-0 text-gold"><CloudGlyph /></span>, body: <span className="whitespace-nowrap font-semibold"><Rx v={rx("weather", data.weather)} /></span> }
          : null;
      case "money":
        return data.money != null
          ? {
            k,
            icon: ic && <IconWallet width={13} height={13} className={`shrink-0 ${data.negative ? "text-danger" : "text-jade"}`} />,
            body: <span className={`whitespace-nowrap text-[1.04em] font-bold tabular-nums ${data.negative ? "text-danger" : ""}`}><Rx v={rx("money", data.money)} /></span>,
          }
          : null;
      case "days": {
        if (data.daysLeft == null) return null;
        const v = rx("days", daysText(data));
        return {
          k,
          icon: ic && <IconClock width={13} height={13} className="shrink-0 text-coral" />,
          body: <span className="whitespace-nowrap">{v.changed ? <Rx v={v} /> : <>主线剩 <b className="tabular-nums text-coral">{data.daysLeft}</b> 天</>}</span>,
        };
      }
      case "ap":
        return data.ap != null
          ? {
            k, noLabel: true,
            body: (
              <span data-tour={!preview && !c.apRight ? "ap" : undefined} className="flex items-center gap-1 whitespace-nowrap">
                <span className="rounded-full bg-jade/15 px-1.5 py-0.5 text-[0.8em] font-bold leading-none text-jade">行动</span>
                <span className={`font-semibold tabular-nums ${data.apLow ? "text-danger" : ""}`}>
                  {apRx.changed ? <Rx v={apRx} /> : <>{data.ap}<span className="text-[0.85em] font-normal text-ink-soft">/{data.apMax}</span></>}
                </span>
              </span>
            ),
          }
          : null;
    }
  };
  const mods = questOnly ? [] : c.modules.filter((k) => !c.hidden[k]).map(mv).filter((m): m is ModView => !!m);
  const inRow = layout === "single" || layout === "statusOnly" || layout === "reverse";
  // 功能注释：状态行（周数/日期/地点/天气/金钱）点开任务主线弹窗，不再跳人物档案
  const openQuest = () => {
    if (preview) return;
    window.dispatchEvent(new CustomEvent("star:quest-open"));
  };
  const barEvents = preview ? {} : {
    role: "button" as const, tabIndex: 0, "aria-label": "打开任务主线",
    onClick: (e: MouseEvent<HTMLDivElement>) => { e.stopPropagation(); openQuest(); },
    onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openQuest(); } },
  };
  const label = (m: ModView) => c.showLabels && !m.noLabel && <span className="shrink-0 text-[0.82em] font-semibold text-ink-soft">{MODULE_LABELS[m.k]}</span>;
  const base = `topbar-status-bar relative cursor-pointer text-[12px] text-ink ${inRow ? "min-w-0 flex-1" : ""}`;
  const raw = !questOnly && rules?.some((r) => r.enabled && r.target === "rawBar") ? rx("rawBar", rawBarText(data)) : null;
  const style = c.barStyle;
  let bar: ReactNode = null;
  // 功能注释：作者预览状态栏只留当前主线步骤，不展示周数/日期/地点/金钱/倒计时；不再展示「局势」摘要
  if (questOnly && layout !== "profileOnly") {
    const step = data.questStep?.trim();
    bar = step ? (
      <button
        type="button"
        data-tour="topbar-quest"
        onClick={(e) => {
          e.stopPropagation();
          openQuest();
        }}
        className={`${base} ${BAR_BOX[style]} flex w-full min-w-0 items-center gap-2 text-left`}
      >
        <span className="shrink-0 rounded-full bg-coral px-2 py-0.5 text-[10px] font-black tracking-[0.14em] text-white">主线</span>
        <span className="min-w-0 flex-1 truncate font-semibold text-ink">{step}</span>
        <IconFlag width={13} height={13} className="shrink-0 text-coral" aria-hidden />
      </button>
    ) : null;
  } else if (layout !== "profileOnly" && (mods.length || raw?.changed)) {
    if (raw?.changed) {
      bar = <div {...barEvents} className={`${base} ${BAR_BOX[style]} flex items-center overflow-hidden`} dangerouslySetInnerHTML={{ __html: raw.html }} />;
    } else if (style === "grid") {
      bar = (
        <div {...barEvents} className={`${base} ${BAR_BOX.grid} grid auto-cols-fr grid-flow-col divide-x divide-line/70 overflow-hidden`}>
          {mods.map((m) => (
            <div key={m.k} className="flex min-w-0 flex-col items-center justify-center gap-0.5 px-1.5 py-1">
              {c.showLabels && !m.noLabel && <span className="text-[0.78em] font-bold tracking-[0.12em] text-ink-soft">{MODULE_LABELS[m.k]}</span>}
              <span className="flex min-w-0 max-w-full items-center gap-1">{m.icon}{m.body}</span>
            </div>
          ))}
        </div>
      );
    } else if (style === "chips") {
      bar = (
        <div {...barEvents} className={`${base} flex flex-wrap items-center gap-1.5 ${JUSTIFY[c.align]}`}>
          {mods.map((m) => (
            <span key={m.k} className={`topbar-chip flex items-center gap-1 rounded-full border border-white/55 bg-paper/75 px-2.5 py-1 shadow-[0_3px_10px_-4px_var(--dream-glow)] ring-1 ring-inset ring-white/40 backdrop-blur-sm ${m.grow ? "min-w-0 shrink" : "shrink-0"}`}>
              {label(m)}{m.icon}{m.body}
            </span>
          ))}
        </div>
      );
    } else {
      const sep =
        style === "pill" ? <span className="h-3.5 w-px shrink-0 bg-line/80" aria-hidden />
        : style === "minimal" ? <span className="shrink-0 text-ink-soft/50" aria-hidden>·</span>
        : <span className="h-3 w-px shrink-0 bg-jade/30" aria-hidden />;
      const padL = style === "pill" ? "pl-2.5" : "pl-1.5";
      const padR = style === "pill" ? "pr-2.5" : "pr-1.5";
      bar = (
        <div {...barEvents} className={`${base} ${BAR_BOX[style]} flex flex-wrap items-center gap-y-1 ${JUSTIFY[c.align]}`}>
          {mods.map((m, i) => {
            // 周数紧挨日期时合成一组（与默认顶栏一致），不加分隔
            const glued = i > 0 && mods[i - 1].k === "week" && m.k === "date";
            const gluedNext = m.k === "week" && mods[i + 1]?.k === "date";
            const l = i === 0 ? "pl-0" : glued ? "pl-1.5" : padL;
            const r = i === mods.length - 1 || gluedNext ? "pr-0" : padR;
            return (
              <Fragment key={m.k}>
                {i > 0 && !glued && sep}
                <span className={`flex items-center gap-1 ${l} ${r} ${m.grow ? "min-w-0" : "shrink-0"}`}>
                  {label(m)}{m.icon}{m.body}
                </span>
              </Fragment>
            );
          })}
        </div>
      );
    }
  }

  /* —— 版式组合 —— */
  const row = (kids: ReactNode, cls = "") => <div className={`relative flex items-center justify-between gap-2 ${cls}`}>{kids}</div>;
  let body: ReactNode;
  // 功能注释：小说模式固定排版优先于 DIY 模板，保证验收结构一致；色值仍走皮肤 CSS 变量
  if (novelLayout && !compact && !questOnly) {
    const weekLabel = `第${String(data.weekNum).padStart(2, "0")}周`;
    const pct = Math.round(Math.min(1, Math.max(0, data.questProgress ?? 0)) * 100);
    const hasQuest = !!(data.questStep?.trim());
    const novelMenu = (
      <Press preview={preview} label="牌坊菜单" expanded={menuOpen} onPress={onMenu}
        className={`diy-btn flex h-9 w-9 items-center justify-center rounded-[var(--radius-ui-sm)] border border-line bg-paper text-[16px] font-bold text-ink shadow-[var(--shadow-ui)] transition ${
          menuOpen ? "bg-jade text-paper-2" : "hover:border-jade hover:text-jade"
        }`}>
        <DiyIcon slot="top.menu" size={18}><IconMenu width={17} height={17} /></DiyIcon>
      </Press>
    );
    const novelProfile = (
      <Press preview={preview} label="打开人物档案" onPress={onProfile}
        className="topbar-profile-card group relative z-10 flex min-w-0 shrink items-center gap-2.5 text-left">
        <TopbarAvatar data={data} shape={c.avatarShape === "hidden" ? "circle" : c.avatarShape} frame={c.avatarFrame} size={ava}
          frameImg={c.active ? c.avatarFrameImg : undefined} frameScale={c.frameScale} />
        <span className="min-w-0 leading-tight">
          <span className="flex items-center gap-1.5">
            <span className="truncate font-serif text-[16px] font-black tracking-wide text-ink"><Rx v={nameRx} /></span>
            <span className="shrink-0 text-[12px] font-semibold tabular-nums text-ink-soft">{data.age}岁</span>
          </span>
          <span className="mt-0.5 block text-[11px] font-medium text-ink-soft group-hover:text-jade">
            {c.archiveText?.replace(/[›>]\s*$/, "").trim() || "查看档案"}
            <span aria-hidden className="ml-0.5">›</span>
          </span>
        </span>
      </Press>
    );
    const questTitle = data.questLineName?.trim() || data.questStep?.trim() || "当前主线";
    body = (
      <div className="novel-topbar mb-1 flex flex-col gap-2" data-layout="novel">
        {row(<>{novelProfile}{novelMenu}</>)}
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-ink">
          <span className="rounded-[var(--radius-ui-sm)] bg-jade px-2 py-0.5 text-[11px] font-bold tabular-nums text-paper-2">{weekLabel}</span>
          <span className="font-semibold tabular-nums text-ink-soft">{data.date}</span>
          <span className="ml-auto flex items-center gap-3">
            {data.ap != null && (
              <span data-tour={preview ? undefined : "ap"} className="tabular-nums text-ink">
                行动 <b className={data.apLow ? "text-danger" : ""}>{data.ap}</b>
                <span className="text-ink-soft">/{data.apMax}</span>
              </span>
            )}
            {data.money != null && (
              <span className={`inline-flex items-center gap-1 font-bold tabular-nums ${data.negative ? "text-danger" : "text-ink"}`}>
                <IconWallet width={12} height={12} className="shrink-0 text-ink-soft" aria-hidden />
                {data.money}
              </span>
            )}
          </span>
        </div>
        {/* 功能注释：主线行加高；点开派发任务弹窗，与状态行同一入口 */}
        <div className="novel-quest">
          <button
            type="button"
            data-tour="topbar-quest"
            aria-label="打开任务主线"
            onClick={(e) => {
              e.stopPropagation();
              openQuest();
            }}
            className="flex w-full items-center gap-2.5 rounded-[var(--radius-ui)] border border-line bg-paper/90 px-3 py-2.5 text-left shadow-[var(--shadow-ui)] transition hover:border-jade/40"
          >
            <span className="min-w-0 shrink truncate text-[13.5px] font-bold leading-snug text-ink">
              {questTitle}
            </span>
            <span className={`relative h-1.5 min-w-[3.5rem] flex-1 overflow-hidden rounded-full bg-line ${hasQuest ? "" : "opacity-40"}`} aria-hidden>
              <span className="absolute inset-y-0 left-0 rounded-full bg-jade" style={{ width: `${hasQuest ? pct : 0}%` }} />
            </span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="shrink-0 text-ink-soft" aria-hidden>
              <path d="m9 6 6 6-6 6" />
            </svg>
          </button>
        </div>
      </div>
    );
  } else {
  // 功能注释：questOnly 时禁用自定义 HTML 模板，避免又把周数/金钱渲回来
  const tpl = !questOnly && c.active && c.templateOn && c.customHtml?.trim() ? c.customHtml : "";
  if (tpl) {
    const vars: Record<string, RxOut | string> = {
      name: nameRx, age: String(data.age), avatar: data.avatar ? AVATAR_TOKEN : "", initial: data.initial,
      avatarImg: {
        text: "", changed: true,
        html: data.avatar ? `<img class="tb-ava" src="${AVATAR_TOKEN}" alt="">` : `<span class="tb-ava tb-ava-ph">${escapeHtml(data.initial)}</span>`,
      },
      week: rx("week", data.week), weekNum: data.weekNum, date: rx("date", data.date), time: data.time,
      location: rx("location", data.location), weather: rx("weather", data.weather ?? ""), money: rx("money", data.money ?? ""),
      ap: apRx, apMax: data.apMax != null ? String(data.apMax) : "", days: rx("days", daysText(data)), world: data.world, title: rx("title", titleMain),
    };
    const html = renderTopbarTemplate(tpl, vars, data.avatar);
    const hasMenu = /data-action\s*=\s*["']?menu\b/i.test(html);
    // data-action：profile（默认）/ menu / end / schedule / none
    const tplEvents = preview ? {} : {
      role: "button" as const, tabIndex: 0, "aria-label": "顶栏，点按查看人物档案",
      onClick: (e: MouseEvent<HTMLDivElement>) => {
        const a = (e.target as HTMLElement).closest<HTMLElement>("[data-action]")?.dataset.action;
        if (a === "none") return;
        if (a === "menu") onMenu?.();
        else if (a === "end") onEnd?.();
        else if (a === "schedule") window.dispatchEvent(new Event("star:navschedule"));
        else onProfile?.();
      },
      onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => { if (e.key === "Enter") onProfile?.(); },
    };
    body = row(<>
      <div {...tplEvents} className="tb-tpl min-w-0 flex-1 cursor-pointer" dangerouslySetInnerHTML={{ __html: html }} />
      {(c.keepActions || !hasMenu) && actions}
    </>, "gap-3");
  } else if (layout === "reverse") {
    body = <>
      {row(<>{bar ?? <span className="flex-1" />}{actions}</>, "gap-3")}
      {(profile || title) && row(<>{profile}{title}</>, "mt-2 min-h-9")}
    </>;
  } else if (layout === "single") {
    body = row(<>{profile}{bar}{actions}</>, "gap-3");
  } else if (layout === "statusOnly") {
    body = row(<>{bar ?? <span className="flex-1" />}{actions}</>, "gap-3");
  } else if (layout === "profileOnly") {
    body = row(<>{profile}{title}{actions}</>);
  } else {
    body = <>
      {row(<>{profile}{title}{actions}</>)}
      {/* 功能注释：状态行上移，贴紧名牌行，减少与场景图之间的空档 */}
      {bar && <div className="mt-1">{bar}</div>}
    </>;
  }
  }

  const Tag = preview ? "div" : "header";
  return (
    <Tag
      {...(preview ? { "aria-hidden": true, inert: true } : {})}
      className={`app-topbar @container relative w-full shrink-0 select-none overflow-hidden border-b border-line/80 bg-gradient-to-b from-paper-2/95 via-paper-2/88 to-paper-2/95 shadow-[0_6px_18px_-14px_rgba(120,90,200,0.5)] backdrop-blur-xl ${preview ? "" : "z-20"} ${compact ? "app-topbar-land" : ""}`}
    >
      {/* 背景效果：流光渐变 / 极光幻彩 / 简约纯色 */}
      {topbar === "gradient" && (<>
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,color-mix(in_srgb,var(--jade)_22%,transparent)_0%,transparent_45%,color-mix(in_srgb,var(--coral)_22%,transparent)_100%)]" />
        <div aria-hidden className="pointer-events-none absolute -left-8 -top-10 h-24 w-24 rounded-full bg-jade/25 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -right-6 -top-8 h-20 w-20 rounded-full bg-coral/25 blur-3xl" />
      </>)}
      {topbar === "aurora" && (<>
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-r from-jade/35 via-coral/25 to-gold/30" />
        <div aria-hidden className="pointer-events-none absolute -left-10 -top-12 h-32 w-40 rounded-full bg-coral/35 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -right-10 -bottom-12 h-32 w-40 rounded-full bg-jade/35 blur-3xl" />
      </>)}
      {topbar !== "plain" && <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-line to-transparent" />}
      <div className={`topbar-inner relative ${compact ? "px-4 py-1.5" : "mx-auto max-w-3xl px-3.5 py-1.5 @min-[40rem]:px-5"}`}>
        {body}
      </div>
      {children}
    </Tag>
  );
}
