/* 人物线路 · 开局数值：作者自填的动态 JSON（属性 / 好感 / 声望词条全是自由命名，与题材解耦）。
 * 开局时按名称匹配本世界的八维、内置指标、自定义属性与人物；匹配不上的属性 / 词条自动新建为本局自定义属性。 */
export type RouteNum = { name: string; val: number };
export type RouteFavor = { target: string; val: number };
/* mode：list = 按数值自动罗列（名称 +N、…）；free = 作者自由描述（text 原样显示，不拼接符号）。
 * favorWord：好感项在罗列里的后缀（如「好感」「情谊」「信任」；留空则只写目标名） */
export type RouteFx = { attr?: RouteNum[]; favor?: RouteFavor[]; reputation?: RouteNum[]; note?: string; mode?: "list" | "free"; text?: string; favorWord?: string };

/* 线路里写了、但本世界没有的属性 / 词条：开局自动新建的自定义属性 id（按名称稳定生成，结局条件可提前引用） */
export const routeAttrId = (name: string) => `route_${Math.abs([...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)).toString(36)}`;

const int = (v: unknown) => (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : 0);
const signed = (v: number) => (v > 0 ? `+${v}` : `${v}`);

/* 读入任意来源（编辑器 / AI / 导入模组）的 JSON：去掉空名、取整、丢掉 0 值以外的脏数据 */
export function normRouteFx(raw: unknown): RouteFx | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const rows = (a: unknown, k: "name" | "target") =>
    (Array.isArray(a) ? a : [])
      .map((x) => ({ [k]: String((x as Record<string, unknown>)?.[k] ?? "").trim(), val: int((x as Record<string, unknown>)?.val) }))
      .filter((x) => x[k]);
  const out: RouteFx = {
    attr: rows(r.attr, "name") as RouteNum[],
    favor: rows(r.favor, "target") as RouteFavor[],
    reputation: rows(r.reputation, "name") as RouteNum[],
    note: typeof r.note === "string" && r.note.trim() ? r.note.trim() : undefined,
    ...(r.mode === "free" ? { mode: "free" as const } : {}),
    ...(typeof r.text === "string" && r.text.trim() ? { text: r.text.trim() } : {}),
    ...(typeof r.favorWord === "string" ? { favorWord: r.favorWord.trim() } : {}),
  };
  return out.attr!.length || out.favor!.length || out.reputation!.length || out.note || out.text ? out : undefined;
}

/* 预览 / 卡片文案（无任何固定前缀，编辑器与建角页共用）：
 * list：「灵力 +20、悟性 +60、师尊好感 +15；宗门声望 -5（备注）」——正值在前，负值以「；」另起
 * free：作者自写描述原样输出，后接（备注） */
export function routeFxText(fx: RouteFx | undefined, relationOf: (target: string) => string = () => ""): string {
  if (!fx) return "";
  const note = fx.note ? `（${fx.note}）` : "";
  if (fx.mode === "free") return `${fx.text ?? ""}${note}`;
  const word = fx.favorWord ?? "好感";
  const items = [
    ...(fx.attr ?? []).map((x) => ({ label: x.name, val: x.val })),
    ...(fx.reputation ?? []).map((x) => ({ label: x.name, val: x.val })),
    ...(fx.favor ?? []).map((x) => ({ label: `${relationOf(x.target)}${x.target}${word}`, val: x.val })),
  ].filter((x) => x.label && x.val);
  const up = items.filter((x) => x.val > 0).map((x) => `${x.label} ${signed(x.val)}`).join("、");
  const down = items.filter((x) => x.val < 0).map((x) => `${x.label} ${signed(x.val)}`).join("、");
  const body = [up, down].filter(Boolean).join("；");
  return body ? `${body}${note}` : fx.note ?? "";
}

/* 旧存档 / 旧模组里存下的文案可能带早期的固定前缀，读出时去掉（只做兼容，不再生成） */
export const cleanPerks = (t?: string) => (t ?? "").replace(/^\s*数值倾向[：:　\s]*/, "").replace(/。$/, "").trim();
