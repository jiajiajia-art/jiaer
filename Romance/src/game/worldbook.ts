/* ═══════════════════════════════════════════════════════════════
 *  世界书 · 引擎接口（题材无关层）
 *  引擎只负责「取当前世界的种子世界书」，不认识任何具体题材内容。
 *
 *  【模板化路线】阶段 0：单一世界，直接绑定 star2005 的种子。
 *  将来接入世界注册表后，此处改为按 worldId 查表；未登记 / 纯沙盒世界
 *  回退空数组，玩家可完全靠世界书编辑器自建题材。 */
import type { WorldBookEntry } from "../lib/types";
import { WORLD_BOOK_SEED } from "../worlds/star2005/worldbook";
import { getWorldBookSeed } from "../mods/registry";

/* 取当前世界的种子世界书（副本，避免调用方误改模块级常量）。
 * worldId 目前恒为 star2005；未知世界返回空数组（纯沙盒）。 */
export function seedWorldBook(worldId = "star2005"): WorldBookEntry[] {
  const seed = worldId === "star2005" ? WORLD_BOOK_SEED : [];
  return seed.map((e) => ({ ...e, keywords: [...e.keywords] }));
}

/* 兼容旧调用点的别名：未初始化存档展示 / 注入时的默认世界书。 */
/* 模组化后：默认世界书 = 当前生效世界观（含叠加包）合并后的种子 */
export const defaultWorldBook = (): WorldBookEntry[] => getWorldBookSeed();
