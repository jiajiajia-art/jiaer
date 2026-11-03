/**
 * 功能注释：建角「属性 / 字段 / 开局资金」对创作者是同一类「建角字段」。
 * 编辑器统一列表的类型与货币模板；底层仍分别写入 customAttrs / creation.fields / startMoney。
 */
import type { AttrDef } from "./types.ts";
import { looksLikeCurrency } from "../game/wallet.ts";

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

/** 功能注释：建角页预览用——隐藏项不出现在「属性」卡，仍参与开局写入 */
export function visibleCreatorAttrs(defs: AttrDef[] | undefined): AttrDef[] {
  return (defs ?? []).filter((a) => !a.hidden);
}
