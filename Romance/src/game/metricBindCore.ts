/** 功能注释：玩法数值绑定 · 纯逻辑（不读世界数据，便于单测）；说明见 metricBind.ts */
import type { AttrDef, GameState } from "../lib/types";

export type MetricRole = "fame" | "reputation" | "blackFans" | "stamina";
export type MetricBindSlot = Partial<Record<MetricRole, string>>;

export const METRIC_ROLES: { role: MetricRole; label: string; hint: string }[] = [
  { role: "fame", label: "名气 / 人气", hint: "通告与合约门槛、作品上映热度、舆情粉丝数" },
  { role: "reputation", label: "口碑", hint: "作品口碑、舆情公关判定" },
  { role: "blackFans", label: "负面热度（黑粉）", hint: "舆情危机与黑粉增长" },
  { role: "stamina", label: "体能", hint: "影视拍摄翻车判定的体能缓解" },
];

type Sim = GameState["sim"];
const readBuiltin = (sim: Sim, role: MetricRole): number => {
  if (role === "stamina") return Number((sim.stats as Record<string, number>)?.tineng ?? 0);
  return Number((sim as unknown as Record<string, number>)[role] ?? 0);
};
const writeBuiltin = (sim: Sim, role: MetricRole, v: number): Sim =>
  role === "stamina"
    ? { ...sim, stats: { ...sim.stats, tineng: v } as Sim["stats"] }
    : ({ ...sim, [role]: v } as Sim);

const clampToDef = (def: AttrDef, v: number) => {
  const max = typeof def.max === "number" && def.max > 0 ? def.max : Infinity;
  return Math.max(def.min ?? 0, Math.min(max, Math.round(v)));
};

/** 功能注释：同步算法本体（纯函数，便于单测）；binds 为已解析的「角色 → 属性定义」 */
export function syncBoundMetricsWith(binds: { role: MetricRole; def: AttrDef }[], prev: GameState | null, next: GameState): GameState {
  if (!binds.length) return next;
  let sim = next.sim;
  let cattrs = { ...(sim.cattrs ?? {}) };
  let changed = false;
  for (const { role, def } of binds) {
    const id = def.id;
    const attrNow = cattrs[id] ?? def.init ?? 0;
    const attrPrev = prev ? (prev.sim.cattrs?.[id] ?? def.init ?? 0) : undefined;
    const bNow = readBuiltin(sim, role);
    const bPrev = prev ? readBuiltin(prev.sim, role) : undefined;
    let target: number;
    if (!prev || attrNow !== attrPrev) target = attrNow; // 建角属性是本次变化来源
    else if (bNow !== bPrev) target = clampToDef(def, bNow); // 引擎结算改了 → 写回属性
    else target = attrNow; // 无变化：纠正漂移
    if (cattrs[id] !== target) { cattrs = { ...cattrs, [id]: target }; changed = true; }
    if (bNow !== target) { sim = writeBuiltin(sim, role, target); changed = true; }
  }
  return changed ? { ...next, sim: { ...sim, cattrs } } : next;
}
