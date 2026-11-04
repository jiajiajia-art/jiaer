/**
 * 生成世界 · 剧情线清洗：只保留一条主线、带齐有说明/条件的节点；
 * 剥掉节点奖励与激活事件；AI 不得写入支线（留给创作者手建）。
 */
import { asTrimmedString } from "./asTrimmedString.ts";

const EMPTY_NODE_NAMES = new Set(["", "新节点", "节点", "未命名", "未命名节点"]);

function asCondArray(raw: unknown): Record<string, unknown>[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((row) => row && typeof row === "object" && !Array.isArray(row)) as Record<string, unknown>[];
}

/**
 * 功能注释：把 AI 写出的主线节点收成「有名称 + 目标说明 + 至少一条完成条件」；
 * 丢掉奖励 / 激活事件字段；空壳「新节点」按序改名或剔除。
 */
export function normalizeWorldGenQuestNodes(raw: unknown): Record<string, unknown>[] {
  if (!Array.isArray(raw)) return [];
  const out: Record<string, unknown>[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const r = row as Record<string, unknown>;
    const desc = asTrimmedString(r.desc);
    const conds = asCondArray(r.conds);
    let name = asTrimmedString(r.name);
    if (!name || EMPTY_NODE_NAMES.has(name)) {
      name = desc ? desc.slice(0, 24) : `节点${out.length + 1}`;
    }
    if (!desc && !conds.length && EMPTY_NODE_NAMES.has(asTrimmedString(r.name) || "")) continue;
    const node: Record<string, unknown> = {
      id: asTrimmedString(r.id) || `qn_${out.length + 1}`,
      name,
      conds: conds.length ? conds : [{ kind: "metric", key: "fame", op: "gte", value: 10 }],
    };
    if (desc) node.desc = desc;
    if (r.optional === true) node.optional = true;
    if (r.match === "any" || r.match === "all") node.match = r.match;
    const fail = asCondArray(r.failConds);
    if (fail.length) node.failConds = fail;
    // 功能注释：主线节点不再配奖励 / 完成后激活事件（旧稿字段也剥掉）
    out.push(node);
  }
  return out;
}

/**
 * 功能注释：剧情线补丁——至多 1 条主线且 nodes 规范化；删除 sidelines，禁止 AI 生成支线。
 */
export function normalizeWorldGenStorylinesPatch(patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...patch };
  delete out.sidelines;

  if (!("storylines" in out)) return out;
  if (!Array.isArray(out.storylines)) {
    delete out.storylines;
    return out;
  }

  const mains: Record<string, unknown>[] = [];
  for (const row of out.storylines) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const r = row as Record<string, unknown>;
    const nodes = normalizeWorldGenQuestNodes(r.nodes);
    if (!nodes.length) continue;
    const name = asTrimmedString(r.name) || asTrimmedString(r.title) || "主线";
    const line: Record<string, unknown> = {
      id: asTrimmedString(r.id) || "sl_main",
      name: name === "新主线" ? "主线" : name,
      nodes,
    };
    const desc = asTrimmedString(r.desc);
    if (desc) line.desc = desc;
    if (r.enabled === false) line.enabled = false;
    mains.push(line);
    break; // 功能注释：只留第一条主线
  }

  if (mains.length) out.storylines = mains;
  else delete out.storylines;
  return out;
}
