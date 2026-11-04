/**
 * 模组保存前自愈：AI / 半成品常缺 id、数组里塞 null。
 * 保存时自动补编号；世界书未挂地点/人物不再停用或拦保存。
 */
import type { Mod, ModContent } from "../mods/types.ts";
import { worldBookMissingDepsErrors } from "./worldBookDeps.ts";
import { ensureWorldGenStartMoney, healCustomAttrsUnnamed } from "./worldGenCreationAttrs.ts";
import { normalizeRuleBranches } from "./gameRuleShape.ts";
import { asTrimmedString } from "./asTrimmedString.ts";

/** 与 validateMod 对齐：这些数组条目必须有非空 id */
const NEED_ID_KEYS = [
  "npcs",
  "items",
  "gigs",
  "events",
  "fixedEvents",
  "storylines",
  "sidelines",
  "endings",
  "worldBook",
  "worldRules",
  "gameRules",
  "lookRules",
  "trainings",
  "sideJobs",
  "zodiacs",
  "encounters",
  "sideQuests",
  "styles",
  "identities",
  "backgrounds",
  "directions",
  "weekendActs",
  "titles",
  "cars",
  "meals",
  "lore",
  "festivals",
] as const;

type NeedIdKey = (typeof NEED_ID_KEYS)[number];

const KEY_LABEL: Record<string, string> = {
  npcs: "人物",
  items: "物品",
  gigs: "通告",
  events: "事件库",
  fixedEvents: "固定事件",
  storylines: "主线",
  sidelines: "支线",
  endings: "结局",
  worldBook: "世界书",
  worldRules: "世界规则",
  gameRules: "玩法规则",
  lookRules: "剧情美化规则",
  trainings: "课程",
  sideJobs: "打工",
  zodiacs: "星座",
  encounters: "偶遇",
  sideQuests: "支线任务",
  styles: "风格",
  identities: "身份",
  backgrounds: "背景",
  directions: "方向",
  weekendActs: "周末活动",
  titles: "称号",
  cars: "座驾",
  meals: "伙食",
  lore: "详细设定",
  festivals: "节日",
};

const KEY_JUMP: Record<string, { group: "base" | "role" | "grow" | "story" | "look"; target: string }> = {
  fixedEvents: { group: "story", target: "fixed-events" },
  events: { group: "story", target: "fixed-events" },
  worldBook: { group: "story", target: "world-book" },
  storylines: { group: "story", target: "storylines" },
  sidelines: { group: "story", target: "storylines" },
  endings: { group: "story", target: "storylines" },
  npcs: { group: "role", target: "npcs" },
  trainings: { group: "grow", target: "grow-modules" },
  sideJobs: { group: "grow", target: "grow-modules" },
  weekendActs: { group: "grow", target: "grow-modules" },
};

function freshId(prefix: string, taken: Set<string>): string {
  let id = `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
  while (taken.has(id)) id = `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
  return id;
}

function readId(raw: unknown): string {
  if (typeof raw === "string") return raw.trim();
  if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  return "";
}

/**
 * 功能注释：不可变地为缺 id / null / 非对象项补唯一编号。
 * 旧实现就地改写会跳过 null（!row 直接 return），但 validateMod 仍报「缺少 id」——这是线上 12 处拦保存的根因。
 */
export function healMissingContentIds(content: ModContent): string[] {
  const notes: string[] = [];
  for (const key of NEED_ID_KEYS) {
    const raw = content[key as NeedIdKey] as unknown;
    if (raw === undefined || raw === null) continue;
    const arr = Array.isArray(raw) ? raw : [raw];
    const taken = new Set<string>();
    for (const row of arr) {
      if (row && typeof row === "object" && !Array.isArray(row)) {
        const id = readId((row as { id?: unknown }).id);
        if (id) taken.add(id);
      }
    }
    const label = KEY_LABEL[key] ?? key;
    const prefix = key.replace(/[^a-z]/gi, "").slice(0, 3).toLowerCase() || "row";
    const next = arr.map((row, i) => {
      if (row && typeof row === "object" && !Array.isArray(row)) {
        const cur = readId((row as { id?: unknown }).id);
        if (cur) return row as Record<string, unknown>;
        const id = freshId(prefix, taken);
        taken.add(id);
        notes.push(`已为「${label}」第 ${i + 1} 条自动补编号`);
        return { ...(row as object), id };
      }
      // null / 字符串 / 数组等脏项：收成带 id 的对象，避免校验继续报缺 id
      const id = freshId(prefix, taken);
      taken.add(id);
      notes.push(`已为「${label}」第 ${i + 1} 条自动补编号`);
      const name = typeof row === "string" || typeof row === "number" ? String(row) : `未命名${i + 1}`;
      return { id, name };
    });
    (content as Record<string, unknown>)[key] = next;
  }
  return notes;
}

/**
 * 功能注释：地点/人物已可选；不再因未挂依赖自动停用世界书。
 * 保留导出供旧测试引用；恒不改稿、不写说明。
 */
export function healUnboundWorldBook(_content: ModContent): string[] {
  return [];
}

/**
 * 功能注释：AI 常漏写 gameRules[].branches 或写成单对象；validateMod 会拦「须为数组」。
 * 保存前统一 normalize，与 sanitizeModStrings / 编辑器读取路径一致。
 */
export function healGameRulesBranches(content: ModContent): string[] {
  const notes: string[] = [];
  const rules = content.gameRules;
  if (!Array.isArray(rules) || !rules.length) return notes;
  let fixed = 0;
  content.gameRules = rules.map((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return row;
    const raw = row as { branches?: unknown };
    if (Array.isArray(raw.branches)) return row;
    fixed += 1;
    return { ...row, branches: normalizeRuleBranches(raw.branches) };
  }) as ModContent["gameRules"];
  if (fixed) notes.push(`已为 ${fixed} 条玩法规则补全 branches`);
  return notes;
}

/**
 * 功能注释：AI 常把 opening 写成字符串或段落数组；validateMod 要求对象。
 * 能还原成 { paragraphs } 则还原，否则删除以免拦保存。
 */
export function healOpeningShape(content: ModContent): string[] {
  const notes: string[] = [];
  const raw = (content as { opening?: unknown }).opening;
  if (raw === undefined) return notes;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return notes;
  if (typeof raw === "string") {
    const text = raw.trim();
    if (text) {
      (content as { opening?: { paragraphs: string[] } }).opening = { paragraphs: [text] };
      notes.push("已将开场剧情从文本校正为对象");
    } else {
      delete (content as { opening?: unknown }).opening;
      notes.push("已清除空的开场剧情");
    }
    return notes;
  }
  if (Array.isArray(raw)) {
    const paragraphs = raw
      .map((p) => asTrimmedString(p))
      .filter(Boolean);
    if (paragraphs.length) {
      (content as { opening?: { paragraphs: string[] } }).opening = { paragraphs };
      notes.push("已将开场剧情从数组校正为对象");
    } else {
      delete (content as { opening?: unknown }).opening;
      notes.push("已清除空的开场剧情");
    }
    return notes;
  }
  delete (content as { opening?: unknown }).opening;
  notes.push("已清除无效的开场剧情");
  return notes;
}

/**
 * 功能注释：AI 常把 startMoney 写成字符串 / null / 负数；保存前收成非负整数，避免 validateMod「须为非负数字」拦保存。
 * 仅当稿里出现过资金相关字段时才写入（纯扩展模组不强制塞 0）。
 */
export function healStartMoney(content: ModContent): string[] {
  const notes: string[] = [];
  const hasMoneyKey = "startMoney" in content || "moneyLabel" in content;
  if (!hasMoneyKey) return notes;
  const beforeMoney = content.startMoney;
  const beforeLabel = content.moneyLabel;
  const fixed = ensureWorldGenStartMoney({
    startMoney: content.startMoney as unknown,
    moneyLabel: content.moneyLabel as unknown,
  });
  const nextMoney = fixed.startMoney as number;
  const nextLabel = String(fixed.moneyLabel ?? "").trim() || "元";
  const moneyDirty =
    typeof beforeMoney !== "number" || !Number.isFinite(beforeMoney) || beforeMoney < 0 || beforeMoney !== nextMoney;
  const labelDirty = String(beforeLabel ?? "").trim() !== nextLabel;
  if (moneyDirty || labelDirty) {
    content.startMoney = nextMoney;
    content.moneyLabel = nextLabel;
    notes.push(moneyDirty ? "已将开局资金校正为非负数字" : "已补全开局货币名称");
  }
  return notes;
}

/** 功能注释：保存前一次自愈；返回说明文案供顶栏轻提示（世界书未挂依赖不再自愈停用） */
export function healModBeforeSave(content: ModContent): string[] {
  return [
    ...healMissingContentIds(content),
    ...healStartMoney(content),
    ...healGameRulesBranches(content),
    ...healOpeningShape(content),
    // 功能注释：旧 AI 稿里的「未命名」空壳保存时清掉，编辑器不再显示占位行
    ...healCustomAttrsUnnamed(content),
  ];
}

/**
 * 功能注释：与编辑器保存同路径——自愈后再收集世界书依赖 + validateMod 同类缺 id 错误。
 * 供单测断言「脏 AI 稿保存不应再被缺 id / 未挂靠世界书拦住」。
 */
export function collectPostHealIdAndWorldBookErrors(content: ModContent): string[] {
  const errs: string[] = [...worldBookMissingDepsErrors(content.worldBook)];
  for (const key of NEED_ID_KEYS) {
    const arr = content[key as NeedIdKey];
    if (!Array.isArray(arr)) continue;
    arr.forEach((e, i) => {
      if (!e || typeof (e as { id?: unknown }).id !== "string" || !(e as { id: string }).id) {
        errs.push(`content.${key}[${i}] 缺少 id`);
      }
    });
  }
  return errs;
}

/** 功能注释：克隆模组 → 自愈 content → 返回新模组与说明（不改入参） */
export function prepareModForSave(mod: Mod): { mod: Mod; notes: string[] } {
  const next: Mod = structuredClone(mod);
  next.content = next.content ?? ({} as ModContent);
  const notes = healModBeforeSave(next.content);
  return { mod: next, notes };
}

export type SaveErrorJump = {
  group: "base" | "role" | "grow" | "story" | "look";
  target?: string;
};

/** 功能注释：把校验技术串改成创作者可读文案 */
export function humanizeSaveError(raw: string): string {
  const s = String(raw || "").trim();
  const miss = s.match(/^content\.(\w+)\[(\d+)\] 缺少 id$/);
  if (miss) {
    const label = KEY_LABEL[miss[1]] ?? miss[1];
    return `「${label}」第 ${Number(miss[2]) + 1} 条缺少编号`;
  }
  const wb = s.match(/^世界书「(.+)」未挂地点或人物，不能保存$/);
  if (wb) return `世界书「${wb[1]}」还没挂地点或人物`;
  if (/startMoney/.test(s)) return "开局资金须为非负数字（可填 0）";
  const branches = s.match(/^content\.gameRules\[(\d+)\]\.branches/);
  if (branches) return `「玩法规则」第 ${Number(branches[1]) + 1} 条的分支格式不对`;
  if (/content\.opening 须为对象|opening 须为对象/.test(s)) return "开场剧情须为对象（含段落文案）";
  return s.replace(/^content\./, "");
}

/** 功能注释：错误文案 → 页签 / 区块定位 */
export function resolveSaveErrorJump(raw: string): SaveErrorJump | null {
  const s = String(raw || "");
  if (s.includes("世界书")) return { group: "story", target: "world-book" };
  if (/gameRules|玩法规则/.test(s)) return { group: "grow", target: "grow-modules" };
  if (/opening|开场剧情/.test(s)) return { group: "look", target: "author-field-opening" };
  const miss = s.match(/^content\.(\w+)\[/);
  if (miss && KEY_JUMP[miss[1]]) return KEY_JUMP[miss[1]];
  if (/人物|性别|年龄|npc/i.test(s)) return { group: "role", target: "npcs" };
  if (/startMoney|开局资金|moneyLabel/.test(s)) return { group: "base", target: "author-field-start-money" };
  if (/开局日期|名称|版本|基调|地点/.test(s)) return { group: "base" };
  return null;
}
