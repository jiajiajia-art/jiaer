/**
 * 主线条件可选项：主线本身 + 各节点。
 * 功能注释：AI/脏稿常缺 nodes；编辑器直接 .map 会崩成 reading 'map'。
 */
export type QuestOptLine = {
  id: string;
  name?: string;
  nodes?: { id: string; name?: string; optional?: boolean }[] | null;
};

export type QuestOpt = { id: string; label: string };

/** 功能注释：把主线列表收成条件选择项；缺 nodes / 非数组一律当空 */
export function buildQuestOpts(lines: QuestOptLine[] | undefined | null): QuestOpt[] {
  return (lines ?? []).flatMap((l) => {
    if (!l || typeof l !== "object") return [];
    const nodes = Array.isArray(l.nodes) ? l.nodes : [];
    return [
      { id: l.id, label: `主线·${l.name || l.id}` },
      ...nodes.map((n, i) => ({
        id: n.id,
        label: `　${i + 1}. ${n.optional ? "（可选）" : ""}${n.name || n.id}`,
      })),
    ];
  });
}
