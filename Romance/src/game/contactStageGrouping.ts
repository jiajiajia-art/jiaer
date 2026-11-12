/** 纯逻辑：旧阶段的 groups 限定一律剥离，只按关系值判定。 */
import { lastOf } from "../lib/lastOf.ts";
export type ContactStageShape = { id: string; label: string; min: number; tone?: string; groups?: string[] };

export function normalizeContactStages<T extends ContactStageShape>(stages: readonly T[]): Omit<T, "groups">[] {
  return stages.map(({ groups: _groups, ...stage }) => {
    void _groups;
    return stage;
  });
}

export function resolveContactStage<T extends ContactStageShape>(stages: readonly T[], value: number): Omit<T, "groups"> | undefined {
  const sorted = normalizeContactStages(stages).sort((a, b) => b.min - a.min);
  return sorted.find((stage) => value >= stage.min) ?? lastOf(sorted);
}

/** 功能注释：按作者配置顺序出组；每个人只进入当前关系阶段一次。 */
export function groupByContactStage<T, S extends ContactStageShape>(
  stages: readonly S[],
  entries: readonly T[],
  relationValue: (entry: T) => number,
): Array<{ stage: Omit<S, "groups">; people: T[] }> {
  const normalized = normalizeContactStages(stages);
  const buckets = new Map(normalized.map((stage) => [stage.id, [] as T[]]));
  for (const entry of entries) {
    const stage = resolveContactStage(normalized, relationValue(entry));
    if (stage) buckets.get(stage.id)?.push(entry);
  }
  return normalized.map((stage) => ({ stage, people: buckets.get(stage.id) ?? [] })).filter((group) => group.people.length > 0);
}
