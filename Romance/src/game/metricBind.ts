/**
 * 功能注释：玩法数值绑定（同步桥）。
 * 演艺事业 / 影视项目 / 舆情人设 / 合约议价等引擎直接读写 sim.fame / reputation / blackFans / stats.tineng。
 * 作者在编辑器把这些「引擎角色」绑定到自己的建角属性后，每次状态落盘都双向同步：
 * - 建角属性变了（事件、伙食、地点行动等）→ 写进引擎字段，引擎按作者属性判定；
 * - 引擎字段变了（上映、舆情、通告结算）→ 写回建角属性，并按该属性上下限截断。
 * 未绑定的角色保持内置行为；娱乐圈原版世界不声明绑定，完全不受影响。
 */
import type { AttrDef, GameState } from "../lib/types";
import { getWorldSlot } from "../mods/registry";
import { asModArray } from "../lib/asModArray";
import { METRIC_ROLES, syncBoundMetricsWith, type MetricBindSlot, type MetricRole } from "./metricBindCore";

export { METRIC_ROLES, syncBoundMetricsWith, type MetricBindSlot, type MetricRole } from "./metricBindCore";

export function metricBinds(): { role: MetricRole; def: AttrDef }[] {
  const bind = (getWorldSlot("metricBind") ?? {}) as MetricBindSlot;
  const defs = asModArray<AttrDef>(getWorldSlot("customAttrs"));
  const out: { role: MetricRole; def: AttrDef }[] = [];
  for (const { role } of METRIC_ROLES) {
    const id = String(bind[role] ?? "").trim();
    const def = id ? defs.find((d) => d.id === id) : undefined;
    if (def) out.push({ role, def });
  }
  return out;
}

/** 功能注释：落盘前调用；prev 为上一次已落盘状态（开局 / 读档为 null，以建角属性为准） */
export function syncBoundMetrics(prev: GameState | null, next: GameState): GameState {
  return syncBoundMetricsWith(metricBinds(), prev, next);
}

