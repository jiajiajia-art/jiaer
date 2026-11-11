import { affinityCapOf } from "../worlds/star2005/content";
/* ═══ 生育系统：隐藏世界数值「生育率」→ 亲密受孕判定 → 孕期 → 分娩与子女 ═══
 * 生育率（sim.fertility）为隐藏数值，常规界面不展示；仅世界规则面板可调。 */
import type { GameState as SimState } from "./logic";
import { inheritShares, ruleOf } from "./worldRules";
import { feature } from "../mods/registry";
import { slot } from "../mods/live";
import type { PregnancySlot } from "../game/data";

/* 孕育参数（模组槽 pregnancy，孕育包 / 世界观可改；缺省=引擎默认） */
const P = (): PregnancySlot => slot<PregnancySlot>("pregnancy", () => ({}), () => ({}));
const n0 = (v: unknown, fb: number) => (typeof v === "number" && Number.isFinite(v) ? v : fb);
export const gestationDays = (): number => Math.max(30, Math.round(n0(P().gestationDays, GESTATION_DAYS_DEFAULT)));

export type Pregnancy = { fatherId: string; fatherName: string; partnerGender?: "男" | "女"; startDay: number; known: boolean; knownDay?: number; revealDay: number };
export type Child = { id: string; name: string; fatherId: string; fatherName?: string; birthDay: number; gender: "男" | "女"; npcId?: string; legit?: boolean /* 出生时双亲是否已婚（子嗣继承权用） */ };

export const GESTATION_DAYS_DEFAULT = 300; // 怀胎十月（每月按 30 天），满 300 天进入第十一个月即分娩
/** @deprecated 用 gestationDays()（可被模组改写） */
export const GESTATION_DAYS = GESTATION_DAYS_DEFAULT;

export const rollFertility = (): number => {
  const lo = Math.max(0, Math.min(100, n0(P().fertilityMin, 20))), hi = Math.max(lo, Math.min(100, n0(P().fertilityMax, 80)));
  return lo + Math.floor(Math.random() * (hi - lo + 1));
};

/* 旧档补齐（防御性） */
export function ensureFertility<T extends Partial<SimState>>(s: T): T {
  return {
    ...s,
    fertility: typeof s.fertility === "number" && Number.isFinite(s.fertility) ? Math.max(0, Math.min(100, s.fertility)) : rollFertility(),
    pregnancy: s.pregnancy && typeof s.pregnancy.startDay === "number" ? { ...s.pregnancy, revealDay: s.pregnancy.revealDay ?? 21 } : null,
    children: Array.isArray(s.children) ? s.children : [],
  };
}

/* 世界规则·生育制度：主角（受孕方）能否怀孕 */
export const canConceive = (gender: string | undefined): boolean => {
  const male = /男/.test(gender ?? "女");
  const r = ruleOf("birth");
  return r === "both" ? true : r === "male" ? male : !male;
};
export const birthRuleLabel = (): string => ({ female: "女子生育", male: "男子生育", both: "男女皆可生育" }[ruleOf("birth")] ?? "女子生育");

const NEW_SUR = ["云", "星", "岚", "晏", "辰", "汐", "棠", "霁"];
/* 世界规则·冠姓权：bearer=主角（生育方），partner=另一方 */
export function childSurname(bearerName: string, bearerGender: string | undefined, partnerName: string, partnerGender?: string): string {
  const bs = bearerName.slice(0, 1), ps = partnerName.slice(0, 1) || bs;
  const bMale = /男/.test(bearerGender ?? "女"), pMale = partnerGender ? /男/.test(partnerGender) : !bMale;
  switch (ruleOf("surname")) {
    case "mother": return !bMale ? bs : !pMale ? ps : bs;
    case "either": return Math.random() < 0.5 ? bs : ps;
    case "new": return NEW_SUR[Math.floor(Math.random() * NEW_SUR.length)];
    default: return bMale ? (pMale ? ps : bs) : pMale ? ps : bs;
  }
}

/* 受孕概率：生育率/100 × 0.25，高压降低、亲密之下的身体底子略修正 */
export function conceptionChance(s: SimState): number {
  const cfg = P();
  const base = ((s.fertility ?? 50) / 100) * (n0(cfg.baseChance, 25) / 100);
  const stressMul = 1 - Math.max(0, (s.stress ?? 0) - n0(cfg.stressFrom, 50)) / 100; // 压力超过门槛后逐步降低
  return Math.max(0, Math.min(n0(cfg.maxChance, 50) / 100, base * stressMul));
}

/* 一次亲密：返回新 sim 与是否受孕（受孕本身隐藏，不提示） */
export function rollIntimacy(s: SimState, fatherId: string, fatherName: string, gender: string | undefined, rnd = Math.random(), partnerGender?: "男" | "女"): { next: SimState; conceived: boolean } {
  if (!feature("pregnancy") || !canConceive(gender) || s.pregnancy) return { next: s, conceived: false };
  if (rnd >= conceptionChance(s)) return { next: s, conceived: false };
  const rLo = Math.max(1, Math.round(n0(P().revealMin, 14))), rHi = Math.max(rLo, Math.round(n0(P().revealMax, 30)));
  const revealDay = rLo + Math.floor(Math.random() * (rHi - rLo + 1));
  return { next: { ...s, pregnancy: { fatherId, fatherName, partnerGender, startDay: s.day, known: false, revealDay } }, conceived: true };
}

export const pregWeeks = (s: SimState): number => (s.pregnancy ? Math.floor((s.day - s.pregnancy.startDay) / 7) : 0);
export const dueDay = (s: SimState): number => (s.pregnancy ? s.pregnancy.startDay + gestationDays() : 0);

const CHILD_GIVEN = ["安", "念", "朝", "知夏", "星禾", "以宁", "予安", "清和", "言蹊", "思远", "小满", "一诺"];

/* 每日推进：孕期征兆 / 知晓 / 分娩；返回提示文本（写入日结算） */
export function tickPregnancy(s: SimState, motherName: string, bearerGender?: string): { next: SimState; notes: string[]; born?: Child } {
  const p = s.pregnancy;
  if (!p) return { next: s, notes: [] };
  const notes: string[] = [];
  const age = s.day - p.startDay;
  const gest = gestationDays();
  let n: SimState = s;
  if (!p.known && age >= p.revealDay) {
    n = { ...n, pregnancy: { ...p, known: true, knownDay: s.day } };
    notes.push(`【身体异样】近来晨起反胃、嗜睡乏力……验孕棒上浮现两道红线——你怀孕了（约 ${Math.floor(age / 7)} 周）。`);
  }
  if (age >= gest) {
    const gender: "男" | "女" = Math.random() < 0.5 ? "男" : "女";
    const sur = childSurname(motherName, bearerGender, p.fatherName, p.partnerGender);
    const child: Child = {
      id: `child-${s.day}-${Math.floor(Math.random() * 1e6)}`,
      name: sur + (() => { const pool = P().childNames?.filter((x) => x.trim()).length ? P().childNames!.filter((x) => x.trim()) : CHILD_GIVEN; return pool[Math.floor(Math.random() * pool.length)]; })(),
      fatherId: p.fatherId, fatherName: p.fatherName, birthDay: s.day, gender,
      legit: !!p.fatherId && !!s.spouses?.includes(p.fatherId),
    };
    const rel = { ...n.rel };
    if (p.fatherId) rel[p.fatherId] = Math.min(affinityCapOf(p.fatherId), (rel[p.fatherId] ?? 0) + 15);
    n = { ...n, pregnancy: null, children: [...(n.children ?? []), child], rel, stress: Math.min(100, n.stress + n0(P().birthStress, 10)), energy: Math.min(n.energy, 30) };
    notes.push(`【新生命】历经${gest === GESTATION_DAYS_DEFAULT ? "十月怀胎，第十一个月临盆" : `约 ${Math.round(gest / 30)} 个月的孕期`}，你平安诞下一名${gender === "男" ? "男婴" : "女婴"}，取名「${child.name}」。另一位亲人是${p.fatherName}。依「冠姓权」，孩子姓「${sur}」。孩子已加入你的人脉。`);
    return { next: n, notes, born: child };
  }
  // 已知孕期：行动力上限压低、压力缓升（孕晚期更明显）
  if (n.pregnancy?.known) {
    const late = age > gest * 0.65, mid = age > gest * 0.28; // 孕中 / 孕晚期按孕期长度等比划分（默认 84 / 196 天）
    const cap = late ? 60 : mid ? 80 : 90;
    n = { ...n, energy: Math.min(n.energy, cap), stress: Math.min(100, n.stress + (late ? 1 : 0)) };
  }
  return { next: n, notes };
}

/* 孕期对通告的难度修正（判定减值，供高强度通告使用） */
export const pregnancyGigPenalty = (s: SimState): number => {
  if (!s.pregnancy) return 0;
  const age = s.day - s.pregnancy.startDay;
  return age > 196 ? 25 : age > 84 ? 12 : 5;
};

export const childAgeLabel = (c: Child, day: number): string => {
  const d = Math.max(0, day - c.birthDay);
  if (d < 30) return `${d} 天`;
  if (d < 365) return `${Math.floor(d / 30)} 个月`;
  return `${Math.floor(d / 365)} 岁`;
};

/* AI 上下文块：怀孕状态与子女 */
export function pregnancyPromptBlock(s: SimState | undefined): string {
  if (!s) return "";
  const lines: string[] = [];
  const p = s.pregnancy;
  if (p) {
    const age = s.day - p.startDay;
    if (p.known) lines.push(`【怀孕状态】主角已怀孕第 ${Math.floor(age / 30) + 1} 个月（约 ${Math.floor(age / 7)} 周，孩子另一亲：：${p.fatherName}），距预产期约 ${Math.max(0, gestationDays() - age)} 天。叙事须体现孕期身体状况（${age > gestationDays() * 0.65 ? "孕晚期，行动不便、需静养" : age > gestationDays() * 0.28 ? "孕中期，小腹渐显" : "孕早期，孕吐乏力"}），不得安排危险动作戏或饮酒。`);
    else if (age >= 7) lines.push(`【身体暗示（主角尚不知情）】主角近来偶有反胃、嗜睡、口味变化等细微异样，可在叙事中轻描淡写地带出，但不要点破怀孕。`);
  }
  lines.push(`【生育规则】${birthRuleLabel()}；${gestationDays() === GESTATION_DAYS_DEFAULT ? "怀胎十月，第十一个月分娩" : `孕期约 ${gestationDays()} 天`}；子女姓氏按冠姓权「${({ father: "随父姓", mother: "随母姓", either: "父母皆可", new: "另立新姓" } as Record<string, string>)[ruleOf("surname")] ?? "随父姓"}」。孕期与分娩由系统推进，AI 不得自行宣布怀孕或生产。`);
  if (s.children?.length) {
    const share = inheritShares(s.children);
    lines.push(`【子女】${s.children.map((c) => `${c.name}（${c.gender}，${childAgeLabel(c, s.day)}，另一亲${c.fatherName ?? "未知"}，${c.legit ? "婚生" : "非婚生"}，继承份额 ${Math.round((share[c.id] ?? 0) * 100)}%）`).join("、")}——继承份额由系统按「子嗣继承权」结算，叙事不得改动`);
  }
  return lines.length ? lines.join("\n") + "\n\n" : "";
}

/* 新生儿 → 人脉 NPC（GameContext 落档前同步，已建档的跳过） */
export function syncChildNpcs<G extends { sim: SimState; npcs: import("../lib/types").Npc[] }>(g: G): G {
  const kids = g.sim.children ?? [];
  const missing = kids.filter((c) => !g.npcs.some((n) => n.id === c.id));
  if (!missing.length) return g;
  const npcs = [...g.npcs, ...missing.map((c) => ({
    id: c.id, name: c.name, age: "婴儿", identity: "你的孩子", relation: "子女", avatar: "",
    bio: `${c.gender === "男" ? "儿子" : "女儿"}（${c.legit ? "婚生" : "非婚生"}），出生于第 ${c.birthDay} 天，另一位亲人是${c.fatherName ?? "未知"}。`,
    mood: "安睡", affinity: 80, dims: [], tags: ["子女"], attrs: [], affinityHistory: [], interactions: [],
    persona: { gender: c.gender },
  }))];
  const met = Array.from(new Set([...(g.sim.metPeople ?? []), ...missing.map((c) => c.id)]));
  const rel = { ...g.sim.rel };
  for (const c of missing) rel[c.id] = rel[c.id] ?? 80;
  return { ...g, npcs, sim: { ...g.sim, metPeople: met, rel } };
}
