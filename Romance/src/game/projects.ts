import { wallet } from "./wallet";
import { orderMods } from "./worldRules";
/* ————— 星光2005 · 项目/通告全生命周期引擎（纯规则层）—————
 * 明星养成式通告状态机：open→applied→pending_result→offered→signed→
 * in_progress→completed→released（或 failed/breached/expired）。
 * 契约：竞争分、Q 值、报酬账本、档期锁定、幂等与状态转换都在此；所有中文
 * 名称、题材、门槛、星级报酬、发行延迟、公式权重全部来自 ContentPool.projects。
 * 引擎不写死任何领域中文或数值表。金额单位统一为「元」（整数），进 s.money 账本。
 */
import {
  NEGOTIATE,
  PROJECTS_POOL as POOL,
  PROJECT_TPL_BY_ID,
  evalRequires,
  type ProjectTemplate,
} from "../worlds/star2005/content";
import { dayDateLabel, dowOf } from "./logic";
import { clampStat, type StatKey } from "./data";
import { liveArray } from "../mods/live";
import type { GameState } from "./logic";
import { liveTerm as T } from "../mods/live";

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/* 确定性伪随机：由 key 派生 [0,1) */
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
}
const jitterOf = (key: string, amp: number) => (hash(key) * 2 - 1) * amp;

/* ═══════════════ 持久化数据结构（存档字段） ═══════════════ */
export type ProjectStatus =
  | "open" | "applied" | "pending_result" | "offered" | "signed"
  | "in_progress" | "completed" | "failed" | "breached" | "released" | "expired";

export type AuditionOutcome = "formal" | "downgrade" | "reject";

export type ProjectContract = {
  totalYuan: number;
  advanceYuan: number;
  finalYuan: number;
  advanceRate: number;
  breachYuan: number;
  workDays: number[]; // 绝对 day 索引
  signedDay: number;
};

export type ProjectInstance = {
  id: string;
  templateId: string;
  status: ProjectStatus;
  roleType: string;
  rewardMultiplier: number;
  outcome?: AuditionOutcome;
  playerScore?: number;
  rivalScore?: number;
  rivalName?: string;
  rivalTookRole?: boolean;
  contract?: ProjectContract;
  negotiated?: boolean; // 是否已协商过报酬（一次性）
  feeBonusRate?: number; // 协商成功后的报酬上浮比例
  resultDay?: number; // 试镜结果公布日（绝对 day；§19.6 结果不即时）
  workLog: number[];
  crashCount: number;
  quality?: number;
  gradeId?: string;
  gradeLabel?: string;
  createdWeek: number;
  history: string[];
};

export type WorkPiece = {
  projectId: string;
  title: string;
  category: string;
  role: string;
  quality: number;
  starLevel: number;
  releaseDay: number;
  released: boolean;
  publicityIndex: number; // 宣传指数（发行前每次宣传 +50）
  publicityUses: number; // 已宣传次数（每部最多 2 次）
  buzzScore?: number; // 发行时结算的传播分
  buzzTier?: "none" | "small" | "big"; // 小爆 / 大爆
  fameAwarded: number;
  repAwarded: number;
};

/* ═══════════════ 显示映射（读内容池，引擎不写中文） ═══════════════ */
export const statusLabel = (st: ProjectStatus) => POOL.statusLabels[st] ?? st;
export const categoryLabel = (c: string) => POOL.categoryLabels[c] ?? c;
export const roleLabel = (r: string) => POOL.roleTypeLabels[r] ?? r;
export const tplOf = (id: string): ProjectTemplate | undefined => PROJECT_TPL_BY_ID[id];
export const STRATEGIES = liveArray(() => POOL.workStrategies);

/* ═══════════════ 通用运算 ═══════════════ */
function mainReqValue(tpl: ProjectTemplate): number {
  const r = tpl.roleSlot.requirements.find((x) => x.metric === "stats." + tpl.mainStat);
  return r?.value ?? 200;
}
function statVal(s: GameState, key: string): number {
  return (s.stats as Record<string, number>)[key] ?? 0;
}
export function hardGate(s: GameState, tpl: ProjectTemplate): { ok: boolean; hint: string } {
  return evalRequires(tpl.roleSlot.requirements, s);
}

/* 准备分：基线 + 与该项目负责人的关系加成（好感 s.rel + 私人信任 relations.trust） */
function prepScore(s: GameState, tpl: ProjectTemplate): number {
  const A = POOL.audition;
  const base = A.prepBase ?? 0.5;
  const pid = tpl.managerNpcId;
  if (!pid) return base;
  const friend = clamp((s.rel?.[pid] ?? 0) / 100, 0, 1);
  const trust = clamp((s.relations?.[pid]?.trust ?? 0) / 100, 0, 1);
  const rel = (friend + trust) / 2;
  return clamp(base + rel * (A.managerPrepBonus ?? 0), 0, 1);
}

/* 竞争分：玩家与 NPC 同一公式（section 六），prep 为项目准备分 0~1 */
function auditionScore(a: {
  mainNorm: number; subNorm: number; fit: number; prep: number; trust: number; rep: number;
  stress: number; breaches: number; jitter: number;
}): number {
  const A = POOL.audition;
  return (
    A.wMain * a.mainNorm + A.wSub * a.subNorm + A.wFit * a.fit + A.wPrep * a.prep +
    A.wTrust * (a.trust / 100) + A.wRep * (a.rep / 100) -
    A.stressPer10 * (a.stress / 10) - A.breachPer * a.breaches + a.jitter
  );
}

/* ═══════════════ 状态同步：物化开放公告 / 过期 ═══════════════ */
export function syncOpenProjects(s: GameState): ProjectInstance[] {
  const list = (s.projects ?? []).map((p) => ({ ...p }));
  const byTpl = new Set(list.map((p) => p.templateId));
  // 到期开放：窗口内且未物化 → 生成 open 实例
  for (const tpl of POOL.projects) {
    if (byTpl.has(tpl.id)) continue;
    if (s.week >= tpl.openWeek && s.week <= tpl.deadlineWeek) {
      list.push({
        id: tpl.id, templateId: tpl.id, status: "open", roleType: tpl.roleSlot.roleType,
        rewardMultiplier: tpl.roleSlot.rewardMultiplier, workLog: [], crashCount: 0,
        createdWeek: s.week, history: [`第${s.week}周·公告开放（${tpl.source}）`],
      });
    }
  }
  // 过期：仍未推进的开放/申请类，超过截止周 → expired（保留历史卡）
  for (const p of list) {
    const tpl = tplOf(p.templateId);
    if (!tpl) continue;
    if (["open", "applied", "pending_result"].includes(p.status) && s.week > tpl.deadlineWeek) {
      p.status = "expired";
      p.history.push(`第${s.week}周·错过截止，公告过期`);
    }
  }
  return list;
}

/* ═══════════════ 发行结算（每日推进时调用） ═══════════════ */
export function processReleases(s: GameState): { portfolio: WorkPiece[]; fame: number; rep: number; works: number; events: string[] } {
  const portfolio = (s.portfolio ?? []).map((w) => ({ ...w }));
  let fame = 0, rep = 0, works = 0;
  const events: string[] = [];
  for (const w of portfolio) {
    if (w.released || w.releaseDay > s.day) continue;
    const tpl = tplOf(w.projectId);
    const star = tpl?.starLevel ?? 1;
    const base = POOL.releaseFame[String(star)] ?? 8;
    const bonus = w.quality >= 85 ? POOL.releaseQBonus : 0;
    // 传播分：质量 + 发布时名气 + 宣传指数；达阈值触发小爆/大爆额外名气
    const B = POOL.buzz;
    const fameAtRelease = s.fame + fame; // 本次推进内累计后的发布时名气
    const buzz = clamp(B.wQ * w.quality + B.wFame * (fameAtRelease / 10) + B.wPublicity * w.publicityIndex, 0, 100);
    let buzzBonus = 0;
    let tier: WorkPiece["buzzTier"] = "none";
    if (buzz >= B.bigMin) { buzzBonus = B.bigBonus; tier = "big"; }
    else if (buzz >= B.smallMin) { buzzBonus = B.smallBonus; tier = "small"; }
    const fg = base + bonus + buzzBonus;
    const rg = Math.round(POOL.releaseRepBase * (w.quality / 100));
    w.released = true;
    w.buzzScore = Math.round(buzz);
    w.buzzTier = tier;
    w.fameAwarded = fg;
    w.repAwarded = rg;
    fame += fg; rep += rg; works += 1;
    const tierNote = tier === "big" ? `${B.labels.big}（传播分 ${Math.round(buzz)}，额外 +${buzzBonus}）` : tier === "small" ? `${B.labels.small}（传播分 ${Math.round(buzz)}，额外 +${buzzBonus}）` : "";
    events.push(`《${w.title}》正式播出：名气 +${fg}，口碑 +${rg}。${tierNote}`);
  }
  return { portfolio, fame, rep, works, events };
}

/* ═══════════════ 动作：投递 ═══════════════ */
export type ActResult = { next: GameState; ok: boolean; msg: string };

function withProjects(s: GameState, projects: ProjectInstance[], extra: Partial<GameState> = {}): GameState {
  return { ...s, projects, ...extra };
}
function findInst(list: ProjectInstance[], id: string) {
  return list.find((p) => p.id === id);
}

export function applyProject(s: GameState, id: string): ActResult {
  const list = syncOpenProjects(s);
  const p = findInst(list, id);
  const tpl = p && tplOf(p.templateId);
  if (!p || !tpl) return { next: s, ok: false, msg: "" };
  if (p.status !== "open") return { next: withProjects(s, list), ok: false, msg: "该公告已不在可投递状态。" };
  const gate = hardGate(s, tpl);
  if (!gate.ok) return { next: withProjects(s, list), ok: false, msg: `硬性门槛未达标（${gate.hint}），不抽概率、不占日期。` };
  const delay = Math.max(1, Math.round(POOL.audition.processDelay ?? 3));
  const resultDay = s.day + delay;
  p.status = "pending_result";
  p.resultDay = resultDay;
  p.history.push(`第${s.week}周·投递资料，${dayDateLabel(resultDay)} 公布试镜结果`);
  return {
    next: withProjects(s, list),
    ok: true,
    msg: `已向${npcName(tpl)}投递《${tpl.title}》资料。制作方将于 ${dayDateLabel(resultDay)} 公布试镜结果。`,
  };
}

/* 结算一场试镜：写入双方竞争分与录用/降级/落选，返回给玩家的可读结论。
 * 纯确定性——同 seed（题材 id + 周）重算同结果；不含体力开销（报名时已扣）。 */
function settleAudition(s: GameState, p: ProjectInstance, tpl: ProjectTemplate): { reason: string; outcome: AuditionOutcome } {
  const A = POOL.audition;
  const reqMain = mainReqValue(tpl);
  const pMainNorm = clamp(statVal(s, tpl.mainStat) / (reqMain * 1.5), 0, 1);
  const pSubNorm = clamp(statVal(s, tpl.subStat) / 400, 0, 1);
  const seed = `${tpl.id}:${p.createdWeek}`;
  const prep = prepScore(s, tpl);
  const pScore = auditionScore({
    mainNorm: pMainNorm, subNorm: pSubNorm, fit: tpl.fit, prep,
    trust: s.trust, rep: s.reputation, stress: s.stress, breaches: s.defaults,
    jitter: jitterOf(seed + ":p", A.jitter),
  });
  const c = tpl.competitor;
  const cScore = auditionScore({
    mainNorm: clamp(c.main / (reqMain * 1.5), 0, 1), subNorm: clamp(c.sub / 400, 0, 1),
    fit: c.fit, prep: c.prep, trust: c.trust, rep: c.rep, stress: 0, breaches: 0,
    jitter: jitterOf(seed + ":r", A.jitter),
  });

  p.playerScore = Math.round(pScore);
  p.rivalScore = Math.round(cScore);
  p.rivalName = c.name;
  p.resultDay = undefined;

  let outcome: AuditionOutcome;
  let reason: string;
  if (pScore >= A.formalMin && pScore >= cScore) {
    outcome = "formal"; p.status = "offered"; p.roleType = tpl.roleSlot.roleType; p.rewardMultiplier = tpl.roleSlot.rewardMultiplier;
    reason = `正式录用（你 ${p.playerScore} ≥ ${c.name} ${p.rivalScore}）`;
  } else if (pScore >= A.downgradeMin && pScore >= cScore - A.standbyGap) {
    outcome = "downgrade"; p.status = "offered"; p.roleType = tpl.roleSlot.downgradeType; p.rewardMultiplier = tpl.roleSlot.downgradeMultiplier;
    reason = `惜败${c.name}，制作方提供降级角色「${roleLabel(tpl.roleSlot.downgradeType)}」`;
  } else {
    outcome = "reject"; p.status = "failed"; p.rivalTookRole = true;
    reason = pScore < A.downgradeMin ? `能力差距（你 ${p.playerScore}，门槛 ${A.downgradeMin}）` : `竞争失利，角色被${c.name}拿走（你 ${p.playerScore} < ${p.rivalScore}）`;
  }
  p.outcome = outcome;
  p.history.push(`第${s.week}周·试镜结果：${reason}`);
  return { reason, outcome };
}

/* 处理日结算：所有到公布日的报名一次性出结果（§19.6）。日推进/周结算时调用。 */
export function processAuditions(s: GameState): { next: GameState; events: string[] } {
  const list = syncOpenProjects(s);
  const events: string[] = [];
  for (const p of list) {
    if (p.status !== "pending_result" || p.resultDay == null || p.resultDay > s.day) continue;
    const tpl = tplOf(p.templateId);
    if (!tpl) continue;
    const { reason, outcome } = settleAudition(s, p, tpl);
    const head = outcome === "reject" ? "试镜落选" : outcome === "formal" ? "正式录用" : "降级录用";
    events.push(`${head}——《${tpl.title}》：${reason}。${outcome === "reject" ? "签约前失败不计违约。" : "前往「合同/档期」确认签约。"}`);
  }
  return { next: withProjects(s, list), events };
}

function npcName(tpl: ProjectTemplate): string {
  return PROJECT_TPL_BY_ID[tpl.id]?.managerNpcId ? managerLabel(tpl.managerNpcId) : "负责人";
}
// 负责人显示名从 people 内容池取（此处仅回退，避免引擎写死中文）
function managerLabel(_id: string): string { return "负责人"; }

/* ═══════════════ 动作：试镜/竞争裁决 ═══════════════ */
/* ═══════════════ 动作：签约（原子锁角色位 + 档期 + 预付） ═══════════════ */
function nextWorkDays(s: GameState, list: ProjectInstance[], count: number): number[] | null {
  // 从明天起挑 count 个工作日（周一~周五，dow<5），避开已签合同的档期
  const busy = new Set<number>();
  for (const p of list) if (p.contract && ["signed", "in_progress"].includes(p.status)) for (const d of p.contract.workDays) busy.add(d);
  const out: number[] = [];
  let day = s.day + 1;
  let guard = 0;
  while (out.length < count && guard++ < 400) {
    if (dowOf(day) < 5 && !busy.has(day)) out.push(day);
    day++;
  }
  return out.length === count ? out : null;
}

/* 排他冲突：目标项目的任一排他标签，与已签/在拍/待发行完成项目的标签相交 */
function exclusivityConflict(list: ProjectInstance[], self: ProjectInstance, tpl: ProjectTemplate): { title: string; tag: string } | null {
  if (!tpl.exclusivityTags.length) return null;
  for (const p of list) {
    if (p.id === self.id) continue;
    if (!["signed", "in_progress", "completed"].includes(p.status)) continue;
    const other = tplOf(p.templateId);
    if (!other) continue;
    const tag = tpl.exclusivityTags.find((t) => other.exclusivityTags.includes(t));
    if (tag) return { title: other.title, tag };
  }
  return null;
}

/* 报酬谈判（offer 后一次性）：引擎按负责人好感/信任裁决，写入报酬上浮比例 */
export function negotiateOffer(s: GameState, id: string): ActResult {
  const list = syncOpenProjects(s);
  const p = findInst(list, id);
  const tpl = p && tplOf(p.templateId);
  if (!p || !tpl) return { next: s, ok: false, msg: "" };
  if (p.status !== "offered") return { next: withProjects(s, list), ok: false, msg: "只有已录用的 offer 才能协商报酬。" };
  const N = NEGOTIATE;
  if (p.negotiated) return { next: withProjects(s, list), ok: false, msg: `${N.labels.already}` };
  p.negotiated = true;
  const friend = s.rel?.[tpl.managerNpcId] ?? 0;
  const trust = s.relations?.[tpl.managerNpcId]?.trust ?? 0;
  if (friend < N.friendMin) {
    p.history.push(`第${s.week}周·协商报酬：交情不足，维持原报价`);
    return { next: withProjects(s, list), ok: true, msg: `${N.labels.lowRel}` };
  }
  const chance = Math.min(N.maxChance, N.baseChance + friend * N.perFriend + trust * N.perTrust);
  const roll = hash(`${tpl.id}:neg:${s.week}`) * 100;
  let bonus = 0, note = N.labels.reject;
  if (roll < chance) { bonus = N.raiseRate; note = N.labels.success; }
  else if (roll < chance + N.partialBand) { bonus = N.partialRate; note = N.labels.partial; }
  p.feeBonusRate = bonus;
  const base = Math.round(tpl.feeYuan * p.rewardMultiplier);
  const after = Math.round(base * (1 + bonus));
  p.history.push(`第${s.week}周·协商报酬：${note}${bonus ? `（+${Math.round(bonus * 100)}%）` : ""}`);
  const msg = bonus
    ? `${note}：总报酬 ${wallet.short(base)} → ${wallet.short(after)}（+${Math.round(bonus * 100)}%）。前往签约锁定。`
    : `${note}。可直接按原报价签约。`;
  return { next: withProjects(s, list), ok: true, msg };
}

export function signContract(s: GameState, id: string): ActResult {
  const list = syncOpenProjects(s);
  const p = findInst(list, id);
  const tpl = p && tplOf(p.templateId);
  if (!p || !tpl) return { next: s, ok: false, msg: "" };
  if (p.status !== "offered") return { next: withProjects(s, list), ok: false, msg: "没有可签署的 offer。" };
  // 品类排他：与已签/在拍项目的排他标签冲突则拒签（section 七 校验顺序）
  const conflict = exclusivityConflict(list, p, tpl);
  if (conflict) return { next: withProjects(s, list), ok: false, msg: `品类排他冲突：已签《${conflict.title}》占用「${conflict.tag}」，同类只能签其一。` };
  const workDays = nextWorkDays(s, list, tpl.workDayCount);
  if (!workDays) return { next: withProjects(s, list), ok: false, msg: "未来档期与已签项目冲突，无法锁定工作日。" };
  const total = Math.round(tpl.feeYuan * p.rewardMultiplier * (1 + (p.feeBonusRate ?? 0)));
  const advance = Math.round(total * tpl.advanceRate);
  p.contract = {
    totalYuan: total, advanceYuan: advance, finalYuan: 0, advanceRate: tpl.advanceRate,
    breachYuan: Math.round(total * tpl.breachRate), workDays, signedDay: s.day,
  };
  p.status = "signed";
  p.history.push(`第${s.week}周·签约：预付 ${wallet.short(advance)}，锁定 ${workDays.length} 个工作日`);
  return {
    next: wallet.add(withProjects(s, list), advance),
    ok: true,
    msg: `已签约《${tpl.title}》：预付款 ${wallet.short(advance)}到账，档期锁定。到工作日前往「进行中」拍摄。`,
  };
}

/* ═══════════════ 动作：逐日拍摄 ═══════════════ */
export function isWorkdayToday(s: GameState, p: ProjectInstance): boolean {
  return !!p.contract && (p.status === "signed" || p.status === "in_progress") && p.contract.workDays.includes(s.day) && p.workLog.length < p.contract.workDays.length;
}

export function doWorkday(s: GameState, id: string, strategyId: string): ActResult {
  const list = syncOpenProjects(s);
  const p = findInst(list, id);
  const tpl = p && tplOf(p.templateId);
  if (!p || !tpl || !p.contract) return { next: s, ok: false, msg: "" };
  if (!isWorkdayToday(s, p)) return { next: withProjects(s, list), ok: false, msg: "今天不是该项目的工作日。" };
  const strat = STRATEGIES.find((x) => x.id === strategyId) ?? STRATEGIES[0];

  let stress = clamp(s.stress + strat.stress, 0, 100);

  // 高压失控：压力触线时按概率失控；体能、好友撑腰、恋人陪伴都能减压
  const CR = POOL.crash;
  let crashed = false;
  if (stress >= CR.stressGate) {
    let chance = CR.baseChance;
    if (s.stats.tineng >= CR.tinengThreshold) chance -= CR.tinengRelief;
    const hasCloseFriend = Object.values(s.rel ?? {}).some((v) => v >= CR.friendReliefMin);
    if (hasCloseFriend) chance -= CR.friendRelief;
    if (s.dating) chance -= CR.datingRelief;
    chance = Math.max(CR.minChance, chance);
    crashed = hash(`${tpl.id}:crash:${s.day}`) * 100 < chance;
  }

  const reqMain = mainReqValue(tpl);
  const abilityFactor = clamp(statVal(s, tpl.mainStat) / (reqMain * 1.5), 0, 1);
  const dayIdx = p.workLog.length;
  const jit = jitterOf(`${tpl.id}:wd:${dayIdx}`, 6);
  let perf = strat.floor + (strat.ceil - strat.floor) * abilityFactor + tpl.fit * 5 - (stress / 10) * 0.5 + jit;
  if (crashed) { perf -= CR.perfPenalty; p.crashCount += 1; }

  // 片场结构化事件：按题材抽一条现场事件，用属性判定过关，套用增减
  let reputation = s.reputation;
  let eventMsg = "";
  const ON = POOL.onSet;
  const pool = ON?.byCategory[tpl.category] ?? [];
  if (pool.length && hash(`${tpl.id}:onset:roll:${dayIdx}`) * 100 < ON.triggerChance) {
    const ev = pool[Math.floor(hash(`${tpl.id}:onset:pick:${dayIdx}`) * pool.length) % pool.length];
    const passed = statVal(s, ev.stat) >= ev.threshold;
    const out = passed ? ev.pass : ev.fail;
    perf += out.perf;
    stress = clamp(stress + out.stress, 0, 100);
    reputation = clamp(reputation + (out.rep < 0 ? Math.round(out.rep * orderMods().scandal) : out.rep), 0, 100); // 世界规则·社会秩序
    eventMsg = `\n现场事件「${ev.label}」：${out.note}（表现 ${out.perf >= 0 ? "+" : ""}${out.perf}）`;
    p.history.push(`第${s.week}周·现场事件「${ev.label}」${passed ? "过关" : "失手"}`);
  }

  perf = clamp(Math.round(perf), 0, 100);

  p.workLog.push(perf);
  p.status = "in_progress";
  p.history.push(`第${s.week}周·工作日${dayIdx + 1}（${strat.label}）：表现 ${perf}${crashed ? "（状态失控）" : ""}`);

  let next = withProjects(s, list, { stress, reputation });
  let msg = `《${tpl.title}》第 ${dayIdx + 1}/${p.contract.workDays.length} 个工作日（${strat.label}）：当日表现 ${perf}。${crashed ? "状态失控，需后续修复。" : ""}${eventMsg}`;

  // 完成所有工作日 → 结算 Q
  if (p.workLog.length >= p.contract.workDays.length) {
    const done = completeProject(next, id);
    next = done.next;
    msg += "\n" + done.msg;
  }
  return { next, ok: true, msg };
}

/* ═══════════════ 完成评价 + 财务 + 成长 + 待发行作品 ═══════════════ */
export function completeProject(s: GameState, id: string): ActResult {
  const list = (s.projects ?? []).map((p) => ({ ...p }));
  const p = findInst(list, id);
  const tpl = p && tplOf(p.templateId);
  if (!p || !tpl || !p.contract) return { next: s, ok: false, msg: "" };

  const Q = POOL.quality;
  const avgPerf = p.workLog.length ? p.workLog.reduce((a, b) => a + b, 0) / p.workLog.length : 0;
  const fulfil = 1; // 完成全部工作日
  const quality = clamp(
    Q.wBase * tpl.baseQuality + Q.wPerf * avgPerf + Q.wFulfil * (fulfil * 100) +
    Q.wTrust * s.trust + Q.wPrep * (0.5 * 100) + Q.wFit * (tpl.fit * 100) -
    Q.crashPenalty * p.crashCount,
    0, 100,
  );
  const tier = Q.tiers.find((t) => quality >= t.min) ?? Q.tiers[Q.tiers.length - 1];

  // 财务：应得总额 = 总报酬 × 评价倍率，尾款 = 应得 − 预付（不得为负奖励）
  const earned = Math.round(p.contract.totalYuan * tier.payMul);
  const finalPay = Math.max(0, earned - p.contract.advanceYuan);
  p.contract.finalYuan = finalPay;
  p.quality = Math.round(quality);
  p.gradeId = tier.id;
  p.gradeLabel = tier.label;
  p.status = "completed";

  // 成长（一次性，按星级 × 评价倍率）
  const gMain = Math.round((POOL.growthMain[String(tpl.starLevel)] ?? 8) * tier.growthMul);
  const gSub = Math.round((POOL.growthSub[String(tpl.starLevel)] ?? 4) * tier.growthMul);
  const stats = { ...s.stats } as Record<string, number>;
  stats[tpl.mainStat] = clampStat(tpl.mainStat as StatKey, stats[tpl.mainStat] + gMain);
  stats[tpl.subStat] = clampStat(tpl.subStat as StatKey, stats[tpl.subStat] + gSub);

  // 待发行作品：仅非失败的合法完成才入库
  const portfolio = (s.portfolio ?? []).map((w) => ({ ...w }));
  let releaseNote = "";
  if (tier.id !== "failed") {
    const releaseDay = s.day + tpl.releaseDelayDays;
    portfolio.push({
      projectId: tpl.id, title: tpl.title, category: tpl.category, role: roleLabel(p.roleType),
      quality: p.quality, starLevel: tpl.starLevel, releaseDay, released: false,
      publicityIndex: 0, publicityUses: 0, fameAwarded: 0, repAwarded: 0,
    });
    releaseNote = `作品进入后期，将于 ${tpl.releaseDelayDays} 天后（第 ${Math.floor(releaseDay / 7) + 1} 周）发行。`;
  } else {
    releaseNote = `项目失败，不发行，仅保留${T("gig")}履历。`;
  }

  p.history.push(`第${s.week}周·杀青：${tier.label}（Q=${p.quality}），尾款 ${wallet.short(finalPay)}`);

  const next: GameState = {
    ...wallet.add(s, finalPay),
    projects: list,
    portfolio,
    stats: stats as GameState["stats"],
    reputation: clamp(s.reputation + tier.rep, 0, 100),
    trust: clamp(s.trust + tier.trust, 0, 100),
    defaults: s.defaults,
  };
  const msg = `《${tpl.title}》杀青 · ${tier.label}（Q=${p.quality}）：尾款 ${wallet.short(finalPay)}，${tpl.mainStat} +${gMain}、${tpl.subStat} +${gSub}。${releaseNote}`;
  return { next, ok: true, msg };
}

/* ═══════════════ 动作：发行前宣传造势（每部最多两次） ═══════════════ */
export function promoteWork(s: GameState, projectId: string): ActResult {
  const PB = POOL.publicity;
  const portfolio = (s.portfolio ?? []).map((w) => ({ ...w }));
  const w = portfolio.find((x) => x.projectId === projectId && !x.released);
  if (!w) return { next: s, ok: false, msg: "没有可宣传的待发行作品。" };
  if (w.publicityUses >= PB.maxUses) return { next: s, ok: false, msg: `${PB.labels.maxed}` };
  if (!wallet.can(s, PB.costYuan)) return { next: s, ok: false, msg: `${PB.labels.lowMoney}` };
  w.publicityUses += 1;
  w.publicityIndex += PB.indexPer;
  const next: GameState = {
    ...wallet.add(s, -PB.costYuan),
    portfolio,
    stress: clamp(s.stress + PB.stress, 0, 100),
  };
  return {
    next,
    ok: true,
    msg: `《${w.title}》${PB.labels.done}：宣传费 -${wallet.fmt(PB.costYuan)}，压力 +${PB.stress}，宣传指数 +${PB.indexPer}（累计 ${w.publicityIndex}，第 ${w.publicityUses}/${PB.maxUses} 次）。`,
  };
}

/* 视图辅助：分桶给 UI 五个页面 */
export function bucketProjects(list: ProjectInstance[]) {
  return {
    hall: list.filter((p) => p.status === "open"),
    applications: list.filter((p) => ["applied", "pending_result", "offered"].includes(p.status)),
    contracts: list.filter((p) => p.status === "signed"),
    ongoing: list.filter((p) => p.status === "in_progress"),
    history: list.filter((p) => ["completed", "released", "failed", "breached", "expired"].includes(p.status)),
  };
}
