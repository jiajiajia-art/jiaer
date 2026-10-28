import { wallet } from "./wallet";
/* ————— 人设与危机：确定性引擎 —————
 * 只读 image-crisis 内容池的参数，按「证据 / 回应时机 / 诚信(口碑) / 舆情阈值」
 * 做裁决。不写死中文标签、不制造热搜事实。AI 只在此之外负责公开范围的描写，
 * 不参与这里的任何数值计算。
 */
import type { CrisisState, GameState } from "./logic";
import {
  IMAGE_CRISIS,
  PERSONA_BY_ID,
  PUBLIC_ACTS,
  CRISES,
  CRISIS_BY_ID,
  CRISIS_RESPONSES,
  type CrisisDiff,
} from "../worlds/star2005/content";

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/* 是否已解锁人设玩法：名气破圈，或已卷入过争议 */
export function personaUnlocked(s: GameState): boolean {
  return s.fame >= IMAGE_CRISIS.unlock.fame || s.controversy > 0 || s.crisesResolved > 0 || !!s.crisis;
}

/* 粉丝分层（仅展示，全部由引擎从名气/匹配度/黑粉派生）*/
export function fanBreakdown(s: GameState): { core: number; casual: number; anti: number; total: number } {
  const t = IMAGE_CRISIS.fanTiers;
  const base = Math.round(s.fame * t.perFame);
  const core = Math.round(base * (s.brandMatch / 100) * t.coreFromMatch + s.audience * 30);
  const casual = Math.max(0, base - core);
  const anti = Math.round(s.blackFans * t.antiPerBlack);
  return { core, casual, anti, total: core + casual };
}

/* 公开或改写人设标签。改写已有标签视为一次反转：涨争议、掉匹配度、清零连贯度。 */
export function declarePersona(s: GameState, id: string): { s: GameState; lines: string[] } {
  const p = PERSONA_BY_ID[id];
  if (!p) return { s, lines: [] };
  if (s.persona === id) return { s, lines: [`你重申了「${p.label}」人设。`] };
  const rev = IMAGE_CRISIS.actOutcome.reversal;
  const switching = !!s.persona;
  const next: GameState = {
    ...s,
    persona: id,
    personaStreak: 0,
    personaSwings: switching ? s.personaSwings + 1 : s.personaSwings,
    brandMatch: switching ? clamp(s.brandMatch + rev.brandMatch, 0, 100) : s.brandMatch,
    controversy: switching ? clamp(s.controversy + rev.controversy, 0, 100) : s.controversy,
  };
  const lines = switching
    ? [`你把公众人设改立为「${p.label}」——面向 ${p.audience}。频繁换人设会消耗观众信任。`]
    : [`你正式公开人设「${p.label}」——面向 ${p.audience}。`];
  return { s: next, lines };
}

/* 由口碑（诚信代理）派生一场危机是否握有可举证的实锤 */
function deriveEvidence(s: GameState, baseEvidence?: "clear" | "mixed" | "none"): "clear" | "mixed" | "none" {
  if (baseEvidence) return baseEvidence;
  if (s.reputation >= 60) return "clear";
  if (s.reputation >= 40) return "mixed";
  return "none";
}

/* 触发一场危机（确定性挑选：按累计反转次数轮换模板，避免随机造谣）*/
export function triggerCrisis(s: GameState, forceId?: string): { s: GameState; lines: string[] } {
  if (s.crisis) return { s, lines: [] };
  const def = forceId ? CRISIS_BY_ID[forceId] : CRISES[s.personaSwings % CRISES.length];
  if (!def) return { s, lines: [] };
  const crisis: CrisisState = { id: def.id, day: s.day, severity: def.severity, evidence: deriveEvidence(s, def.baseEvidence) };
  const line = `危机爆发：${def.label}——${def.desc}`;
  return { s: { ...s, crisis, log: [...s.log, `【第 ${s.week} 周 · 危机】${line}`].slice(-40) }, lines: [line] };
}

/* 安排一条公开内容：与当前人设比对，一致/中性/反转，确定性结算。 */
export function doPublicAct(s: GameState, actId: string): { s: GameState; lines: string[]; ok: boolean } {
  const act = PUBLIC_ACTS.find((a) => a.id === actId);
  if (!act) return { s, lines: [], ok: false };

  const oc = IMAGE_CRISIS.actOutcome;
  let kind: "consistent" | "neutral" | "reversal";
  if (!s.persona) kind = "neutral";
  else if (act.fits.includes(s.persona)) kind = "consistent";
  else kind = "reversal";
  const spec = oc[kind];

  let brandMatch = clamp(s.brandMatch + spec.brandMatch, 0, 100);
  let audience = clamp(s.audience + spec.audience, 0, 100);
  let controversy = clamp(s.controversy + spec.controversy, 0, 100);
  let blackFans = clamp(s.blackFans + (spec.blackFans ?? 0), 0, 999);
  const personaStreak = kind === "consistent" ? s.personaStreak + 1 : 0;
  const personaSwings = kind === "reversal" ? s.personaSwings + 1 : s.personaSwings;
  const lines: string[] = [];

  // 连贯度奖励：连续一致每 N 次额外拉高匹配度
  if (kind === "consistent" && spec.streakBonusEvery && personaStreak % spec.streakBonusEvery === 0) {
    brandMatch = clamp(brandMatch + (spec.streakBonusMatch ?? 0), 0, 100);
    lines.push(`连续 ${personaStreak} 次人设一致，品牌匹配度额外 +${spec.streakBonusMatch}。`);
  }

  const kindLabel = kind === "consistent" ? "契合人设" : kind === "reversal" ? "人设反转" : "中性曝光";
  lines.unshift(`${act.icon} ${act.label}（${kindLabel}）：名气 +${act.fameGain}。`);

  let next: GameState = {
    ...s,
    fame: Math.min(1000, s.fame + act.fameGain),
    brandMatch, audience, controversy, blackFans, personaStreak, personaSwings,
  };

  // 争议越阈值且当前无危机 → 触发危机
  if (!next.crisis && controversy >= oc.crisisAtControversy) {
    const t = triggerCrisis(next);
    next = t.s;
    lines.push(...t.lines);
  }
  return { s: next, lines, ok: true };
}

export type CrisisTier = "good" | "mixed" | "bad";
const TIER_LABEL: Record<CrisisTier, string> = { good: "上策", mixed: "中策", bad: "下策" };

/* 危机结算分：base + 证据 + 时机 + 诚信 + 严重度 + 舆情 (+ 私下和解看负责人信任) */
export function crisisScore(s: GameState, responseId: string): number | null {
  const r = CRISIS_RESPONSES.find((x) => x.id === responseId);
  if (!r || !s.crisis) return null;
  const w = IMAGE_CRISIS.resolve.weights;
  const evScore = s.crisis.evidence === "clear" ? 1 : s.crisis.evidence === "mixed" ? 0 : -1;
  const fast = s.day - s.crisis.day <= IMAGE_CRISIS.resolve.timingFastDays;
  let score = r.base;
  score += r.evidenceSens * evScore * w.evidence;
  score += r.timingSens * (fast ? w.timing : -w.timing * 0.5);
  score += r.integritySens * (s.reputation - 50) * w.integrity;
  score += (s.crisis.severity - 1) * w.severity;
  score += s.controversy * w.controversy;
  if (r.trustSens) score += r.trustSens * ((s.trust - 40) / 40) * w.trust;
  return score;
}

/* 应对危机：确定性落到上/中/下三档并套用内容池数值。 */
export function resolveCrisis(s: GameState, responseId: string): { s: GameState; lines: string[]; tier: CrisisTier } | null {
  const r = CRISIS_RESPONSES.find((x) => x.id === responseId);
  const def = s.crisis ? CRISIS_BY_ID[s.crisis.id] : undefined;
  const score = crisisScore(s, responseId);
  if (!r || !def || score === null) return null;

  const { goodAt, badBelow } = IMAGE_CRISIS.resolve;
  const tier: CrisisTier = score >= goodAt ? "good" : score < badBelow ? "bad" : "mixed";
  const d: CrisisDiff = r.tiers[tier];

  const next: GameState = {
    ...wallet.add(s, -(r.costMoney ?? 0)),
    crisis: null,
    crisesResolved: s.crisesResolved + 1,
    reputation: clamp(s.reputation + d.rep, 0, 100),
    fame: clamp(s.fame + d.fame, 0, 1000),
    controversy: clamp(s.controversy + d.controversy, 0, 100),
    blackFans: clamp(s.blackFans + d.blackFans, 0, 999),
    trust: clamp(s.trust + d.trust, 0, 100),
    brandMatch: clamp(s.brandMatch + d.brandMatch, 0, 100),
    audience: clamp(s.audience + d.audience, 0, 100),
  };
  const lines = [
    `${r.icon} 面对「${def.label}」，你选择了${r.label}——结算为「${TIER_LABEL[tier]}」。`,
    `舆情 ${d.controversy >= 0 ? "+" : ""}${d.controversy} · 口碑 ${d.rep >= 0 ? "+" : ""}${d.rep} · 目标受众认可 ${d.audience >= 0 ? "+" : ""}${d.audience}${r.costMoney ? ` · 公关花费 ${wallet.fmt(r.costMoney)}` : ""}`,
  ];
  next.log = [...s.log, `【第 ${s.week} 周 · 危机公关】${lines[0]}`].slice(-40);
  return { s: next, lines, tier };
}

/* 周结算里的自然冷却：舆情随时间回落，无危机且高匹配度时目标受众缓慢沉淀。 */
export function personaWeekly(s: GameState): GameState {
  // 危机悬而未决：舆情不降反升、口碑与受众持续流失；拖满 3 周则舆论自行定性（按「下策」收场），不再无限挂起
  if (s.crisis) {
    const def = CRISIS_BY_ID[s.crisis.id];
    const days = s.day - s.crisis.day;
    if (days >= 21) {
      const lines = [`【第 ${s.week} 周 · 危机】「${def?.label ?? "舆论危机"}」拖了三周无人回应，舆论已自行定性：口碑 -8 · 黑粉 +40 · 目标受众认可 -6`];
      return {
        ...s, crisis: null, crisesResolved: s.crisesResolved + 1,
        reputation: clamp(s.reputation - 8, 0, 100), blackFans: clamp(s.blackFans + 40, 0, 999),
        audience: clamp(s.audience - 6, 0, 100), controversy: clamp(s.controversy - 10, 0, 100),
        log: [...s.log, ...lines].slice(-40),
      };
    }
    return {
      ...s, reputation: clamp(s.reputation - 2, 0, 100), blackFans: clamp(s.blackFans + 10, 0, 999),
      audience: clamp(s.audience - 1, 0, 100), controversy: clamp(s.controversy + 2, 0, 100),
      log: [...s.log, `【第 ${s.week} 周 · 危机】「${def?.label ?? "舆论危机"}」仍在发酵（口碑 -2 · 黑粉 +10），再拖 ${Math.max(0, 21 - days)} 天将被舆论定性`].slice(-40),
    };
  }
  let controversy = clamp(s.controversy - 6, 0, 100);
  let audience = s.audience;
  if (!s.crisis && s.persona && s.brandMatch >= 60) audience = clamp(audience + 2, 0, 100);
  // 长期不维护人设，匹配度缓慢回落
  const brandMatch = s.persona ? clamp(s.brandMatch - 1, 0, 100) : s.brandMatch;
  return { ...s, controversy, audience, brandMatch };
}
