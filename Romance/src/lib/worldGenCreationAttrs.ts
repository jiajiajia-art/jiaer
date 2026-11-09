/**
 * 生成世界 · 建角数值属性 / 开局资金货币名清洗。
 * AI 默认正好 3 条有名称的属性（带属性说明）；禁止留下「未命名」或空壳字段。
 */
import type { AttrDef } from "./types.ts";
import { asTrimmedString } from "./asTrimmedString.ts";

/** 功能注释：建角属性建议条数中位（仅提示）；建议范围约 2–4，不补空壳凑数 */
export const WORLD_GEN_CUSTOM_ATTRS_COUNT = 3;
export const WORLD_GEN_CUSTOM_ATTRS_SUGGEST_MIN = 2;
export const WORLD_GEN_CUSTOM_ATTRS_SUGGEST_MAX = 4;

type DraftBits = { title?: string; setting?: string };

/** 功能注释：无名称 /「未命名」空壳一律丢弃，避免建角列表出现占位行 */
function isUsableAttrLabel(label: string): boolean {
  if (!label) return false;
  if (label === "未命名" || label === "未命名属性") return false;
  if (/^未命名\d*$/u.test(label)) return false;
  return true;
}

/** 功能注释：无说明时按属性名写一句可改的属性说明，避免卡片里出现无标题空文案 */
export function defaultAttrDescForLabel(label: string): string {
  const name = asTrimmedString(label) || "该属性";
  return `代表「${name}」的强弱；剧情中按表现与选择增减。`;
}

/**
 * 功能注释：按题材给缺省属性名（AI 漏写或全是空壳时补齐正好 3 条有名属性，不写「未命名」）。
 */
export function defaultWorldGenAttrSeeds(draft?: DraftBits | null): { label: string; desc: string }[] {
  const blob = [draft?.title, draft?.setting].map((x) => String(x ?? "")).join("\n");
  if (/灵石|修真|仙侠|宗门|灵根/.test(blob)) {
    return [
      { label: "灵力", desc: defaultAttrDescForLabel("灵力") },
      { label: "悟性", desc: defaultAttrDescForLabel("悟性") },
      { label: "根骨", desc: defaultAttrDescForLabel("根骨") },
    ];
  }
  if (/旅馆|客栈|住客|悬疑|推理|线索/.test(blob)) {
    return [
      { label: "洞察", desc: "对细微线索、氛围变化与住客情绪的觉察力。" },
      { label: "胆识", desc: defaultAttrDescForLabel("胆识") },
      { label: "交际", desc: defaultAttrDescForLabel("交际") },
    ];
  }
  if (/校园|大学|同学|社团/.test(blob)) {
    return [
      { label: "学力", desc: defaultAttrDescForLabel("学力") },
      { label: "人缘", desc: defaultAttrDescForLabel("人缘") },
      { label: "体力", desc: defaultAttrDescForLabel("体力") },
    ];
  }
  return [
    { label: "魅力", desc: defaultAttrDescForLabel("魅力") },
    { label: "口才", desc: defaultAttrDescForLabel("口才") },
    { label: "体力", desc: defaultAttrDescForLabel("体力") },
  ];
}

/**
 * 功能注释：清洗 AI 写出的 customAttrs——丢掉无名称/「未命名」，最多保留 3 条，
 * 并补齐属性说明；不自动补空字段凑数（凑数见 ensureWorldGenCustomAttrs）。
 */
export function normalizeWorldGenCustomAttrs(raw: unknown): AttrDef[] {
  if (!Array.isArray(raw)) return [];
  const out: AttrDef[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const r = row as Record<string, unknown>;
    // 功能注释：模型常把名称写在 name 而不是 label，两者都认，避免洗成空壳
    const label = asTrimmedString(r.label) || asTrimmedString(r.name);
    if (!isUsableAttrLabel(label)) continue;
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
    // 功能注释：建议约 2–4；允许多于建议但设软上限，避免灌爆；不补空壳
    if (out.length >= WORLD_GEN_CUSTOM_ATTRS_SUGGEST_MAX + 4) break;
  }
  return out;
}

/**
 * 功能注释：建角批收口——清洗无名称空壳；已有有效属性时不补空壳凑数。
 * 仅当 AI 一条都没写出时，才按题材补建议下限条数，保证建角页可用。
 */
export function ensureWorldGenCustomAttrs(
  patch: Record<string, unknown>,
  draft?: DraftBits | null,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...patch };
  const cleaned = normalizeWorldGenCustomAttrs(out.customAttrs);
  if (cleaned.length) {
    out.customAttrs = cleaned;
    return out;
  }
  const used = new Set<string>();
  const seeds = defaultWorldGenAttrSeeds(draft);
  const filled: AttrDef[] = [];
  let seedIdx = 0;
  while (filled.length < WORLD_GEN_CUSTOM_ATTRS_SUGGEST_MIN && seedIdx < seeds.length + WORLD_GEN_CUSTOM_ATTRS_SUGGEST_MIN) {
    const seed = seeds[seedIdx % seeds.length];
    seedIdx += 1;
    let label = seed.label;
    if (used.has(label)) label = `${seed.label}${filled.length + 1}`;
    if (used.has(label)) continue;
    used.add(label);
    filled.push({
      id: `attr_${filled.length + 1}`,
      label,
      init: 50,
      min: 0,
      max: 100,
      desc: seed.desc || defaultAttrDescForLabel(label),
    });
  }
  out.customAttrs = filled;
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

/**
 * 功能注释：打开/保存旧稿时去掉「未命名」空壳，避免编辑器仍显示占位行；不自动补新属性。
 */
export function healCustomAttrsUnnamed(content: { customAttrs?: AttrDef[] }): string[] {
  const list = content.customAttrs;
  if (!Array.isArray(list) || !list.length) return [];
  const next = list.filter((a) => a && isUsableAttrLabel(asTrimmedString(a.label)));
  if (next.length === list.length) return [];
  content.customAttrs = next.length ? next : undefined;
  return ["已移除无名称的建角属性"];
}
