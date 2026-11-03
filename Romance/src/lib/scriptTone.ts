/* 剧本基调：作者只编辑一处；旧模组的 GM 开场白 / 世界观设定 / 叙事口吻按序并入，发给模型仍是这段话。 */
import type { PromptFragments } from "../mods/types.ts";

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** 功能注释：优先 scriptTone；否则按 GM → 世界观 → 口吻接上，不丢旧字 */
export function readScriptTone(p?: PromptFragments | null): string {
  if (!p) return "";
  const tone = str(p.scriptTone);
  if (tone) return tone;
  return [str(p.gmIntro), str(p.worldIntro), str(p.narratorPersona)].filter(Boolean).join("\n\n");
}

/**
 * 功能注释：作者改「剧本基调」时写入 scriptTone，并清掉旧三字段，避免运行时重复注入。
 * 空串则去掉 scriptTone；保留 terminology 等已下架但仍可能存在的字段。
 */
export function applyScriptTone(p: PromptFragments | undefined, text: string): PromptFragments {
  const next: PromptFragments = { ...(p ?? {}) };
  delete next.gmIntro;
  delete next.worldIntro;
  delete next.narratorPersona;
  const raw = typeof text === "string" ? text : "";
  if (raw.trim()) next.scriptTone = raw;
  else delete next.scriptTone;
  return next;
}

/** 功能注释：保存前把仍分三处的旧稿并进 scriptTone，不丢字 */
export function consolidateScriptTone(p?: PromptFragments | null): PromptFragments | undefined {
  if (!p) return undefined;
  const joined = readScriptTone(p);
  if (!joined && !p.terminology && !p.extraRules && !p.openingDirective && !p.endingHint && !p.npcExample && !p.mockEpilogue) {
    return undefined;
  }
  const next = applyScriptTone(p, joined);
  return next;
}

/**
 * 功能注释：世界观与叠加包合并时，先分别读取新旧基调，再按加载顺序拼接，
 * 避免一个包已有 scriptTone 时吞掉另一个旧包的三段提示词。
 */
export function mergeScriptToneFragments(base?: PromptFragments | null, incoming?: PromptFragments | null): PromptFragments {
  const merged: PromptFragments = { ...(base ?? {}), ...(incoming ?? {}) };
  const tone = [readScriptTone(base), readScriptTone(incoming)].filter(Boolean).join("\n\n");
  return applyScriptTone(merged, tone);
}
