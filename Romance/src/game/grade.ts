import { wallet } from "./wallet";
import type { GameState as SimState } from "./logic";
import { TITLES } from "./data";
import { liveTerm as T } from "../mods/live";
import { metricVal } from "./fixedEvents";
import { GRADE_DIM_MAX, type AttrDef, type GradeDim, type GradeDimIcon } from "../lib/types";

/* 人生评级：按名气 / 口碑 / 作品 / 奖项 / 羁绊 / 身家六项打分（0–100），映射到 S+ ~ D */
export type LifeGrade = {
  grade: string;
  score: number;
  verdict: string;
  items: { label: string; score: number; detail: string }[];
};

export type SubGradeCard = {
  id: string; // 内置四项：cute / beauty / growth / story；自定义维度为其 id
  label: string;
  icon: GradeDimIcon;
  grade: string;
  stars: number; // 1~5
  score: number;
  detail: string;
};

const pct = (v: number, full: number) =>
  Math.max(0, Math.min(100, Math.round((v / full) * 100)));

export function scoreToLetter(score: number): string {
  if (score >= 90) return "S+";
  if (score >= 78) return "S";
  if (score >= 62) return "A";
  if (score >= 45) return "B";
  if (score >= 28) return "C";
  return "D";
}

export function scoreToStars(score: number): number {
  if (score >= 88) return 5;
  if (score >= 72) return 4;
  if (score >= 52) return 3;
  if (score >= 30) return 2;
  return 1;
}

export function lifeGrade(s: SimState): LifeGrade {
  const bonds = Object.values(s.rel ?? {}).filter((v) => v >= 60).length;
  const items = [
    {
      label: T("fame", "名气"),
      score: pct(s.fame, 750),
      detail: `${Math.round(s.fame)}`,
    },
    {
      label: "口碑",
      score: pct(s.reputation, 100),
      detail: `${Math.round(s.reputation)}`,
    },
    { label: "作品", score: pct(s.works, 12), detail: `${s.works} 部` },
    { label: "奖项", score: pct(s.awards, 3), detail: `${s.awards} 座` },
    { label: "羁绊", score: pct(bonds, 4), detail: `${bonds} 位挚交` },
    {
      label: "身家",
      score: pct(wallet.balance(s), 2_000_000),
      detail: wallet.fmt(Math.round(wallet.balance(s))),
    },
  ];
  const w = [0.26, 0.2, 0.16, 0.14, 0.14, 0.1];
  const score = Math.round(items.reduce((a, it, i) => a + it.score * w[i], 0));
  return {
    grade: scoreToLetter(score),
    score,
    verdict: verdictOf(score),
    items,
  };
}

const VERDICTS: Record<string, string> = {
  "S+": "传奇一生 · 无可替代",
  S: "光芒万丈 · 名留青史",
  A: "璀璨有成 · 不负此生",
  B: "踏实前行 · 自有光亮",
  C: "平凡日常 · 认真活过",
  D: "风雨未歇 · 来日方长",
};
export const verdictOf = (score: number) => VERDICTS[scoreToLetter(score)];

/* 自定义评定维度的取值：主角属性（stats）或指标（名气/口碑/自定义属性 c:xxx …） */
export const dimValue = (s: SimState, src: GradeDim["src"]): number =>
  src.kind === "stat"
    ? ((s.stats as Record<string, number>)[src.key] ?? 0)
    : metricVal(s, src.key);

/* 未配置评级维度时：用本作品建角属性自动生成默认维度（最多 GRADE_DIM_MAX 条；满分取属性 max，缺省 100） */
const DEFAULT_DIM_ICONS: GradeDimIcon[] = ["heart", "star", "leaf", "book"];
export function defaultGradeDims(defs?: AttrDef[] | null): GradeDim[] {
  if (!Array.isArray(defs)) return [];
  return defs
    .filter((d) => d && typeof d.id === "string" && d.id)
    .slice(0, GRADE_DIM_MAX)
    .map((d, i) => ({
      id: `dim_auto_${d.id}`,
      label: (d.label || d.id).slice(0, 8),
      icon: DEFAULT_DIM_ICONS[i % DEFAULT_DIM_ICONS.length],
      src: { kind: "metric" as const, key: `c:${d.id}` },
      full: d.max && d.max > 0 ? d.max : 100,
    }));
}

/* 存档实际生效的评级维度：手配优先，否则按本局属性自动生成 */
export function effectiveGradeDims(g: { gradeDims?: GradeDim[]; attrDefs?: AttrDef[] }): GradeDim[] {
  return g.gradeDims?.length ? g.gradeDims : defaultGradeDims(g.attrDefs);
}

/* 无任何维度时的中性总评：不打分、不回落任何内置维度 */
export const NEUTRAL_GRADE: LifeGrade = { grade: "—", score: 0, verdict: "旅程结束", items: [] };

/* 结算总评：有维度按维度均分，否则中性占位 */
export function settleGrade(g: { sim: SimState; gradeDims?: GradeDim[]; attrDefs?: AttrDef[] }): LifeGrade {
  const dims = effectiveGradeDims(g);
  return dims.length ? dimsGrade(g.sim, dims) : NEUTRAL_GRADE;
}

/* 结局页「各项等级判定」：只按传入的维度算；没有维度就不展示卡片 */
export function endingPillars(
  s: SimState,
  dims?: GradeDim[],
  _journalCount = 0,
): SubGradeCard[] {
  if (!dims?.length) return [];
  return dims.slice(0, GRADE_DIM_MAX).map((d) => {
    const v = dimValue(s, d.src);
    const full = d.full > 0 ? d.full : 100;
    const raw = pct(v, full);
    const score = d.lower ? 100 - raw : raw;
    return {
      id: d.id,
      label: d.label.trim() || "未命名",
      icon: d.icon,
      grade: scoreToLetter(score),
      stars: scoreToStars(score),
      score,
      detail: d.lower
        ? `${Math.round(v)}（越低越好）`
        : `${Math.round(v)} / ${full}`,
    };
  });
}

/* 自定义维度下的总评：各维度均分，与卡片口径一致 */
export function dimsGrade(s: SimState, dims: GradeDim[]): LifeGrade {
  const cards = endingPillars(s, dims);
  const score = Math.round(
    cards.reduce((a, c) => a + c.score, 0) / Math.max(1, cards.length),
  );
  return {
    grade: scoreToLetter(score),
    score,
    verdict: verdictOf(score),
    items: cards.map((c) => ({
      label: c.label,
      score: c.score,
      detail: c.detail,
    })),
  };
}

/* 同时获得副称号：优先展示佩戴头衔 / 已解锁最高头衔，否则按最高维度派生 */
export function secondaryTitleOf(s: SimState, pillars: SubGradeCard[]): string {
  if (s.equippedTitle) {
    const t = TITLES.find((x) => x.id === s.equippedTitle);
    if (t?.name) return t.name;
  }
  if (s.titles?.length) {
    const lastId = s.titles[s.titles.length - 1];
    const t = TITLES.find((x) => x.id === lastId);
    if (t?.name) return t.name;
  }
  const top = [...pillars].sort((a, b) => b.score - a.score)[0];
  if (!top) return "闪耀新星";
  const builtin: Record<string, [string, string]> = {
    beauty: ["盛世美颜", "亭亭玉立"],
    cute: ["万人迷", "温柔月光"],
    growth: ["六边形全能", "破茧成蝶"],
    story: ["满载星光", "初心不改"],
  };
  const b = builtin[top.id];
  if (b) return top.score >= 85 ? b[0] : b[1];
  return `${top.label.replace(/度$/, "") || top.label}之星`;
}
