/* 玩家应用 · 游戏世界数据源
 * 积木写了 source 就不再用 AI 写死的 items，而是每次打开 / 刷新时从当前存档实时读取；
 * source = "ai" 时按当前世界设定与局势现写内容（缓存在本存档，刷新重写）。 */
import type { GameState } from "../../../lib/types";
import type { Block } from "./core";

export type LiveSource = "status" | "attrs" | "people" | "story" | "worldbook" | "ai";
export const LIVE_SOURCES: { id: LiveSource; label: string; desc: string }[] = [
  { id: "status", label: "当前状态", desc: "时间、地点、天气、资金" },
  { id: "attrs", label: "主角属性", desc: "主角的各项属性数值" },
  { id: "people", label: "人物关系", desc: "已登场人物与关系、好感" },
  { id: "story", label: "最近剧情", desc: "主线最近几段剧情" },
  { id: "worldbook", label: "世界书", desc: "已启用的世界设定条目" },
  { id: "ai", label: "AI 按世界现写", desc: "按 prompt 结合当前世界生成，刷新重写" },
];
export const isLive = (s?: string): s is LiveSource => LIVE_SOURCES.some((x) => x.id === s);

const firstLine = (t: string, n = 60) => { const s = t.replace(/\s+/g, " ").trim(); return s.length > n ? `${s.slice(0, n)}…` : s; };

/** 直接读存档的数据源；stat 积木返回「标签:数值」 */
export function liveItems(g: GameState | null | undefined, src: LiveSource, kind: Block["type"]): string[] {
  if (!g) return [];
  const stat = kind === "stat";
  switch (src) {
    case "status": {
      const money = (g.sim as { money?: number } | undefined)?.money;
      const rows: [string, string][] = [["时间", g.world.time], ["地点", g.world.location], ["天气", g.world.weather]];
      if (typeof money === "number") rows.push(["资金", money.toLocaleString("zh-CN")]);
      return rows.filter(([, v]) => v).map(([l, v]) => (stat ? `${l}:${v}` : `${l} · ${v}`));
    }
    case "attrs":
      return (g.player.attrs ?? []).map((a) => (stat ? `${a.label}:${a.value}` : `${a.label} ${a.value}/${a.max}`));
    case "people":
      return g.npcs.map((n) => (stat ? `${n.name}:${n.affinity}` : `${n.name}${n.relation ? ` · ${n.relation}` : ""}${n.identity ? ` · ${n.identity}` : ""} · 好感 ${n.affinity}`));
    case "story":
      return g.story.filter((t) => t.role === "ai" && !t.error).slice(-5).reverse()
        .map((t) => firstLine(t.segments.filter((s) => s.kind !== "system").map((s) => s.text).join(" ")))
        .filter(Boolean);
    case "worldbook":
      return (g.worldBook ?? []).filter((w) => w.enabled).map((w) => (stat ? `${w.title}:${w.keywords.length}` : `${w.title}：${firstLine(w.content, 40)}`));
    default:
      return [];
  }
}

/** 给 AI 的世界摘要：只放事实，不放提示词 */
export function worldContext(g: GameState | null | undefined): string {
  if (!g) return "（当前没有进行中的游戏）";
  const wb = (g.worldBook ?? []).filter((w) => w.enabled).slice(0, 8).map((w) => `- ${w.title}：${firstLine(w.content, 120)}`).join("\n");
  return [
    `主角：${g.player.name}（${[g.player.gender, g.player.age, g.player.identity].filter(Boolean).join("，")}）`,
    `此刻：${g.world.time} · ${g.world.location} · ${g.world.weather}`,
    `属性：${liveItems(g, "attrs", "list").join("；") || "无"}`,
    `人物：${g.npcs.slice(0, 12).map((n) => `${n.name}(${n.relation || n.identity})`).join("、") || "无"}`,
    g.memory ? `剧情记忆：${firstLine(g.memory, 400)}` : "",
    `最近剧情：${liveItems(g, "story", "list").slice(0, 3).join(" / ") || "无"}`,
    wb ? `世界设定：\n${wb}` : "",
  ].filter(Boolean).join("\n");
}
