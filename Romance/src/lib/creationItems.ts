/**
 * 功能注释：建角「属性 / 字段 / 开局资金」对创作者是同一类「建角字段」。
 * 编辑器统一列表的类型与货币模板；底层仍分别写入 customAttrs / creation.fields / startMoney。
 */
import type { AttrDef } from "./types.ts";
import { looksLikeCurrency } from "../game/wallet.ts";
import { asTrimmedString } from "./asTrimmedString.ts";
import { asModArray } from "./asModArray.ts";
import { attrStartValue, attrUsesRandomStart } from "./attrInit.ts";

/** 功能注释：统一「＋ 添加」可选类型（不含长文本/下拉旧项，旧稿仍可编辑） */
export const CREATION_ITEM_ADD_TYPES = [
  { id: "text", label: "文本" },
  { id: "radio", label: "单选" },
  { id: "number", label: "数值" },
  { id: "date", label: "日期" },
  { id: "currency", label: "货币" },
] as const;

export type CreationItemAddType = (typeof CREATION_ITEM_ADD_TYPES)[number]["id"];

/** 功能注释：添加货币时写入说明，便于钱包识别与 AI 记账 */
export const CURRENCY_ATTR_DESC =
  "这是货币。主角购买、消费、打赏、发红包时减少；赚钱、收红包、收转账时增加。";

/** 功能注释：列表角标——货币优先于数值 */
export function creationAttrKindLabel(a: Pick<AttrDef, "label" | "desc">): "货币" | "数值" {
  return looksLikeCurrency(a as AttrDef) ? "货币" : "数值";
}

/** 功能注释：新建数值项默认值（范围 0~100、开局 0） */
export function newNumberAttr(id: string): AttrDef {
  return { id, label: "新数值", init: 0, max: 100 };
}

/** 功能注释：新建货币项默认值（无上限、开局 100、货币说明） */
export function newCurrencyAttr(id: string): AttrDef {
  return { id, label: "金币", init: 100, desc: CURRENCY_ATTR_DESC };
}

/** 功能注释：无名称 /「未命名」空壳不进建角预览，避免卡片上出现 undefined */
function isNamedCreatorAttr(a: AttrDef): boolean {
  const label = asTrimmedString(a.label);
  return !!label && label !== "未命名" && label !== "未命名属性";
}

/** 功能注释：建角页预览用——隐藏项与空壳名不出现在「属性」卡；有名称的仍参与开局写入 */
export function visibleCreatorAttrs(defs: AttrDef[] | undefined | unknown): AttrDef[] {
  // 功能注释：customAttrs 被 AI 写成对象时按空列表，禁止 .filter 崩预览
  return asModArray<AttrDef>(defs).filter((a) => !a.hidden && isNamedCreatorAttr(a));
}

/** 功能注释：建角页掷一次各属性开局值，供预览与「属性」标题骰子整组重掷 */
export function rollCreatorAttrStarts(
  defs: AttrDef[] | undefined | unknown,
  rand: () => number = Math.random,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const a of asModArray<AttrDef>(defs)) {
    if (!a?.id) continue;
    out[a.id] = attrStartValue(a, rand);
  }
  return out;
}

/** 功能注释：属性预览右侧文案；有已掷值时显示具体数字，随机项标明「已掷」 */
export function formatCreatorAttrPreview(a: AttrDef, rolled?: number): string {
  const max = Number(a.max);
  const maxPart = Number.isFinite(max) && max > 0 ? ` · 上限 ${Math.floor(max)}` : "";
  if (typeof rolled === "number" && Number.isFinite(rolled)) {
    const n = Math.floor(rolled);
    if (attrUsesRandomStart(a)) return `开局 ${n}${maxPart}（已掷）`;
    return `开局 ${n}${maxPart}`;
  }
  if (attrUsesRandomStart(a)) {
    const lo = Number.isFinite(Number(a.min)) ? Math.floor(Number(a.min)) : 0;
    const hi = Number.isFinite(max) && max > lo ? Math.floor(max) : Math.max(lo, 100);
    return `开局随机 ${lo}~${hi}`;
  }
  const initRaw = Number(a.init);
  const init = Number.isFinite(initRaw)
    ? Math.floor(initRaw)
    : Number.isFinite(Number(a.min))
      ? Math.floor(Number(a.min))
      : 0;
  return `开局 ${init}${maxPart}`;
}
