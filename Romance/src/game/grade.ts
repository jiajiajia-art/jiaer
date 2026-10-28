import { wallet } from "./wallet";
import type { GameState as SimState } from "./logic";
import { computeLooks } from "./logic";
import { STAT_ORDER, TITLES } from "./data";
import { liveTerm as T } from "../mods/live";
import { metricVal } from "./fixedEvents";
import { GRADE_DIM_MAX, type GradeDim, type GradeDimIcon } from "../lib/types";

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

/* 结局页「各项等级判定」：创作者设置了评定维度就按维度算，否则用内置四项 */
export function endingPillars(
  s: SimState,
  dims?: GradeDim[],
  journalCount = 0,
): SubGradeCard[] {
  if (!dims?.length) return endingFourPillars(s, journalCount);
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

/* 未配置评级维度时的兜底四项名称（仅后备，作者在结局编辑器里配置维度即可全部替换） */
export const FALLBACK_DIM_LABELS = { cute: "可爱度", beauty: "美丽度", growth: "成长度", story: "故事完成度" } as const;

/* 结局评定四宫格：可爱度（亲和力/观众缘）· 美丽度（仪态/形象）· 成长度（能力/代表作）· 故事完成度（探索/羁绊/事件） */
export function endingFourPillars(
  s: SimState,
  journalCount = 0,
): SubGradeCard[] {
  const bonds = Object.values(s.rel ?? {}).filter((v) => v >= 40).length;
  const audience = s.audience ?? 30;
  const cuteScore = Math.min(
    100,
    Math.round(
      pct(s.reputation, 95) * 0.45 +
        pct(audience, 90) * 0.25 +
        pct(bonds, 4) * 0.3,
    ),
  );

  const looks = computeLooks(s);
  const beautyScore = Math.min(
    100,
    Math.round(
      pct(looks, 680) * 0.55 +
        pct(s.stats?.yitai ?? 50, 320) * 0.25 +
        pct(s.fame, 600) * 0.2,
    ),
  );

  const statAvg =
    STAT_ORDER.reduce((sum, k) => sum + (s.stats?.[k] ?? 40), 0) /
    Math.max(1, STAT_ORDER.length);
  const growthScore = Math.min(
    100,
    Math.round(
      pct(statAvg, 280) * 0.55 +
        pct(s.works, 8) * 0.25 +
        pct((s.titles?.length ?? 0) + s.awards, 4) * 0.2,
    ),
  );

  const visitedCount = s.visited?.length ?? 1;
  const metCount = s.metPeople?.length ?? 1;
  const firedCount = (s.eventsFired?.length ?? 0) + journalCount;
  const storyScore = Math.min(
    100,
    Math.round(
      pct(metCount, 8) * 0.35 +
        pct(visitedCount, 8) * 0.25 +
        pct(firedCount, 6) * 0.2 +
        pct(s.day ?? 1, 365) * 0.2,
    ),
  );

  return [
    {
      id: "cute",
      icon: "heart",
      label: FALLBACK_DIM_LABELS.cute,
      grade: scoreToLetter(cuteScore),
      stars: scoreToStars(cuteScore),
      score: cuteScore,
      detail: `口碑 ${Math.round(s.reputation)} · 挚友 ${bonds}`,
    },
    {
      id: "beauty",
      icon: "star",
      label: FALLBACK_DIM_LABELS.beauty,
      grade: scoreToLetter(beautyScore),
      stars: scoreToStars(beautyScore),
      score: beautyScore,
      detail: `形象 ${Math.round(looks)} · ${T("fame", "名气")} ${Math.round(s.fame)}`,
    },
    {
      id: "growth",
      icon: "leaf",
      label: FALLBACK_DIM_LABELS.growth,
      grade: scoreToLetter(growthScore),
      stars: scoreToStars(growthScore),
      score: growthScore,
      detail: `综合能力 ${Math.round(statAvg)} · 作品 ${s.works} 部`,
    },
    {
      id: "story",
      icon: "book",
      label: FALLBACK_DIM_LABELS.story,
      grade: scoreToLetter(storyScore),
      stars: scoreToStars(storyScore),
      score: storyScore,
      detail: `历时 ${Math.max(1, s.day ?? 1)} 天 · 结识 ${metCount} 人`,
    },
  ];
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
