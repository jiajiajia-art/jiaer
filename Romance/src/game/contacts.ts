/* 人脉关系档位（内容槽 contacts）：嵌在「人物」上方统一配置，非独立大页。
 * 玩家列表只按关系阶段分组；卡片数值已下线；groups / orgs / stage.groups 仅旧数据兼容，运行时忽略。 */
import { slot } from "../mods/live";
import { term } from "../mods/registry";
import { groupByContactStage, normalizeContactStages, resolveContactStage } from "./contactStageGrouping";

export const CONTACT_ICONS = ["dot", "heart", "star", "gem", "book", "sword", "coin", "flame", "shield", "eye", "leaf", "moon"] as const;
export type ContactIcon = (typeof CONTACT_ICONS)[number];
export const CONTACT_ICON_LABEL: Record<ContactIcon, string> = {
  dot: "圆点", heart: "心", star: "星", gem: "玉 / 宝石", book: "书卷", sword: "剑", coin: "钱币", flame: "火焰", shield: "盾", eye: "眼", leaf: "叶", moon: "月",
};
export const CONTACT_TONES = ["jade", "coral", "gold", "danger", "ink"] as const;
export type ContactTone = (typeof CONTACT_TONES)[number];

/* 数值来源：rel = 此人与主角的关系值（好感 / 交情…叫法由阶段词决定）；stat / metric 与全局属性池（valueSources）同一套 key */
export type ContactSrc = { kind: "rel" } | { kind: "stat" | "metric"; key: string; label: string };
export type ContactMetric = { src: ContactSrc; icon: ContactIcon; tone?: ContactTone; hidden?: boolean };
/** @deprecated 旧版自定义分组；新版本只按关系阶段分组。 */
export type ContactGroup = { id: string; label: string; ids?: string[]; keywords?: string[]; rest?: boolean; pool?: boolean; fold?: number };
/* 关系阶段：关系值 ≥ min 时取 min 最大的一条；数组顺序就是玩家页分组顺序。 */
export type ContactStage = { id: string; label: string; min: number; tone?: ContactTone; groups?: string[] };
/** @deprecated 旧版组织库；组织只作为人物卡片资料展示，不参与分组。 */
export type ContactOrg = { id: string; label: string; ids?: string[] };
export type ContactsSlot = {
  title?: string; // 页面标题 / 底部标签
  subtitle?: string;
  groups?: ContactGroup[]; // 旧数据兼容：读取时丢弃
  /** @deprecated 卡片数值已下线；读取时清空，不再展示 */
  metrics?: ContactMetric[];
  stages?: ContactStage[];
  orgs?: ContactOrg[]; // 旧数据兼容：读取时丢弃
};

/* 娱乐圈默认阶段词：去掉旧版“家人专用分组”，所有人物走同一套关系阶段。 */
const ENT_STAGES: ContactStage[] = [
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
  metrics: [],
  stages: ENT_STAGES,
});
/* 未配置的世界：直接展示中性阶段预览，不用先载入模板。 */
const genericContacts = (): ContactsSlot => ({
  metrics: [],
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

/**
 * 功能注释：把旧 contacts 数据收敛为「仅关系阶段」；卡片数值一律清空；模板或旧包携带的组织/自定义分组直接丢弃。
 * fallback 用于尚未自定义时立即展示世界默认，而不是空白或模板选择门槛。
 */
export function normalizeContactsSlot(raw?: ContactsSlot | null, fallback?: ContactsSlot): ContactsSlot & Required<Pick<ContactsSlot, "metrics" | "stages">> {
  const base = raw ?? fallback ?? genericContacts();
  const fb = fallback ?? genericContacts();
  const stages = normalizeContactStages(base.stages?.length ? base.stages : fb.stages ?? genericContacts().stages!) as ContactStage[];
  return {
    ...(base.title?.trim() ? { title: base.title.trim() } : {}),
    ...(base.subtitle?.trim() ? { subtitle: base.subtitle.trim() } : {}),
    metrics: [],
    stages,
  };
}

/** 功能注释：卡片数值已下线，恒返回空（保留函数以免 NpcTab 调用方改动过大） */
export function visibleContactMetrics(_cfg: ContactsSlot): ContactMetric[] {
  void _cfg;
  return [];
}

/* 当前生效配置：作者声明覆盖世界默认；旧分组/组织字段不会进入运行时。 */
export function contactsCfg(): ContactsSlot & Required<Pick<ContactsSlot, "metrics" | "stages">> {
  const base = slot<ContactsSlot>("contacts", entContacts, genericContacts);
  return normalizeContactsSlot(base, genericContacts());
}

/* 阶段词：只按关系值判定；旧 groups 限定完全忽略，最低阶段兜底确保人物不会消失。 */
export function stageOf(cfg: ContactsSlot, value: number, _legacyGroups?: string[]): ContactStage | undefined {
  return resolveContactStage(cfg.stages ?? [], value) as ContactStage | undefined;
}

/** 功能注释：按配置顺序生成玩家页阶段分组；每个人只进入当前阶段一次。 */
export function groupContactsByStage<T>(
  cfg: ContactsSlot,
  entries: readonly T[],
  relationValue: (entry: T) => number,
): Array<{ stage: ContactStage; people: T[] }> {
  return groupByContactStage(normalizeContactsSlot(cfg).stages, entries, relationValue) as Array<{ stage: ContactStage; people: T[] }>;
}

/* 页面标题 / 底部标签：配置优先，其次沿用「术语」里的 tabNpc */
export const contactsTitle = () => contactsCfg().title?.trim() || term("tabNpc", "人脉");

export const metricKey = (s: ContactSrc) => (s.kind === "rel" ? "rel" : `${s.kind}:${s.key}`);
