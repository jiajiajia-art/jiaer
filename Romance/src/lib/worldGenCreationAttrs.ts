/**
 * 生成世界 · 建角数值属性 / 开局资金货币名清洗。
 * AI 默认正好 3 条有名称的属性（带属性说明）；禁止留下「未命名」或空壳字段。
 */
import type { AttrDef } from "./types.ts";
import { asTrimmedString } from "./asTrimmedString.ts";

/** 功能注释：AI 生成建角数值属性的默认条数；创作者可在编辑器增删 */
export const WORLD_GEN_CUSTOM_ATTRS_COUNT = 3;

type DraftBits = { title?: string; setting?: string };

/** 功能注释：无说明时按属性名写一句可改的属性说明，避免卡片里出现无标题空文案 */
export function defaultAttrDescForLabel(label: string): string {
  const name = asTrimmedString(label) || "该属性";
  return `代表「${name}」的强弱；剧情中按表现与选择增减。`;
}

/**
 * 功能注释：清洗 AI 写出的 customAttrs——丢掉无名称/「未命名」，最多保留 3 条，
 * 并补齐属性说明；不自动补空字段凑数。
 */
export function normalizeWorldGenCustomAttrs(raw: unknown): AttrDef[] {
  if (!Array.isArray(raw)) return [];
  const out: AttrDef[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const r = row as Record<string, unknown>;
    const label = asTrimmedString(r.label);
    if (!label || label === "未命名" || label === "未命名属性") continue;
    let id = asTrimmedString(r.id) || `attr_${out.length + 1}`;
    if (seen.has(id)) id = `${id}_${out.length + 1}`;
    seen.add(id);
    const minRaw = Number(r.min);
    const maxRaw = Number(r.max);
    const initRaw = Number(r.init);
    const min = Number.isFinite(minRaw) ? Math.max(0, Math.floor(minRaw)) : 0;
    const max =
      r.max === undefined || r.max === null || r.max === ""
        ? 100
        : Number.isFinite(maxRaw)
          ? Math.max(min + 1, Math.floor(maxRaw))
          : 100;
    const init = Number.isFinite(initRaw) ? Math.max(min, Math.min(max, Math.floor(initRaw))) : min;
    const desc = asTrimmedString(r.desc) || defaultAttrDescForLabel(label);
    const initModeRaw = asTrimmedString(r.initMode);
    const initMode =
      initModeRaw === "random" || initModeRaw === "dice"
        ? ("random" as const)
        : undefined;
    const def: AttrDef = {
      id,
      label,
      init,
      min,
      max,
      desc,
      ...(initMode ? { initMode } : {}),
    };
    if (typeof r.icon === "string" && r.icon.trim()) def.icon = r.icon.trim().slice(0, 2);
    if (Array.isArray(r.tiers)) {
      const tiers = r.tiers
        .map((t) => {
          if (!t || typeof t !== "object" || Array.isArray(t)) return null;
          const tr = t as { min?: unknown; label?: unknown };
          const tLabel = asTrimmedString(tr.label);
          const tMin = Number(tr.min);
          if (!tLabel || !Number.isFinite(tMin)) return null;
          return { min: Math.floor(tMin), label: tLabel };
        })
        .filter(Boolean) as { min: number; label: string }[];
      if (tiers.length) def.tiers = tiers;
    }
    out.push(def);
    if (out.length >= WORLD_GEN_CUSTOM_ATTRS_COUNT) break;
  }
  return out;
}

/** 功能注释：按题材猜货币名；AI 漏写 moneyLabel 时写入，避免开局资金行只显示「货币」 */
export function inferWorldGenMoneyLabel(draft?: DraftBits | null): string {
  const blob = [draft?.title, draft?.setting].map((x) => String(x ?? "")).join("\n");
  if (/灵石|修真|仙侠|宗门/.test(blob)) return "灵石";
  if (/星币|星际|飞船/.test(blob)) return "星币";
  if (/金币|冒险|地下城|勇者/.test(blob)) return "金币";
  if (/两|银两|铜钱|衙门|客栈/.test(blob)) return "两";
  return "元";
}

/**
 * 功能注释：建角/开局资金批必须带非负 startMoney 与货币名称；漏写则补默认，不留下空货币名。
 */
export function ensureWorldGenStartMoney(
  patch: Record<string, unknown>,
  draft?: DraftBits | null,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...patch };
  const money = Number(out.startMoney);
  if (!Number.isFinite(money) || money < 0) out.startMoney = 0;
  else out.startMoney = Math.floor(money);
  const label = asTrimmedString(out.moneyLabel);
  out.moneyLabel = label || inferWorldGenMoneyLabel(draft);
  return out;
}
