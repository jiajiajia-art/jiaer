/**
 * 属性 SDK：以作者自定义属性（customAttrs）为核心的统一引用规范。
 *
 * 作品不预设任何能力维度：属性条数、名称、范围全部由作者定义。
 * 所有玩法字段只通过下面几种写法引用属性，引擎、编辑器、AI 提示词与校验共用这一份约定：
 *   - 条件 / 数值键：  "c:<属性id>"          （fixedEvents.conds、reqs.metric、titles.req、income.target、gameRules）
 *   - 收益表：        cgain: { <属性id>: [min, max] }（trainings / sideJobs / weekendActs）
 *   - 伴侣加成 fx：   "attr:<属性id>"
 * 内置通用指标（不属于任何题材）：money / stress / energy / fame / reputation / works / week，
 * 其中 fame / reputation / money 的叫法可用 terms 改名。
 * 旧版八维键（yanji、"stat:yanji"、gain:{yanji}）仅为兼容保留，新内容禁止使用。
 */

export type AttrTier = { min: number; label: string };
export type AttrSpec = {
  id: string;
  label: string;
  desc?: string;
  min: number;
  max: number;
  init: number;
  initMode?: "fixed" | "random";
  color?: string;
  tiers?: AttrTier[];
  display?: "num" | "tier" | "both";
  pin?: boolean;
};

export const ATTR_ID_RE = /^[a-z][a-z0-9_]{0,31}$/;
export const BUILTIN_METRICS = ["money", "stress", "energy", "fame", "reputation", "works", "week"] as const;
export const LEGACY_STAT_KEYS = ["yanji", "geyi", "koucai", "yitai", "donggan", "tineng", "caizhi", "zixin"] as const;

export type BuiltinMetric = (typeof BUILTIN_METRICS)[number];
export type AttrRef =
  | { kind: "attr"; id: string }
  | { kind: "builtin"; key: BuiltinMetric }
  | { kind: "legacyStat"; key: string }
  | { kind: "unknown"; raw: string };

/** 构造条件 / 数值键 */
export const attrMetric = (id: string) => `c:${id}`;
/** 构造伴侣加成 fx 键 */
export const attrFx = (id: string) => `attr:${id}`;

/** 解析任意属性引用字符串 */
export function parseAttrRef(raw: string): AttrRef {
  const s = String(raw ?? "").trim();
  if (s.startsWith("c:")) return { kind: "attr", id: s.slice(2) };
  if (s.startsWith("attr:")) return { kind: "attr", id: s.slice(5) };
  if (s.startsWith("stat:")) return { kind: "legacyStat", key: s.slice(5) };
  if (s.startsWith("stats.")) return { kind: "legacyStat", key: s.slice(6) };
  if ((BUILTIN_METRICS as readonly string[]).includes(s)) return { kind: "builtin", key: s as BuiltinMetric };
  if ((LEGACY_STAT_KEYS as readonly string[]).includes(s)) return { kind: "legacyStat", key: s };
  return { kind: "unknown", raw: s };
}

/** 规范化一条属性定义；不可用时返回 null */
export function normalizeAttrSpec(raw: unknown): AttrSpec | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id.trim() : "";
  const label = typeof r.label === "string" ? r.label.trim() : typeof r.name === "string" ? r.name.trim() : "";
  if (!id || !label) return null;
  const num = (v: unknown, fb: number) => (typeof v === "number" && Number.isFinite(v) ? v : fb);
  const min = num(r.min, 0);
  const max = Math.max(min, num(r.max, 100));
  const init = Math.min(max, Math.max(min, num(r.init, min)));
  const tiers = Array.isArray(r.tiers)
    ? (r.tiers as unknown[])
        .filter((t): t is AttrTier => !!t && typeof t === "object" && typeof (t as AttrTier).label === "string" && typeof (t as AttrTier).min === "number")
        .sort((a, b) => a.min - b.min)
    : undefined;
  return {
    ...(r as object),
    id, label, min, max, init,
    ...(typeof r.desc === "string" && r.desc.trim() ? { desc: r.desc.trim() } : {}),
    ...(tiers?.length ? { tiers } : {}),
  } as AttrSpec;
}

/** 校验属性表本身：id 格式、重名、缺说明、范围 */
export function validateAttrSpecs(list: unknown): string[] {
  const errs: string[] = [];
  if (list === undefined) return errs;
  if (!Array.isArray(list)) return ["customAttrs 须为数组"];
  const seen = new Set<string>();
  list.forEach((raw, i) => {
    const a = normalizeAttrSpec(raw);
    if (!a) { errs.push(`customAttrs[${i}] 缺少 id 或 label`); return; }
    if (!ATTR_ID_RE.test(a.id)) errs.push(`属性「${a.label}」的 id「${a.id}」须为小写英文开头的字母 / 数字 / 下划线`);
    if (seen.has(a.id)) errs.push(`属性 id「${a.id}」重复`);
    seen.add(a.id);
    if (!a.desc) errs.push(`属性「${a.label}」缺少说明 desc`);
    const r = raw as { min?: unknown; max?: unknown };
    if (typeof r.min === "number" && typeof r.max === "number" && r.max <= r.min) errs.push(`属性「${a.label}」的 max 须大于 min`);
  });
  return errs;
}

/** 汇总可用属性（世界观 + 玩法叠加包，后者同 id 覆盖） */
export function collectAttrSpecs(...sources: unknown[]): AttrSpec[] {
  const byId = new Map<string, AttrSpec>();
  for (const src of sources) if (Array.isArray(src)) for (const raw of src) { const a = normalizeAttrSpec(raw); if (a) byId.set(a.id, a); }
  return [...byId.values()];
}

export type AttrRefHit = { path: string; ref: AttrRef };

const REF_KEYS = new Set(["metric", "key"]);
const GAIN_KEYS = new Set(["gain", "cgain"]);

/** 扫描内容里所有属性引用（条件 / 收益 / 头衔 / fx） */
export function scanAttrRefs(content: unknown): AttrRefHit[] {
  const hits: AttrRefHit[] = [];
  const walk = (v: unknown, path: string) => {
    if (Array.isArray(v)) { v.forEach((x, i) => walk(x, `${path}[${i}]`)); return; }
    if (!v || typeof v !== "object") return;
    const o = v as Record<string, unknown>;
    for (const [k, x] of Object.entries(o)) {
      const p = path ? `${path}.${k}` : k;
      if (typeof x === "string" && REF_KEYS.has(k) && /^(c:|attr:|stat:|stats\.)/.test(x)) hits.push({ path: p, ref: parseAttrRef(x) });
      else if (k === "req" && x && typeof x === "object" && !Array.isArray(x)) {
        for (const rk of Object.keys(x)) hits.push({ path: `${p}.${rk}`, ref: parseAttrRef(rk) });
      } else if (GAIN_KEYS.has(k) && x && typeof x === "object" && !Array.isArray(x)) {
        for (const gk of Object.keys(x)) hits.push({ path: `${p}.${gk}`, ref: k === "cgain" ? { kind: "attr", id: gk } : parseAttrRef(gk) });
      } else walk(x, p);
    }
  };
  walk(content, "");
  return hits;
}

export type AttrAudit = { unknownAttrs: AttrRefHit[]; legacyStats: AttrRefHit[]; specErrors: string[] };

/** 审计：引用了未定义的属性、仍在用旧八维键、属性表本身的问题 */
export function auditAttrRefs(content: Record<string, unknown> | undefined, extraAttrs: unknown[] = []): AttrAudit {
  const known = new Set(collectAttrSpecs(...extraAttrs, content?.customAttrs).map((a) => a.id));
  const hits = scanAttrRefs(content ?? {});
  return {
    unknownAttrs: hits.filter((h) => h.ref.kind === "attr" && !known.has(h.ref.id)),
    legacyStats: hits.filter((h) => h.ref.kind === "legacyStat"),
    specErrors: validateAttrSpecs(content?.customAttrs),
  };
}

export const auditOk = (a: AttrAudit) => !a.unknownAttrs.length && !a.legacyStats.length && !a.specErrors.length;

/** 审计结果的可读文本（给创作者看，也用于回传模型自我修正） */
export function describeAudit(a: AttrAudit, max = 8): string {
  const lines: string[] = [];
  const ids = [...new Set(a.unknownAttrs.map((h) => (h.ref as { id: string }).id))];
  if (ids.length) lines.push(`引用了未定义的属性：${ids.slice(0, max).join("、")}（请先在 customAttrs 里定义，或改用已有属性 id）`);
  const legacy = [...new Set(a.legacyStats.map((h) => (h.ref as { key: string }).key))];
  if (legacy.length) lines.push(`使用了已停用的八维键：${legacy.slice(0, max).join("、")}（请改为 "c:<自定义属性id>" 或 cgain）`);
  lines.push(...a.specErrors.slice(0, max));
  return lines.join("\n");
}

/** 给 AI 的属性规范说明（含当前可用属性表） */
export function attrPromptSpec(attrs: AttrSpec[]): string {
  const table = attrs.length
    ? attrs.map((a) => `  - ${a.id}「${a.label}」${a.min}~${a.max}，初始 ${a.init}${a.desc ? `：${a.desc}` : ""}`).join("\n")
    : "  （暂无，需要时先在 customAttrs 里定义）";
  return `【属性规范 · 以自定义属性为核心】
作品没有预设的能力维度。属性完全由 customAttrs 定义，条数按玩法需要（常见 2~6 条），不必凑数，也不要套用「八维」。
引用写法（只用这三种）：
  - 条件 / 门槛 / 数值目标："c:<属性id>"（fixedEvents.conds 的 {kind:"metric",key}、reqs[].metric、titles.req 的键、income.target.key、gameRules 条件与效果）
  - 收益：cgain:{<属性id>:[min,max]}（trainings / sideJobs / weekendActs）
  - 伴侣加成 fx："attr:<属性id>"
内置通用指标可直接用：${BUILTIN_METRICS.join(" / ")}（fame / reputation / money 可用 terms 改叫法）。
禁止：yanji / geyi 等八维键、"stat:xxx"、gain:{八维键}；禁止引用未定义的属性 id——要用新属性就在同一次补丁里一并写进 customAttrs。
数值平衡以各属性自己的 min~max 为准，分档写在 customAttrs[].tiers。
当前可用属性：
${table}`;
}
