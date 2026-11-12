/**
 * 生成世界 · 可玩性检查：格式合法 ≠ 能玩。
 * 检查主线节点是否真有 AI 写出的完成条件（不是本地兜底）、是否有结局、玩法规则是否全被清空、
 * 固定事件是否全是无后果空叙事。返回给 AI 看的整改意见；空数组 = 通过。
 * 纯函数，供 worldGenGenerate 在重试时把问题回喂给模型。
 */

type Rec = Record<string, unknown>;

/** 功能注释：清洗时被本地兜底补上条件的主线节点（同一次清洗内有效，不写进数据） */
export const WORLD_GEN_AUTO_COND_NODES = new WeakSet<object>();

const isRec = (v: unknown): v is Rec => !!v && typeof v === "object" && !Array.isArray(v);
const list = (v: unknown): Rec[] => (Array.isArray(v) ? v.filter(isRec) : []);

export function auditWorldGenPlayability(
  stepIds: readonly string[],
  patch: Rec,
  rawPatch?: Rec,
): string[] {
  const ids = new Set(stepIds);
  const issues: string[] = [];

  if (ids.has("storylines")) {
    const line = list(patch.storylines)[0];
    const nodes = list(line?.nodes).filter((n) => n.optional !== true);
    if (!line) issues.push("缺少主线 storylines[0]");
    else if (nodes.length < 2) issues.push("主线必做节点少于 2 个，剧情无法推进");
    else {
      const auto = nodes.filter((n) => WORLD_GEN_AUTO_COND_NODES.has(n)).map((n) => String(n.name ?? n.id));
      // 功能注释：超过一半节点靠本地兜底条件，说明 AI 写的条件基本无效
      if (auto.length * 2 > nodes.length) {
        issues.push(`主线节点「${auto.join("、")}」没有有效完成条件；请用 {kind:"event",key:"固定事件id"} 或 {kind:"metric",key:"建角属性id",op:"gte",value:数字} 等格式，key 必须是上方已给出的 id`);
      }
    }
    if (!list(patch.endings).length && !list(rawPatch?.endings).length) {
      issues.push("缺少结局 endings[]（至少写一个达成主线的好结局与一个失败结局）");
    }
  }

  if (ids.has("gameRules")) {
    const raw = list(rawPatch?.gameRules).length;
    const kept = list(patch.gameRules).length;
    if (raw > 0 && kept === 0) {
      issues.push("玩法规则全部没有有效效果被丢弃；每条规则的 branches 须带 effects:[{kind:\"metric\",key:\"建角属性id\",delta:数字}]");
    }
  }

  if (ids.has("fixedEvents")) {
    const evs = list(patch.fixedEvents);
    if (evs.length >= 2 && evs.every((e) => !list(e.effects).length && !list(e.choices).length)) {
      issues.push("固定事件全部没有数值后果或选项，玩家行动不会产生任何影响；请至少给一半事件写 effects（key 用建角属性 / 人物 id）");
    }
  }

  return issues;
}
