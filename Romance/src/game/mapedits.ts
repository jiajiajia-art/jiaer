/* ————— 地图编辑覆写层（引擎中立）—————
 * 玩家在设置·地图编辑器里对各点位写下的覆写（名称/描述/背景图/自定义物件），
 * 存于 GameState.mapEdits。渲染与拾取逻辑一律经由这里读取，缺省字段回落到世界内容池。
 * 这层与题材解耦：任何世界都可用同一套覆写机制。 */
import type { CustomSpotAct, CustomSpotItem, GameState, MapEdits, MapSpotEdit, ShopGood, SpotEvent } from "../lib/types";

export const mapEditsOf = (g: Pick<GameState, "mapEdits">): MapEdits => g.mapEdits ?? {};

const spotOf = (g: Pick<GameState, "mapEdits">, roomId: string): MapSpotEdit | undefined =>
  mapEditsOf(g)[roomId];

/* 覆写后的点位名 / 描述 / 背景图；无覆写则返回 undefined，交由调用方回落默认 */
export const spotName = (g: Pick<GameState, "mapEdits">, roomId: string): string | undefined => {
  const v = spotOf(g, roomId)?.name?.trim();
  return v ? v : undefined;
};
export const spotDesc = (g: Pick<GameState, "mapEdits">, roomId: string): string | undefined => {
  const v = spotOf(g, roomId)?.desc?.trim();
  return v ? v : undefined;
};
export const spotBackground = (g: Pick<GameState, "mapEdits">, roomId: string): string | undefined => {
  const v = spotOf(g, roomId)?.background?.trim();
  return v ? v : undefined;
};

/* 某点位的玩家自定义物件（已过滤空条目） */
export const customItemsOf = (g: Pick<GameState, "mapEdits">, roomId: string): CustomSpotItem[] =>
  (spotOf(g, roomId)?.items ?? []).filter((it) => it.name.trim());

/* 商店商品 → 0 行动点的地点行动（售价并入资金扣除），与自定义行动共用门槛 / 限次 / 结算 */
export const goodAsAct = (it: ShopGood): CustomSpotAct => ({
  id: it.id,
  label: `购买「${it.name}」`,
  hint: it.desc,
  cost: 0,
  prompt: `主角在店里买下了「${it.name}」${it.desc ? `（${it.desc}）` : ""}，售价 ${it.price}。`,
  effects: { ...(it.effects ?? {}), money: (it.effects?.money ?? 0) - Math.max(0, it.price) },
  require: it.require,
  perWeek: it.perWeek,
});

/* 某点位的玩家自定义行动 + 商店商品（已过滤空条目） */
export const customActsOf = (g: Pick<GameState, "mapEdits">, roomId: string): CustomSpotAct[] => [
  ...(spotOf(g, roomId)?.acts ?? []).filter((a) => typeof a.label === "string" && !!a.label.trim()),
  ...(spotOf(g, roomId)?.shop ?? []).filter((it) => typeof it.name === "string" && !!it.name.trim()).map(goodAsAct),
];

/* 跨所有点位按 id 查一个玩家自定义行动 */
export const findCustomAct = (
  g: Pick<GameState, "mapEdits">,
  id: string,
): { roomId: string; act: CustomSpotAct } | undefined => {
  for (const [roomId, edit] of Object.entries(mapEditsOf(g)) as [string, MapSpotEdit][]) {
    if (roomId === "_config") continue;
    const hit = (edit.acts ?? []).find((a: CustomSpotAct) => a.id === id);
    if (hit) return { roomId, act: hit };
  }
  return undefined;
};

/* 某点位的玩家自定义剧情事件（已过滤空条目）；
 * fired 为已触发过的事件 id 集合，一次性事件触发后即从可选列表隐去。 */
export const spotEventsOf = (
  g: Pick<GameState, "mapEdits">,
  roomId: string,
  fired?: readonly string[],
): SpotEvent[] =>
  (spotOf(g, roomId)?.events ?? [])
    .filter((e) => e.title.trim() && e.seed.trim())
    .filter((e) => !(e.once && fired?.includes(e.id)));

/* 已触发的点位事件 / 支线：持久记录在 sim.eventsFired（带前缀），不依赖剧情志（删剧情志不会让事件复活） */
export const firedKey = (kind: "spot" | "quest", id: string) => `${kind}:${id}`;
export const firedOf = (g: Pick<GameState, "sim">, kind: "spot" | "quest"): string[] =>
  (g.sim.eventsFired ?? []).filter((x) => x.startsWith(`${kind}:`)).map((x) => x.slice(kind.length + 1));

/* 跨所有点位按 id 查一个剧情事件 */
export const findSpotEvent = (
  g: Pick<GameState, "mapEdits">,
  id: string,
): { roomId: string; event: SpotEvent } | undefined => {
  for (const [roomId, edit] of Object.entries(mapEditsOf(g)) as [string, MapSpotEdit][]) {
    if (roomId === "_config") continue;
    const hit = (edit.events ?? []).find((e: SpotEvent) => e.id === id);
    if (hit) return { roomId, event: hit };
  }
  return undefined;
};

/* 跨所有点位按 id 查一件自定义物件（拾取入行囊后，背包据此还原展示） */
export const findCustomItem = (g: Pick<GameState, "mapEdits">, id: string): CustomSpotItem | undefined => {
  for (const [roomId, edit] of Object.entries(mapEditsOf(g)) as [string, MapSpotEdit][]) {
    if (roomId === "_config") continue;
    const hit = (edit.items ?? []).find((it: CustomSpotItem) => it.id === id);
    if (hit) return hit;
    const good = (edit.shop ?? []).find((it: ShopGood) => it.id === id);
    // 购买回复设定只用于购买那一刻；在行囊里使用时不带店员剧情
    if (good) return { id: good.id, name: good.name, desc: good.desc ?? `在店里买下的${good.name}`, icon: "◆" };
  }
  return undefined;
};

/* 按 id 找商店商品（跨所有点位） */
export const findShopGood = (g: Pick<GameState, "mapEdits">, id: string): ShopGood | undefined => {
  for (const [roomId, edit] of Object.entries(mapEditsOf(g)) as [string, MapSpotEdit][]) {
    if (roomId === "_config") continue;
    const hit = (edit.shop ?? []).find((it: ShopGood) => it.id === id);
    if (hit) return hit;
  }
  return undefined;
};

/* 地点活动的行动点消耗：创作台可逐项设定，缺省 1 点 */
export const DEFAULT_ACT_AP = 1;
export const activityApCost = (g: Pick<GameState, "mapEdits">, roomId: string, actId: string): number => {
  const spot = spotOf(g, roomId);
  const v = spot?.actCost?.[actId];
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.round(v));
  const customAct = customActsOf(g, roomId).find((a) => a.id === actId);
  if (customAct && typeof customAct.cost === "number" && Number.isFinite(customAct.cost)) {
    return Math.max(0, Math.round(customAct.cost));
  }
  return DEFAULT_ACT_AP;
};
/* 结果文案改写：去掉内容池里写死的「行动力 -N」，按实际消耗补上「行动点 -N」 */
export const withApNote = (msg: string, cost: number): string => {
  let m = msg.replace(/[、，,]\s*行动力\s*[-−]\d+/g, "").replace(/行动力\s*[-−]\d+\s*[、，,]?\s*/g, "").replace(/（\s*）/g, "");
  if (cost <= 0) return m;
  const note = `行动点 -${cost}`;
  return /）\s*[。！]?\s*$/.test(m) ? m.replace(/）(\s*[。！]?\s*)$/, `、${note}）$1`) : `${m}（${note}）`;
};
