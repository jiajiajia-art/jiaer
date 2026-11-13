import { STAT_LABELS, type StatKey } from "../game/data";
import { FIXED_METRICS, QUEST_STATE_LABEL } from "../game/fixedEvents";
import { SIDE_STATE_LABEL } from "../lib/sidelines";
import { LIVE_LOCATIONS as LOCATIONS, LIVE_PEOPLE as PEOPLE, LIVE_ITEMS as ALL_ITEMS, allMods } from "../mods/registry";
const modName = (id: string) => allMods().find((m) => m.id === id)?.name ?? (id || "未选 MOD");
import { liveFactions } from "../game/factions";
import { TIME_UNIT_LABEL, cmpSym, type CmpOp, type FixedCond, type FixedEffect, type FixedEvent } from "../lib/types";
import { audioLabel } from "../game/audioLib";

/* 条件 / 效果的一句话描述：玩法规则、剧情美化的卡片预览共用 */
const op = (o: CmpOp) => cmpSym(o);
const person = (id: string) => PEOPLE.find((p) => p.id === id)?.name ?? id;
const place = (id: string) => LOCATIONS.find((l) => l.id === id)?.name ?? id;
const item = (id: string) => ALL_ITEMS.find((i) => i.id === id)?.name ?? id;
const faction = (id: string) => liveFactions().find((f) => f.id === id)?.name ?? id;
const metric = (k: string) => FIXED_METRICS.find((m) => m.key === k)?.label ?? k;

export function condBrief(c: FixedCond, events: FixedEvent[] = []): string {
  switch (c.kind) {
    case "stat": return `${STAT_LABELS[c.key as StatKey] ?? c.key}${op(c.op)}${c.value}`;
    case "metric": return `${metric(c.key)}${op(c.op)}${c.value}`;
    case "rel": return `与${person(c.key)}关系${op(c.op)}${c.value}`;
    case "location": return `位于${place(c.key)}`;
    case "item": return `持有「${item(c.key)}」`;
    case "event": return `已触发「${events.find((e) => e.id === c.key)?.name || c.key || "未选"}」`;
    case "time": return `开局${c.op === "lte" ? "不超过" : "满"}${c.value}${TIME_UNIT_LABEL[c.unit]}`;
    case "date": return `${c.op === "lte" ? "不晚于" : "不早于"}${c.date || "（未填）"}`;
    case "flag": return `「${c.key || "未命名"}」${op(c.op)}${c.value}`;
    case "clock": return `${c.from}~${c.to}`;
    case "quest": return `「${c.key || "未选"}」${QUEST_STATE_LABEL[c.state]}`;
    case "side": return `支线「${c.key || "未选"}」${SIDE_STATE_LABEL[c.state]}`;
    case "faction": return `${faction(c.key)}声望${op(c.op)}${c.value}`;
    case "visited": return `去过${place(c.key)}`;
    case "npcFaction": return c.npc ? `${person(c.npc)}属于${faction(c.faction)}` : `当前地点有${faction(c.faction)}的人`;
    case "factionTerritory": return `当前地点属于${faction(c.faction)}的势力范围`;
    case "relSet": return `${(c.keys ?? []).map(person).join("、") || "（未选人物）"}中${c.need ? `至少 ${c.need} 人` : "全部"}好感${op(c.op)}${c.value}`;
    case "memory": return `记得「${c.key || "未命名"}」`;
    case "flagSet": return `标记「${c.key || "未命名"}」${c.exists === false ? "不存在" : "存在"}`;
    case "group": {
      const inner = c.conds.map((x) => condBrief(x, events)).join(c.match === "any" ? " 或 " : " 且 ") || "（空）";
      return `${c.not ? "非" : ""}（${inner}）`;
    }
    case "modVar": return `[${modName(c.mod)}] ${c.key || "未选"}${op(c.op)}${c.value}`;
    case "modCfg": return `[${modName(c.mod)}] 配置 ${c.key || "未选"}${op(c.op)}${c.value}`;
    case "modCond": return `[${modName(c.mod)}] ${allMods().find((m) => m.id === c.mod)?.ext?.conds?.find((x) => x.id === c.id)?.label || c.id || "未选"}`;
  }
}

export function effectBrief(f: FixedEffect): string {
  const d = "delta" in f ? `${f.delta > 0 ? "+" : ""}${f.delta}` : "";
  switch (f.kind) {
    case "stat": return `${STAT_LABELS[f.key as StatKey] ?? f.key}${d}`;
    case "metric": return `${metric(f.key)}${d}`;
    case "rel": return `与${person(f.key)}关系${d}`;
    case "addItem": return `获得「${item(f.key)}」`;
    case "removeItem": return `失去「${item(f.key)}」`;
    case "unlockLocation": return `解锁${place(f.key)}`;
    case "flag": return `「${f.key || "未命名"}」${f.set ? `=${f.delta}` : d}`;
    case "faction": return `${faction(f.key)}声望${d}`;
    case "memory": return `${f.clear ? "忘掉" : "记下"}「${f.key || "未命名"}」`;
    case "modVar": return `[${modName(f.mod)}] ${f.key || "未选"}${f.set ? `=${f.delta}` : d}`;
    case "modAction": return `[${modName(f.mod)}] 执行「${allMods().find((m) => m.id === f.mod)?.ext?.actions?.find((x) => x.id === f.id)?.label || f.id || "未选"}」`;
    case "modCall": return `[${modName(f.mod)}] 调用 mod.${f.mod}.${f.id || "未选"}(${Object.entries(f.args ?? {}).map(([k, v]) => `${k}=${Array.isArray(v) ? v.join("/") : v}`).join(", ")})`;
    case "modEmit": return `广播事件「${f.event || "未选"}」`;
    case "audio": return `${({ play: "播放", stop: "停止", stopAll: "停止全部音频", switchBgm: "切换 BGM 到", volume: "音量调到" } as const)[f.op]}${f.op === "stopAll" ? "" : `「${f.id ? audioLabel(f.id) : f.op === "volume" ? "当前 BGM" : "未选"}」`}${f.op === "volume" ? ` ${Math.round((f.volume ?? 1) * 100)}%` : ""}`;
  }
}

export const condsBrief = (conds: FixedCond[], match: "all" | "any" = "all", events: FixedEvent[] = []) =>
  conds.map((c) => condBrief(c, events)).join(match === "any" ? " 或 " : " 且 ");
