import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type SVGProps,
} from "react";
import { createPortal, flushSync } from "react-dom";
import { useGame } from "../store/gameCtx";
import {
  dimsGrade,
  endingPillars,
  lifeGrade,
  secondaryTitleOf,
  type SubGradeCard,
} from "../game/grade";
import { dayDateLabel } from "../game/logic";
import { getWorld } from "../mods/registry";
import { GLYPHS } from "../lib/iconGlyphs";
import { IconCamera, IconClose, IconSave, IconShare, IconHeart } from "../lib/icons";
import {
  GRADE_DIM_ICONS,
  TIME_UNIT_LABEL,
  type GameState,
  type Npc,
} from "../lib/types";
import { CoverFx } from "./Cover";

/* 结局评定页：粉白少女感的结局评定卡。竖屏 9:16 单列滚动；横屏 16:9 左侧主视觉 + 右侧评定双栏（窄屏自动回落单列）。
 * 文案全部取自存档里的结局结算（自定义结局 / 默认定级 / 后记），缺省时按评级、时长与人物动态生成；
 * 图片只用本局已有素材（结局主视觉 / 结局插图 / 已解锁 CG / 头像），一张加载失败就换下一张，都没有时用渐变占位。 */

const MASCOT = "兔兔";
const KIND: Record<string, string> = {
  manual: "亲手落幕",
  ai: "命运落幕",
  bankrupt: "破产落幕",
  finish: "时光期满",
};
/* 功能注释：维度卡底色 / 描边由主题色派生（跟随皮肤与深浅），不再用固定粉白色值 */
const toneOf = (c: string) => ({
  bg: `color-mix(in srgb, ${c} 12%, var(--e-card))`,
  line: `color-mix(in srgb, ${c} 38%, var(--e-card))`,
});
const CARD_TONE: Record<string, { bg: string; line: string }> = {
  heart: toneOf("var(--coral)"),
  star: toneOf("var(--jade)"),
  leaf: toneOf("var(--jade)"),
  book: toneOf("var(--jade)"),
  crown: toneOf("var(--gold)"),
  note: toneOf("var(--coral)"),
};

type Tone = CSSProperties & { "--tag"?: string };

const uniq = (xs: (string | undefined)[]) => [
  ...new Set(xs.filter((x): x is string => !!x?.trim())),
];
const metBefore = (n: Npc) =>
  (n.interactions?.length ?? 0) > 0 || (n.affinityHistory?.length ?? 0) > 0;

function Glyph({ name, ...p }: { name: string } & SVGProps<SVGSVGElement>) {
  const C = GLYPHS[name]?.C;
  return C ? <C aria-hidden {...p} /> : null;
}

/* 「S+」→ S 与上标 + */
function GradeLetter({ g }: { g: string }) {
  const m = /^(.*?)(\+*)$/.exec(g);
  return (
    <>
      {m?.[1] || g}
      {m?.[2] ? <sup className="end-plus">{m[2]}</sup> : null}
    </>
  );
}

function Crown({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg viewBox="0 0 48 38" className={className} style={style} aria-hidden>
      <path
        d="M6 13 15 21 24 7l9 14 9-8-4 18H10z"
        fill="#ffd56c"
        stroke="#e3a33b"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M11 27h26"
        stroke="#f6bf4f"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle
        cx="6"
        cy="12"
        r="3"
        fill="#ffe08c"
        stroke="#e3a33b"
        strokeWidth="1.5"
      />
      <circle
        cx="24"
        cy="6"
        r="3.3"
        fill="#ffe08c"
        stroke="#e3a33b"
        strokeWidth="1.5"
      />
      <circle
        cx="42"
        cy="12"
        r="3"
        fill="#ffe08c"
        stroke="#e3a33b"
        strokeWidth="1.5"
      />
      <circle cx="24" cy="21" r="2.6" fill="#f47aa7" />
    </svg>
  );
}

function Wing({ side }: { side: "l" | "r" }) {
  return (
    <svg
      viewBox="0 0 80 60"
      className={`end-wing end-wing-${side}`}
      aria-hidden
    >
      <g fill="#fff" stroke="#ecd2e2" strokeWidth="2" strokeLinejoin="round">
        <path d="M76 40C62 45 44 50 24 46c12 10 34 12 52 0z" />
        <path d="M76 35C60 38 36 37 12 30c16 16 42 19 64 10z" />
        <path d="M76 30C58 30 30 25 4 10c16 23 46 31 72 25z" />
      </g>
      <path
        d="M70 31C54 30 34 25 18 18M70 37c-14 1-30 0-44-4"
        fill="none"
        stroke="#f3dfeb"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* 没有评定人头像时的吉祥物 */
function Mascot() {
  return (
    <svg
      viewBox="0 0 120 132"
      className="h-full w-full"
      role="img"
      aria-label={MASCOT}
    >
      <g transform="rotate(-12 42 36)">
        <ellipse
          cx="42"
          cy="36"
          rx="13"
          ry="31"
          fill="#fff"
          stroke="#f2c8d8"
          strokeWidth="3"
        />
        <ellipse cx="42" cy="38" rx="6" ry="21" fill="#ffd4e3" />
      </g>
      <g transform="rotate(12 78 36)">
        <ellipse
          cx="78"
          cy="36"
          rx="13"
          ry="31"
          fill="#fff"
          stroke="#f2c8d8"
          strokeWidth="3"
        />
        <ellipse cx="78" cy="38" rx="6" ry="21" fill="#ffd4e3" />
      </g>
      <ellipse
        cx="60"
        cy="88"
        rx="45"
        ry="39"
        fill="#fff"
        stroke="#f2c8d8"
        strokeWidth="3"
      />
      <path
        d="M39 85q6-7 12 0M69 85q6-7 12 0"
        fill="none"
        stroke="#7a4a5c"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <ellipse cx="36" cy="98" rx="7.5" ry="4.5" fill="#ffc2d6" />
      <ellipse cx="84" cy="98" rx="7.5" ry="4.5" fill="#ffc2d6" />
      <path
        d="M53 97q7 8 14 0z"
        fill="#ff93b6"
        stroke="#7a4a5c"
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      <path d="M60 54 45 46v16zM60 54l15-8v16z" fill="#f78fb4" />
      <circle cx="60" cy="54" r="4.2" fill="#ee6b9b" />
    </svg>
  );
}

function Tag({
  children,
  tone,
  className = "",
}: {
  children: ReactNode;
  tone: string;
  className?: string;
}) {
  return (
    <span className={`end-tag ${className}`} style={{ "--tag": tone } as Tone}>
      {children}
    </span>
  );
}

/* —— 结局数据：只读存档字段，缺省时动态生成 —— */
const durationOf = (g: GameState) => {
  const tl = g.timeLimit;
  if (g.endingKind === "finish" && tl && !tl.endDate && tl.value > 0)
    return `${tl.value} ${TIME_UNIT_LABEL[tl.unit]}`;
  const d = Math.max(1, Math.round(g.sim.day ?? 1));
  if (d >= 365) {
    const y = Math.floor(d / 365);
    const m = Math.floor((d % 365) / 30);
    return m ? `${y} 年 ${m} 个月` : `${y} 年`;
  }
  return d >= 60 ? `${Math.floor(d / 30)} 个月` : `${d} 天`;
};

const latestCg = (g: GameState) => {
  const ids = Object.keys(g.cgUnlocked ?? {}); // 按解锁先后排列
  for (let i = ids.length - 1; i >= 0; i--) {
    const cg = g.cgs?.find((c) => c.id === ids[i] && c.image);
    if (cg) return cg.image;
  }
  return undefined;
};

const autoComment = (
  grade: string,
  name: string,
  title: string,
  sub: string,
) => {
  const t = `「${title}」`;
  if (grade.startsWith("S"))
    return `${name}，这是闪闪发光的结局！${t}真的很适合你，还一起拿下了「${sub}」。我会一直记得这段日子，以后也要继续幸福哦`;
  if (grade === "A")
    return `走到这里真的很了不起！${t}是你一步一步写出来的答案，我一直都在为你骄傲`;
  if (grade === "B")
    return `辛苦啦，${name}。路上有过迷茫，也有过遗憾，但${t}里的每一天都很真实，下一次一定会更好。`;
  return `谢谢你没有放弃，${name}。${t}不是终点，下一段故事会温柔地等着你`;
};

function buildEnding(g: GameState) {
  const pillars = endingPillars(g.sim, g.gradeDims, g.journal?.length ?? 0);
  const grade =
    g.endingGrade ??
    (g.gradeDims?.length ? dimsGrade(g.sim, g.gradeDims) : lifeGrade(g.sim)); // 旧存档没有评级时现算
  const name = g.player.name || "她";
  const title = g.endingTitle?.trim() || "故事落幕";
  const sub = g.endingSubTitle?.trim() || secondaryTitleOf(g.sim, pillars);
  const quote = g.endingQuote?.trim() || g.endingTag?.trim() || "";
  const badge = g.endingBadge?.trim() || "结局达成";
  const kind = KIND[g.endingKind ?? ""] ?? "故事落幕";
  const day = Math.max(1, Math.round(g.sim.day ?? 1));
  const date = dayDateLabel(day);
  const dur = durationOf(g);
  const worldName = getWorld().chain[0]?.name ?? "";
  const paras = (g.epilogue || "")
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const words = (g.epilogue || "").replace(/\s/g, "").length;

  // 评定人：指定署名（同名人物带出头像）→ 见过面且好感最高的人物 → 吉祥物
  const by = g.endingCommentBy?.trim();
  const npc = by
    ? g.npcs.find((n) => n.name === by)
    : g.npcs
        .filter((n) => n.affinity > 0 && metBefore(n))
        .sort((a, b) => b.affinity - a.affinity)[0];
  const commenter = by || npc?.name || MASCOT;
  const commenterImgs = uniq([
    g.endingCommentAvatar,
    npc?.portrait,
    npc?.avatar,
  ]);
  const comment =
    g.endingComment?.trim() || autoComment(grade.grade, name, title, sub);

  // 与编辑器约定一致——主视觉：结局主视觉 → 主角头像 → 结局插图 → 最近解锁的 CG；
  // 拍立得：结局插图 → 最近解锁的 CG → 主角头像（跳过已作主视觉的那张）
  const cg = latestCg(g);
  const heroImgs = uniq([g.endingHero, g.player.avatar, g.endingImage, cg]);
  const photoImgs = uniq([g.endingImage, cg, g.player.avatar]);

  const shareText = [
    `我在${
      worldName ? `「${worldName}」` : "游戏"
    }里迎来了结局：${badge}「${title}」`,
    sub ? `同时获得：${sub}` : "",
    `总体评级 ${grade.grade}（${grade.score} 分 · ${grade.verdict}）`,
    pillars.length
      ? pillars.map((p) => `${p.label} ${p.grade}`).join(" / ")
      : "",
    quote ? `『${quote}』` : "",
    `—— ${name} · ${dur} · ${date}`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    pillars,
    grade,
    name,
    title,
    sub,
    quote,
    badge,
    kind,
    day,
    date,
    dur,
    worldName,
    paras,
    words,
    commenter,
    commenterImgs,
    portrait: npc?.portrait,
    comment,
    heroImgs,
    heroFixed: g.endingHero,
    photoImgs,
    shareText,
  };
}

/* 剪贴板不可用（如嵌入式预览）时的兜底复制 */
const legacyCopy = (text: string) => {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  ta.remove();
  return ok;
};

/* —— 导出 PNG：离屏再渲染一份固定竖版的结局卡（不含按钮 / 动画），用 SnapDOM 截成图片 —— */
type Snap = {
  broken: string[]; // 页面上已失败 + 跨域读不到的图片，导出卡直接换下一候选
  heroSize: { src: string; w: number } | null;
};
type Shot = {
  of: unknown; // 生成时的结局数据；数据或画面变了就重新生成
  key: string;
  url: string;
  name: string;
  file: File | null; // 系统分享面板能接收图片时才有
  lost: boolean; // 有图片没能画进去（换了候选 / 默认画框）
};

const SNAP_W = 540; // 导出卡片的排版宽度（CSS px），按 2 倍输出 1080px 宽

const wait = (ms: number) =>
  new Promise<void>((r) => window.setTimeout(r, ms));

/* 跨域又没开放 CORS 的图片读不出像素，截图里只会剩灰色占位；先探一遍，读不到的交给导出卡换下一候选 / 默认画框 */
async function unreadable(srcs: string[]) {
  const bad = await Promise.all(
    srcs.map(async (s) => {
      let u: URL;
      try {
        u = new URL(s, window.location.href);
      } catch {
        return s;
      }
      if (
        u.protocol === "data:" ||
        u.protocol === "blob:" ||
        u.origin === window.location.origin
      )
        return null;
      const ctl = new AbortController();
      const t = window.setTimeout(() => ctl.abort(), 10000);
      try {
        const r = await fetch(u.href, {
          mode: "cors",
          credentials: "omit",
          signal: ctl.signal,
        });
        return r.ok && (await r.blob()).size > 0 ? null : s;
      } catch {
        return s;
      } finally {
        window.clearTimeout(t);
      }
    }),
  );
  return bad.filter((s): s is string => !!s);
}

/* 等两帧让 portal 排好版；后台标签页不跑 rAF，所以兜个超时 */
const frames = () =>
  Promise.race([
    new Promise<void>((r) =>
      requestAnimationFrame(() => requestAnimationFrame(() => r())),
    ),
    wait(300),
  ]);

/* 等离屏卡片排版稳定：图片加载解码完、字体就绪；图片失败会换下一张、量到大图会改铺满，所以多轮直到不再变化（总共最多等 15 秒） */
async function settle(root: HTMLElement) {
  let late = false;
  const deadline = wait(15000).then(() => {
    late = true;
  });
  let last = "";
  for (let i = 0; i < 8 && !late; i++) {
    await frames();
    await Promise.race([
      Promise.all(
        [...root.querySelectorAll("img")].map((im) =>
          im.decode().catch(() => undefined),
        ),
      ),
      deadline,
    ]);
    await Promise.race([document.fonts.ready, deadline]);
    await wait(60); // 留给 onLoad / onError 触发的重渲染
    const sig = `${[...root.querySelectorAll("img")]
      .map((im) => `${im.currentSrc}:${im.complete}`)
      .join("|")}#${root.offsetHeight}`;
    if (sig === last) return;
    last = sig;
  }
}

// 按字符截断，名字里带 emoji 也不会切出半个字
const fileStem = (d: { name: string; title: string }) =>
  Array.from(
    `结局评定_${d.name}_${d.title}`
      .replace(/[\\/:*?"<>|\s]+/g, "_")
      .replace(/_+/g, "_"),
  )
    .slice(0, 60)
    .join("");

const saveFile = (url: string, name: string) => {
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
};

const canShareFile = (f: File) => {
  try {
    return (
      typeof navigator.share === "function" &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [f] })
    );
  } catch {
    return false;
  }
};

function PillarCard({ c }: { c: SubGradeCard }) {
  const meta = GRADE_DIM_ICONS[c.icon] ?? GRADE_DIM_ICONS.star;
  const tone = CARD_TONE[c.icon] ?? CARD_TONE.star;
  const solid = meta.glyph !== "music"; // 音符是开放路径，只描边不填充
  return (
    <div
      className="rounded-2xl border-[1.5px] px-2 pb-3 pt-2.5 text-center"
      style={{ background: tone.bg, borderColor: tone.line }}
      title={c.detail}
    >
      <p className="flex items-center justify-center gap-1 text-[13px] font-bold text-[var(--e-ink)]">
        <Glyph
          name={meta.glyph}
          width={16}
          height={16}
          strokeWidth={1.8}
          style={{ color: meta.color }}
          fill={solid ? meta.color : "none"}
          fillOpacity={0.3}
        />
        <span className="truncate">{c.label}</span>
      </p>
      <p
        className="end-round end-outline-sm mt-1.5 text-[40px] leading-none"
        style={{ color: meta.color }}
      >
        <GradeLetter g={c.grade} />
      </p>
      <div
        className="mt-2 flex justify-center gap-[3px]"
        role="img"
        aria-label={`${c.label} ${c.grade}，${c.stars} / 5`}
      >
        {Array.from({ length: 5 }, (_, i) => {
          const on = i < c.stars;
          return (
            <Glyph
              key={i}
              name={meta.glyph}
              width={15}
              height={15}
              strokeWidth={on && !solid ? 2.2 : 1.6}
              style={{ color: on ? meta.color : "#e2d1d9" }}
              fill={solid ? (on ? meta.color : "#f8eff3") : "none"}
              fillOpacity={on ? 0.85 : 1}
            />
          );
        })}
      </div>
      <p className="mt-1.5 truncate text-[10.5px] tabular-nums text-[var(--e-soft)]">
        {c.detail}
      </p>
    </div>
  );
}

/* snap：导出 PNG 时离屏渲染的那一份（固定竖版、无按钮 / 动画 / 弹层），只在本组件内部使用 */
export default function Ending({ snap }: { snap?: Snap }) {
  const { game, go, look } = useGame();
  const [full, setFull] = useState(!!snap); // 导出卡始终带完整后记
  const [toast, setToast] = useState("");
  const [manual, setManual] = useState("");
  const [broken, setBroken] = useState<string[]>(snap?.broken ?? []); // 加载失败的图片，跳到下一候选
  const [heroSize, setHeroSize] = useState<{ src: string; w: number } | null>(
    snap?.heroSize ?? null,
  );
  const [staging, setStaging] = useState<Snap | null>(null); // 正在离屏渲染的导出卡
  const [shot, setShot] = useState<Shot | null>(null); // 最近一次导出的 PNG
  const [shotOpen, setShotOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const running = useRef(false);
  const alive = useRef(true);
  const data = useMemo(() => (game ? buildEnding(game) : null), [game]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (!shot) return;
    const { url } = shot;
    return () => {
      window.setTimeout(() => URL.revokeObjectURL(url), 1000); // 晚一点回收，别打断刚发起的下载
    };
  }, [shot]);

  if (!game || !data) return null;
  const d = data;
  const landscape = !snap && look.orient === "landscape";
  const usable = (s: string) => !broken.includes(s);
  const fail = (s: string) => () =>
    setBroken((b) => (b.includes(s) ? b : [...b, s]));
  const heroSrc = d.heroImgs.find(usable);
  // 功能注释：纪念照优先用与主视觉不同的图；只有一张可用图时宁可与主视觉重复，也不留空相框（3.15）
  const photo =
    d.photoImgs.find((s) => s !== heroSrc && usable(s)) ??
    d.photoImgs.find(usable) ??
    heroSrc;
  const commenterImg = d.commenterImgs.find(usable);
  const commenterFit =
    commenterImg && commenterImg === d.portrait
      ? "object-contain object-bottom"
      : "object-cover object-top";
  // 作者指定的结局主视觉直接铺满；其余图片先放进拱形画框，量到原图够大再铺满（小头像不会被拉糊）
  const wide =
    !!heroSrc &&
    (heroSrc === d.heroFixed ||
      (heroSize?.src === heroSrc && heroSize.w >= 900));
  const preview = d.paras.slice(0, 3);
  const folded = !full && (d.paras.length > 3 || d.words > 160);
  const titleSize =
    d.title.length <= 4
      ? "clamp(36px, 11cqw, 62px)"
      : d.title.length <= 7
        ? "clamp(28px, 7.6cqw, 46px)"
        : "clamp(22px, 5.4cqw, 34px)";
  const pillarCols =
    d.pillars.length >= 4
      ? "grid-cols-2 @md:grid-cols-4"
      : d.pillars.length === 3
        ? "grid-cols-3"
        : d.pillars.length === 2
          ? "grid-cols-2"
          : "mx-auto max-w-[220px] grid-cols-1";

  const share = async () => {
    const url = window.location.href.split("#")[0];
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: `${d.badge}「${d.title}」`,
          text: d.shareText,
          url,
        });
        setToast("分享成功，谢谢你把这份结局带给朋友");
        return;
      } catch (e) {
        if ((e as DOMException)?.name === "AbortError") return; // 玩家主动取消
      }
    }
    const text = `${d.shareText}\n${url}`;
    try {
      await navigator.clipboard.writeText(text);
      setToast("结局卡片文案已复制，快去粘贴给朋友吧");
    } catch {
      if (legacyCopy(text)) setToast("结局卡片文案已复制，快去粘贴给朋友吧");
      else setManual(text);
    }
  };

  // 导出 PNG：探图 → 离屏渲染导出卡 → 等排版稳定 → SnapDOM 截图；画面没变时再点直接复用上一张
  const shotKey = `${broken.join("|")}#${heroSize?.src ?? ""}:${heroSize?.w ?? 0}`;
  const exportPng = async () => {
    if (running.current) return;
    if (shot && shot.of === data && shot.key === shotKey) {
      saveFile(shot.url, shot.name);
      setShotOpen(true);
      return;
    }
    running.current = true;
    setBusy(true);
    try {
      const shown = [heroSrc, photo, commenterImg];
      const skip = await unreadable(
        uniq([...d.heroImgs, ...d.photoImgs, ...d.commenterImgs]).filter(
          usable,
        ),
      );
      if (!alive.current) return;
      flushSync(() => setStaging({ broken: [...broken, ...skip], heroSize }));
      const el = stage.current?.firstElementChild;
      if (!(el instanceof HTMLElement)) throw new Error("导出卡片没有渲染出来");
      await settle(el);
      if (!alive.current) return;
      const { snapdom } = await import("@zumer/snapdom");
      const cap = await snapdom(el, {
        scale: 2,
        dpr: 1, // 固定 2 倍输出，高 DPR 手机上也不会生成超大图
        embedFonts: true,
        reconcile: true, // 按实际排版钉住尺寸，避免标签 / 行内文字在截图里重新换行
        // 功能注释：导出底色跟随当前主题纸色，不再写死粉白
        backgroundColor:
          getComputedStyle(document.documentElement).getPropertyValue("--paper").trim() || "#fdeaf2",
      });
      if (cap.warnings.length)
        console.warn("[ending] 导出 PNG 有降级", cap.warnings);
      const blob = await cap.toBlob({ format: "png" });
      if (!alive.current) return;
      const name = `${fileStem(d)}.png`;
      const file = new File([blob], name, { type: "image/png" });
      const next: Shot = {
        of: data,
        key: shotKey,
        url: URL.createObjectURL(blob),
        name,
        file: canShareFile(file) ? file : null,
        lost:
          shown.some((s) => !!s && skip.includes(s)) ||
          cap.warnings.some((w) => w.code === "image-fallback"),
      };
      setShot(next);
      setShotOpen(true);
      saveFile(next.url, next.name);
    } catch (e) {
      console.warn("[ending] 导出 PNG 失败", e);
      if (alive.current) setToast("图片生成失败了，请稍后再试");
    } finally {
      running.current = false;
      if (alive.current) {
        setStaging(null);
        setBusy(false);
      }
    }
  };

  const shareShot = async (s: Shot) => {
    if (!s.file) return;
    try {
      await navigator.share({
        files: [s.file],
        title: `${d.badge}「${d.title}」`,
      });
    } catch (e) {
      if ((e as DOMException)?.name === "AbortError") return;
      setToast("当前环境没法直接分享图片，请先保存到相册");
    }
  };

  const hero = (
    <div
      className={`relative overflow-hidden ${
        snap
          ? "h-[480px]"
          : landscape
            ? "h-[clamp(300px,50vh,480px)] lg:absolute lg:inset-0 lg:h-auto"
            : "h-[clamp(300px,52vh,480px)]"
      }`}
    >
      {heroSrc ? (
        <>
          <img
            src={heroSrc}
            alt=""
            aria-hidden
            className="end-hero-blur absolute inset-0 h-full w-full object-cover"
          />
          {wide ? (
            <img
              src={heroSrc}
              alt={`${d.name}的结局主视觉`}
              onError={fail(heroSrc)}
              className="absolute inset-0 h-full w-full object-cover object-top"
            />
          ) : (
            <div
              className={`absolute inset-x-0 top-[13%] grid place-items-center ${
                landscape ? "bottom-[24%] lg:bottom-[40%]" : "bottom-[24%]"
              }`}
            >
              <div className="end-medal end-bob aspect-[3/4] h-full max-w-[72%]">
                <img
                  src={heroSrc}
                  alt={`${d.name}的形象`}
                  onLoad={(e) =>
                    setHeroSize({
                      src: heroSrc,
                      w: e.currentTarget.naturalWidth,
                    })
                  }
                  onError={fail(heroSrc)}
                  className="h-full w-full object-cover object-top"
                />
              </div>
            </div>
          )}
        </>
      ) : (
        <div
          className={`absolute inset-x-0 top-[13%] grid place-items-center ${
            landscape ? "bottom-[24%] lg:bottom-[40%]" : "bottom-[24%]"
          }`}
        >
          <div className="end-medal end-bob grid aspect-[3/4] h-full max-w-[72%] place-items-center bg-gradient-to-b from-[color-mix(in_srgb,var(--e-pink)_22%,var(--e-card))] to-[color-mix(in_srgb,var(--e-alt)_22%,var(--e-card))]">
            <span className="end-round end-outline text-[72px] leading-none text-[var(--e-pink)]">
              {d.name.slice(0, 1)}
            </span>
          </div>
        </div>
      )}
      <div aria-hidden className="end-hero-shade absolute inset-0" />

      {/* 手写便签：时长 / 日期 / 结局角标 / 总评，全部来自本局数据 */}
      <div className="end-note end-hand absolute left-3 top-3 max-w-[46%] -rotate-3 px-3 py-2 text-[16px] leading-snug sm:left-5 sm:top-5 sm:text-[18px]">
        <p>{d.dur}的旅程</p>
        <p className="pl-3">在 {d.date} 落幕——</p>
        <p className="pl-1">
          谢谢你一路相伴 <IconHeart size={14} className="inline text-[var(--e-pink)]" />
        </p>
      </div>
      <div className="end-sticky end-hand absolute right-3 top-5 max-w-[42%] rotate-[4deg] px-3 pb-2 pt-3.5 text-center text-[16px] leading-snug sm:right-5 sm:top-6 sm:text-[18px]">
        <span aria-hidden className="end-tape" />
        <p className="end-round text-[14px] tracking-wider text-[var(--e-pink)]">
          {d.badge}
        </p>
        <p className="mt-0.5">“{d.grade.verdict}”</p>
        <p className="mt-0.5 text-[13px] text-[var(--e-soft)]">
          第 {d.day} 天 · {d.kind}
        </p>
      </div>
    </div>
  );

  const plaque = (
    <div className="end-rise flex flex-col items-center">
      <div className="end-plaque relative mx-auto mt-7 w-fit">
        <div aria-hidden className="end-ribbon" />
        <Wing side="l" />
        <Wing side="r" />
        <Crown className="end-crown" />
        <div className="end-plaque-card relative px-8 pb-2.5 pt-3.5 text-center sm:px-11">
          <h1 className="end-round end-outline text-[40px] leading-none tracking-[0.06em] text-[var(--e-pink)] sm:text-[50px]">
            结局评定
          </h1>
          <p className="mt-1.5 text-[10px] font-bold tracking-[0.42em] text-[var(--e-soft)]">
            ENDING RESULT
          </p>
        </div>
      </div>
      <p className="mt-3 px-4 text-center text-[12.5px] tracking-[0.12em] text-[var(--e-soft)]">
        — {d.kind} · {d.name}的{d.dur}
        {d.worldName ? ` · ${d.worldName}` : ""} —
      </p>
    </div>
  );

  return (
    <div
      className={
        snap
          ? "end-page end-snap relative overflow-hidden"
          : `end-page relative h-full min-h-0 overflow-y-auto overflow-x-hidden ${
              landscape ? "end-land" : ""
            }`
      }
      style={snap ? { width: SNAP_W } : undefined}
    >
      <div aria-hidden className="end-bg" />
      {!snap && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-0 opacity-80"
        >
          <CoverFx kind="petals" />
        </div>
      )}

      <div
        className={
          landscape
            ? "relative z-10 mx-auto max-w-[820px] lg:grid lg:h-dvh lg:max-w-none lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]"
            : "relative z-10 mx-auto max-w-[560px]"
        }
      >
        <header className={landscape ? "relative lg:h-dvh" : "relative"}>
          {hero}
          <div
            className={`relative z-10 -mt-28 ${
              landscape
                ? "lg:absolute lg:inset-x-0 lg:bottom-[7vh] lg:mt-0"
                : ""
            }`}
          >
            {plaque}
          </div>
        </header>

        <main
          className={`@container relative px-4 pb-10 pt-6 sm:px-6 ${
            landscape ? "lg:h-dvh lg:overflow-y-auto lg:px-8 lg:pt-10" : ""
          }`}
        >
          {/* 你的结局是 · 拍立得 · 同时获得 */}
          <section
            className="end-rise grid grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] items-center gap-x-3 gap-y-6 @lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.3fr)_minmax(0,0.8fr)] @lg:gap-x-4"
            style={{ animationDelay: ".08s" }}
          >
            <figure className="end-polaroid relative mx-auto w-full max-w-[220px]">
              <span aria-hidden className="end-tape" />
              <div className="relative aspect-[4/5] overflow-hidden rounded-[2px] bg-gradient-to-br from-[color-mix(in_srgb,var(--e-pink)_20%,var(--e-card))] via-[var(--e-card)] to-[color-mix(in_srgb,var(--e-alt)_20%,var(--e-card))]">
                {photo ? (
                  <img
                    src={photo}
                    alt={`${d.title}纪念照`}
                    onError={fail(photo)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="grid h-full place-items-center content-center gap-1 text-[var(--e-soft)]">
                    <Glyph
                      name="flower"
                      width={56}
                      height={56}
                      strokeWidth={1.2}
                    />
                    <span className="end-hand text-[15px] text-[var(--e-soft)]">
                      {d.name}
                    </span>
                  </div>
                )}
              </div>
              <figcaption className="end-hand truncate px-1 pb-2 pt-1.5 text-center text-[15px] leading-tight text-[var(--e-soft)]">
                {d.badge} · {d.date}
              </figcaption>
              <div
                className="end-stamp absolute -bottom-4 -right-4"
                aria-label={`总体评级 ${d.grade.grade}，${d.grade.score} 分`}
              >
                <span className="end-round text-[24px] leading-none">
                  <GradeLetter g={d.grade.grade} />
                </span>
                <span className="mt-0.5 text-[9.5px] font-bold tabular-nums tracking-wider">
                  {d.grade.score} 分
                </span>
              </div>
            </figure>

            <div className="min-w-0 text-center">
              <Tag tone="var(--coral)">你的结局是</Tag>
              <div className="relative mt-4">
                <Crown className="absolute -top-6 right-[4%] w-8 rotate-12" />
                <h2
                  className="end-round end-outline break-words leading-[1.12] text-[var(--e-pink)]"
                  style={{ fontSize: titleSize }}
                >
                  {d.title}
                </h2>
              </div>
              {d.quote && (
                <p className="mt-3 text-[12.5px] leading-relaxed text-[var(--e-ink)]">
                  『{d.quote}』
                </p>
              )}
            </div>

            <div className="col-span-2 flex justify-center @lg:col-span-1">
              <div className="end-cloud relative grid w-full max-w-[220px] place-items-center px-4 pb-6 pt-8 text-center">
                <Tag
                  tone="var(--jade)"
                  className="absolute -top-3 left-1/2 -translate-x-1/2 text-[12px]"
                >
                  同时获得
                </Tag>
                <Glyph
                  name="sparkle"
                  width={16}
                  height={16}
                  className="absolute left-[16%] top-[30%] text-[var(--e-alt)]"
                />
                <Glyph
                  name="star"
                  width={12}
                  height={12}
                  fill="currentColor"
                  className="absolute bottom-[22%] right-[15%] text-[var(--e-pink)]"
                />
                <Crown className="absolute -top-1 right-[12%] w-6 -rotate-12 opacity-90" />
                <p
                  className="end-round end-outline-sm break-words leading-tight text-[var(--e-alt)]"
                  style={{ fontSize: "clamp(22px, 6.4cqw, 34px)" }}
                >
                  {d.sub}
                </p>
              </div>
            </div>
          </section>

          {/* 各项等级判定 */}
          {d.pillars.length > 0 && (
            <section
              className="end-rise end-panel relative mt-9 px-3 pb-4 pt-7"
              style={{ animationDelay: ".16s" }}
            >
              <Tag
                tone="var(--gold)"
                className="absolute -top-3.5 left-1/2 -translate-x-1/2"
              >
                各项等级判定
              </Tag>
              <div className={`grid gap-2.5 ${pillarCols}`}>
                {d.pillars.map((c) => (
                  <PillarCard key={c.id} c={c} />
                ))}
              </div>
            </section>
          )}

          {/* 结局后记 · 评定人寄语 */}
          <div className="mt-9 grid gap-9 @2xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] @2xl:gap-4">
            <section
              className="end-rise end-notebook relative pb-4 pr-4 pt-8"
              style={{ animationDelay: ".24s" }}
            >
              <Tag
                tone="var(--jade)"
                className="absolute -top-3.5 left-1/2 -translate-x-1/2"
              >
                结局后记
              </Tag>
              {d.paras.length ? (
                <div
                  className={`end-lines text-[13.5px] text-[var(--e-ink)] ${
                    folded ? "end-fold" : ""
                  }`}
                >
                  {(folded ? preview : d.paras).map((p, i) => (
                    <p
                      key={i}
                      className={
                        i === 0 && d.paras.length > 1 && p.length <= 24
                          ? "font-bold"
                          : ""
                      }
                    >
                      {p}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="end-lines text-[13.5px] text-[var(--e-soft)]">
                  {d.quote || "后记还没有写好，故事的余温仍在。"}
                </p>
              )}
              <div className="mt-2 flex items-end gap-3">
                {!snap && (d.paras.length > 3 || d.words > 160) && (
                  <button
                    type="button"
                    onClick={() => setFull((v) => !v)}
                    className="end-link"
                    aria-expanded={full}
                  >
                    {full ? "收起后记" : `展开全文 · ${d.words} 字`}
                  </button>
                )}
                <p className="end-hand ml-auto -rotate-3 text-[17px] text-[var(--e-soft)]">
                  致 {d.name} <IconHeart size={14} className="inline text-[var(--e-pink)]" />
                </p>
              </div>
            </section>

            <section
              className="end-rise end-panel relative px-3 pb-4 pt-8"
              style={{ animationDelay: ".32s" }}
            >
              <Tag
                tone="var(--coral)"
                className={`absolute -top-3.5 left-1/2 -translate-x-1/2 ${
                  // 导出卡不截断：SnapDOM 会自行烘焙省略号，丝带尾巴溢出会被误判成整段「…」
                  snap ? "" : "max-w-[92%] overflow-hidden text-ellipsis"
                }`}
              >
                {d.commenter}的结局评定！
              </Tag>
              <div className="flex items-start gap-3">
                <div className="relative w-[96px] shrink-0 @sm:w-[112px]">
                  {commenterImg ? (
                    <img
                      src={commenterImg}
                      alt={d.commenter}
                      onError={fail(commenterImg)}
                      className={`aspect-[4/5] w-full rounded-[22px] border-4 border-[var(--e-card)] bg-gradient-to-b from-[color-mix(in_srgb,var(--e-pink)_14%,var(--e-card))] to-[color-mix(in_srgb,var(--e-alt)_16%,var(--e-card))] shadow-[0_10px_20px_-12px_rgba(200,100,140,.7)] ${commenterFit}`}
                    />
                  ) : (
                    <div className="end-bob aspect-[4/5] w-full">
                      <Mascot />
                    </div>
                  )}
                </div>
                <div className="end-bubble min-w-0 flex-1 px-3.5 py-3 text-[13px] leading-relaxed text-[var(--e-ink)]">
                  <p className="whitespace-pre-wrap break-words">{d.comment}</p>
                  <p className="mt-2 text-right text-[12px] text-[var(--e-soft)]">
                    —— {d.commenter} <IconHeart size={14} className="inline text-[var(--e-pink)]" />
                  </p>
                </div>
              </div>
            </section>
          </div>

          {/* 再来一局 · 分享给朋友 · 导出图片；导出卡里换成落款 */}
          {snap ? (
            <p className="mt-8 text-center text-[10px] font-bold tracking-[0.42em] text-[var(--e-soft)]">
              — THE END —
            </p>
          ) : (
            <section
              className="end-rise end-lace relative mt-9 px-4 pb-4 pt-5"
              style={{ animationDelay: ".4s" }}
            >
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => go("create")}
                  className="end-btn end-btn-pink"
                >
                  <Glyph
                    name="home"
                    width={24}
                    height={24}
                    strokeWidth={2.2}
                    className="shrink-0"
                  />
                  <span className="text-left">
                    <span className="end-round block text-[19px] leading-none sm:text-[22px]">
                      再来一局
                    </span>
                    <small>NEW GAME</small>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void share()}
                  className="end-btn end-btn-blue"
                >
                  <IconShare
                    width={24}
                    height={24}
                    strokeWidth={2.2}
                    className="shrink-0"
                    aria-hidden
                  />
                  <span className="text-left">
                    <span className="end-round block text-[19px] leading-none sm:text-[22px]">
                      分享给朋友
                    </span>
                    <small>SHARE TO FRIENDS</small>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void exportPng()}
                  disabled={busy}
                  aria-busy={busy}
                  className="end-btn end-btn-lilac col-span-2"
                >
                  <IconCamera
                    width={24}
                    height={24}
                    strokeWidth={2.2}
                    className="shrink-0"
                    aria-hidden
                  />
                  <span className="text-left">
                    <span className="end-round block text-[19px] leading-none sm:text-[22px]">
                      {busy ? "正在生成图片…" : "导出 PNG 图片"}
                    </span>
                    <small>{busy ? "RENDERING" : "SAVE AS IMAGE"}</small>
                  </span>
                </button>
              </div>
              <p className="mt-3 flex items-center justify-center gap-1.5 text-[12px] text-[var(--e-soft)]">
                把这份结局卡片分享给朋友吧{" "}
                <IconHeart size={14} className="inline text-[var(--e-pink)]" />
                <Glyph
                  name="send"
                  width={15}
                  height={15}
                  className="text-[var(--e-soft)]"
                />
              </p>
              <button
                type="button"
                onClick={() => go("create")}
                className="end-link mx-auto mt-1.5 block"
              >
                再写一段新的人生 ›
              </button>
            </section>
          )}
        </main>
      </div>

      {toast && (
        <div role="status" className="end-toast">
          {toast}
        </div>
      )}

      {manual && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="分享文案"
          className="fixed inset-0 z-[70] grid place-items-center bg-[rgba(93,59,76,.35)] p-4"
          onClick={() => setManual("")}
        >
          <div
            className="end-panel ui-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-4 pb-1 pt-4">
              <p className="end-round min-w-0 flex-1 text-[18px] text-[var(--e-pink)]">分享文案</p>
              <button type="button" onClick={() => setManual("")} aria-label="关闭" className="ui-icon-btn"><IconClose /></button>
            </div>
            <div className="ui-dialog-body px-4 pb-4">
            <p className="mt-1 text-[12px] text-[var(--e-soft)]">
              当前环境无法直接分享或复制，请全选下方文字后复制。
            </p>
            <textarea
              readOnly
              value={manual}
              onFocus={(e) => e.currentTarget.select()}
              className="mt-2 h-40 w-full resize-none rounded-xl border border-[var(--e-line)] bg-[var(--e-card)] p-2.5 text-[12.5px] leading-relaxed text-[var(--e-ink)] outline-none"
            />
            <button
              type="button"
              onClick={() => setManual("")}
              className="end-btn end-btn-pink mt-3 w-full !min-h-[46px]"
            >
              <span className="end-round text-[16px]">好的</span>
            </button>
            </div>
          </div>
        </div>
      )}

      {shot && shotOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="结局卡片图片"
          className="fixed inset-0 z-[70] grid place-items-center bg-[rgba(93,59,76,.35)] p-4"
          onClick={() => setShotOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setShotOpen(false);
          }}
        >
          <div
            className="end-panel ui-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-4 pb-1 pt-4">
              <p className="end-round min-w-0 flex-1 text-[18px] text-[var(--e-pink)]">
                结局卡片已生成
              </p>
              <button type="button" onClick={() => setShotOpen(false)} aria-label="关闭" className="ui-icon-btn"><IconClose /></button>
            </div>
            <div className="ui-dialog-body px-4 pb-4">
            <p className="mt-1 text-[12px] leading-relaxed text-[var(--e-soft)]">
              PNG 图片已开始下载；没有反应的话点「保存图片」重试，手机也可以长按图片存到相册。
            </p>
            {shot.lost && (
              <p className="mt-1 text-[12px] leading-relaxed text-[var(--e-pink)]">
                部分图片的来源不允许跨域读取，图里换成了其他素材或默认画框。
              </p>
            )}
            <div className="mt-3 overflow-hidden rounded-xl border border-[var(--e-line)] bg-[var(--e-card)]">
              <img
                src={shot.url}
                alt={`${d.title} · 结局卡片`}
                className="block w-full"
              />
            </div>
            <div className="mt-3 flex gap-2.5">
              <button
                type="button"
                autoFocus
                onClick={() => saveFile(shot.url, shot.name)}
                className="end-btn end-btn-pink flex-1 !min-h-[46px]"
              >
                <IconSave
                  width={18}
                  height={18}
                  strokeWidth={2.2}
                  className="shrink-0"
                  aria-hidden
                />
                <span className="end-round text-[16px]">保存图片</span>
              </button>
              {shot.file && (
                <button
                  type="button"
                  onClick={() => void shareShot(shot)}
                  className="end-btn end-btn-blue flex-1 !min-h-[46px]"
                >
                  <IconShare
                    width={18}
                    height={18}
                    strokeWidth={2.2}
                    className="shrink-0"
                    aria-hidden
                  />
                  <span className="end-round text-[16px]">分享图片</span>
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShotOpen(false)}
              className="end-link mx-auto mt-2.5 block"
            >
              关闭
            </button>
            </div>
          </div>
        </div>
      )}

      {!snap &&
        staging &&
        createPortal(
          <div ref={stage} aria-hidden className="end-snap-stage">
            <Ending snap={staging} />
          </div>,
          document.body,
        )}
    </div>
  );
}
