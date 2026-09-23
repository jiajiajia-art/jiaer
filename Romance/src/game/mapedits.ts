/* ————— 地图编辑覆写层（引擎中立）—————
 * 玩家在设置·地图编辑器里对各点位写下的覆写（名称/描述/背景图/自定义物件），
 * 存于 GameState.mapEdits。渲染与拾取逻辑一律经由这里读取，缺省字段回落到世界内容池。
 * 这层与题材解耦：任何世界都可用同一套覆写机制。 */
import type { CustomSpotItem, GameState, MapEdits, MapSpotEdit, SpotEvent } from "../lib/types";

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

/* 跨所有点位按 id 查一个剧情事件 */
export const findSpotEvent = (
  g: Pick<GameState, "mapEdits">,
  id: string,
): { roomId: string; event: SpotEvent } | undefined => {
  for (const [roomId, edit] of Object.entries(mapEditsOf(g))) {
    const hit = (edit.events ?? []).find((e) => e.id === id);
    if (hit) return { roomId, event: hit };
  }
  return undefined;
};

/* 跨所有点位按 id 查一件自定义物件（拾取入行囊后，背包据此还原展示） */
export const findCustomItem = (g: Pick<GameState, "mapEdits">, id: string): CustomSpotItem | undefined => {
  for (const edit of Object.values(mapEditsOf(g))) {
    const hit = (edit.items ?? []).find((it) => it.id === id);
    if (hit) return hit;
  }
  return undefined;
};
