/* ═══════════════ 制作人对话接通告（section 十八 · 纯引擎） ═══════════════
 * 玩家须登门洽谈、逐步追问才解锁项目字段；解锁到「要求」后方可争取角色。
 * 引擎只做：会面行动力扣减、当日幂等、字段解锁记录、依赖校验；
 * 全部问句/遮罩/按钮中文文案都在 ContentPool（projects.yaml · producer）。
 */
import type { GameState } from "./logic";
import { PRODUCER, PROJECT_TEMPLATES, PROJECT_TPL_BY_ID, type ProjectTemplate, type ProducerQuestion } from "../worlds/star2005/content";

export type ProducerResult = { next: GameState; ok: boolean; msg: string };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/* 某负责人当前档期内（openWeek≤week≤deadlineWeek）负责的项目模板 */
export function producerProjects(s: GameState, managerId: string): ProjectTemplate[] {
  return PROJECT_TEMPLATES.filter(
    (t) => t.managerNpcId === managerId && s.week >= t.openWeek && s.week <= t.deadlineWeek,
  );
}
export const isManager = (managerId: string) => PROJECT_TEMPLATES.some((t) => t.managerNpcId === managerId);

/* 今日是否已在洽谈中（当日追问免行动力） */
export const metToday = (s: GameState, managerId: string) =>
  (s.lastMeetDay?.[managerId] ?? -999) === s.day;

/* 已解锁字段 */
export const factsOf = (s: GameState, pid: string): string[] => s.knownFacts?.[pid] ?? [];
export const knows = (s: GameState, pid: string, field: string) => factsOf(s, pid).includes(field);

/* 登门洽谈：扣行动力、置当日会面（幂等：当日重复不再扣） */
export function meetProducer(s: GameState, managerId: string, name?: string): ProducerResult {
  const P = PRODUCER;
  const who = name ?? "负责人";
  if (!isManager(managerId)) return { next: s, ok: false, msg: `${P.labels.notManager}` };
  if (metToday(s, managerId)) return { next: s, ok: false, msg: `${P.labels.meetDone}` };
  const next: GameState = {
    ...s,
    lastMeetDay: { ...(s.lastMeetDay ?? {}), [managerId]: s.day },
  };
  return { next, ok: true, msg: `你与${who}坐下洽谈。${P.labels.intro}` };
}

/* 某问句对某项目是否已可问（依赖字段均已解锁且尚未问过） */
export function questionState(s: GameState, pid: string, q: ProducerQuestion): "asked" | "ready" | "locked" {
  const facts = factsOf(s, pid);
  if (q.reveals.every((f) => facts.includes(f))) return "asked";
  if ((q.requires ?? []).every((r) => facts.includes(r))) return "ready";
  return "locked";
}

/* 追问：解锁该问句的字段（需当日已会面 + 依赖已满足；幂等） */
export function askProducer(s: GameState, managerId: string, pid: string, questionId: string): ProducerResult {
  const P = PRODUCER;
  const tpl = PROJECT_TPL_BY_ID[pid];
  const q = P.questions.find((x) => x.id === questionId);
  if (!tpl || !q) return { next: s, ok: false, msg: "" };
  if (!metToday(s, managerId)) return { next: s, ok: false, msg: `请先「${P.labels.meet}」再追问。` };
  const facts = factsOf(s, pid);
  if (!(q.requires ?? []).every((r) => facts.includes(r))) {
    return { next: s, ok: false, msg: `${P.labels.lockedHint}` };
  }
  const add = q.reveals.filter((f) => !facts.includes(f));
  if (!add.length) return { next: s, ok: true, msg: "（这些你已经问过了）" };
  const next: GameState = {
    ...s,
    knownFacts: { ...(s.knownFacts ?? {}), [pid]: [...facts, ...add] },
  };
  return { next, ok: true, msg: `${tpl.title} · ${P.labels.source ?? ""}你了解到了新的信息。` };
}

/* 已通过洽谈发现过（有任一已知字段）的项目 → 通告大厅只整理这些线索 */
export const discoveredProjectIds = (s: GameState): Set<string> =>
  new Set(Object.keys(s.knownFacts ?? {}).filter((pid) => (s.knownFacts?.[pid]?.length ?? 0) > 0));

/* 是否可争取角色：已问到「要求」字段（心里有数）后方可 */
export const canPursue = (s: GameState, pid: string) => knows(s, pid, "requirements");
