/* 人脉页面配置（内容槽 contacts）：分组、卡片双数值、关系阶段标签库、所属组织库全部由作者配置。
 * 引擎只负责解析；任何题材的分组名 / 图标 / 阶段词都写在数据里，不写死在界面。 */
import { slot } from "../mods/live";
import { term } from "../mods/registry";
import { FAMILY_NPC_IDS } from "./family";
import { PROJECT_TEMPLATES } from "../worlds/star2005/content";

export const CONTACT_ICONS = ["dot", "heart", "star", "gem", "book", "sword", "coin", "flame", "shield", "eye", "leaf", "moon"] as const;
export type ContactIcon = (typeof CONTACT_ICONS)[number];
export const CONTACT_ICON_LABEL: Record<ContactIcon, string> = {
  dot: "圆点", heart: "心", star: "星", gem: "玉 / 宝石", book: "书卷", sword: "剑", coin: "钱币", flame: "火焰", shield: "盾", eye: "眼", leaf: "叶", moon: "月",
};
export const CONTACT_TONES = ["jade", "coral", "gold", "danger", "ink"] as const;
export type ContactTone = (typeof CONTACT_TONES)[number];

/* 数值来源：rel = 此人与主角的关系值（好感 / 交情…叫法由阶段词决定）；stat / metric 与全局属性池（valueSources）同一套 key */
export type ContactSrc = { kind: "rel" } | { kind: "stat" | "metric"; key: string; label: string };
export type ContactMetric = { src: ContactSrc; icon: ContactIcon; tone?: ContactTone };
/* 分组：成员 = 角色编辑器里勾选的 + ids 名单 + 身份关键词命中；rest = 未归入任何组者的兜底组；pool = 世界自动生成的人物池 */
export type ContactGroup = { id: string; label: string; ids?: string[]; keywords?: string[]; rest?: boolean; pool?: boolean; fold?: number };
/* 关系阶段：关系值 ≥ min 时取 min 最大的一条；groups 非空时只对这些分组的成员生效（如亲人专用词） */
export type ContactStage = { id: string; label: string; min: number; tone?: ContactTone; groups?: string[] };
export type ContactOrg = { id: string; label: string; ids?: string[] };
export type ContactsSlot = {
  title?: string; // 页面标题 / 底部标签
  subtitle?: string;
  groups?: ContactGroup[];
  metrics?: ContactMetric[]; // 最多两项：左 / 右
  stages?: ContactStage[];
  orgs?: ContactOrg[];
};

/* 娱乐圈世界原有分组与阶段词：仅作为该世界的数据默认值，迁移旧存档表现 */
const ENT_STAGES: ContactStage[] = [
  { id: "f65", label: "至亲至爱", min: 65, tone: "jade", groups: ["family"] },
  { id: "f40", label: "血浓于水", min: 40, tone: "jade", groups: ["family"] },
  { id: "f20", label: "亲近和睦", min: 20, tone: "jade", groups: ["family"] },
  { id: "f1", label: "尚算融洽", min: 1, tone: "gold", groups: ["family"] },
  { id: "f0", label: "形同陌路", min: 0, tone: "gold", groups: ["family"] },
  { id: "f-1", label: "心生嫌隙", min: -39, tone: "danger", groups: ["family"] },
  { id: "f-40", label: "反目成仇", min: -100, tone: "danger", groups: ["family"] },
  { id: "s65", label: "情愫暗生", min: 65, tone: "coral" },
  { id: "s40", label: "亲密无间", min: 40, tone: "jade" },
  { id: "s20", label: "渐生好感", min: 20, tone: "jade" },
  { id: "s1", label: "点头之交", min: 1, tone: "gold" },
  { id: "s0", label: "萍水相逢", min: 0, tone: "gold" },
  { id: "s-1", label: "心存芥蒂", min: -39, tone: "danger" },
  { id: "s-40", label: "势同水火", min: -100, tone: "danger" },
];
const entContacts = (): ContactsSlot => ({
  subtitle: "圈中往来",
  groups: [
    { id: "family", label: "家人 · 双亲", ids: [...FAMILY_NPC_IDS] },
    { id: "producer", label: "制作人 · 片场负责人", ids: [...new Set(PROJECT_TEMPLATES.map((t) => t.managerNpcId).filter(Boolean) as string[])] },
    { id: "star", label: "圈内艺人", keywords: ["演员", "歌手", "艺人", "明星", "偶像", "模特", "主持", "练习生", "新人"], pool: true, fold: 6 },
    { id: "other", label: "其他往来", rest: true },
  ],
  metrics: [{ src: { kind: "rel" }, icon: "heart", tone: "coral" }, { src: { kind: "metric", key: "fame", label: "名气" }, icon: "star", tone: "gold" }],
  stages: ENT_STAGES,
});
/* 未配置的世界：中性兜底（单一分组 + 关系值 + 通用阶段词） */
const genericContacts = (): ContactsSlot => ({
  groups: [{ id: "all", label: "往来人物", rest: true, pool: true }],
  metrics: [{ src: { kind: "rel" }, icon: "dot", tone: "jade" }],
  stages: [
    { id: "g85", label: "挚交", min: 85, tone: "jade" },
    { id: "g60", label: "亲近", min: 60, tone: "jade" },
    { id: "g30", label: "熟络", min: 30, tone: "jade" },
    { id: "g0", label: "相识", min: 0, tone: "gold" },
    { id: "g-10", label: "疏远", min: -39, tone: "danger" },
    { id: "g-40", label: "交恶", min: -100, tone: "danger" },
  ],
});
export const contactsDefaults = { ent: entContacts, generic: genericContacts };

/* 当前生效配置：作者声明的字段覆盖默认值，缺省字段用默认兜底 */
export function contactsCfg(): Required<Pick<ContactsSlot, "groups" | "metrics" | "stages" | "orgs">> & ContactsSlot {
  const base = slot<ContactsSlot>("contacts", entContacts, genericContacts) ?? genericContacts();
  const fb = genericContacts();
  return {
    ...base,
    groups: base.groups?.length ? base.groups : fb.groups!,
    metrics: (base.metrics ?? fb.metrics!).slice(0, 2),
    stages: base.stages?.length ? base.stages : fb.stages!,
    orgs: base.orgs ?? [],
  };
}

/* 归组：显式勾选优先；否则 ids / 关键词；都不中则进兜底组 */
export function groupsOf(cfg: ContactsSlot, p: { id: string; text: string; explicit?: string[]; pool?: boolean }): string[] {
  const groups = cfg.groups ?? [];
  const valid = new Set(groups.map((g) => g.id));
  const exp = (p.explicit ?? []).filter((g) => valid.has(g));
  if (exp.length) return exp;
  const hit = groups.filter((g) => (p.pool && g.pool) || g.ids?.includes(p.id) || (g.keywords ?? []).some((k) => k.trim() && p.text.includes(k.trim()))).map((g) => g.id);
  if (hit.length) return hit;
  return groups.filter((g) => g.rest).map((g) => g.id);
}

/* 阶段词：只看适用于该人所在分组的条目 */
export function stageOf(cfg: ContactsSlot, value: number, groups: string[]): ContactStage | undefined {
  const ok = (cfg.stages ?? []).filter((s) => !s.groups?.length || s.groups.some((g) => groups.includes(g)));
  const scoped = ok.filter((s) => s.groups?.length);
  const pick = (list: ContactStage[]) => [...list].sort((a, b) => b.min - a.min).find((s) => value >= s.min);
  return (scoped.length ? pick(scoped) : undefined) ?? pick(ok.filter((s) => !s.groups?.length)) ?? pick(ok);
}

export function orgOf(cfg: ContactsSlot, id: string, explicit?: string): string | undefined {
  const orgs = cfg.orgs ?? [];
  return (explicit ? orgs.find((o) => o.id === explicit)?.label : undefined) ?? orgs.find((o) => o.ids?.includes(id))?.label;
}

/* 页面标题 / 底部标签：配置优先，其次沿用「术语」里的 tabNpc */
export const contactsTitle = () => contactsCfg().title?.trim() || term("tabNpc", "人脉");

export const metricKey = (s: ContactSrc) => (s.kind === "rel" ? "rel" : `${s.kind}:${s.key}`);
