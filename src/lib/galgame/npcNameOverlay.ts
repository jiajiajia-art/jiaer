/**
 * 局内 NPC 改名：前端展示层 Option B（旧气泡同步新名）。
 */

export type NpcNameEditLike = {
  id?: string;
  name?: string;
  originalName?: string;
  previousNames?: string[];
};

export type NameReplacement = { from: string; to: string; npcId?: string };

function trimStr(value: unknown): string {
  return String(value ?? '').trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function rewriteTextByMap(text: string, replacements: NameReplacement[]): string {
  let out = String(text ?? '');
  if (!out || !replacements?.length) return out;
  const sorted = [...replacements]
    .filter((r) => r && trimStr(r.from) && trimStr(r.to) && trimStr(r.from) !== trimStr(r.to))
    .sort((a, b) => trimStr(b.from).length - trimStr(a.from).length);
  for (const { from, to } of sorted) {
    out = out.replace(new RegExp(escapeRegExp(from), 'g'), to);
  }
  return out;
}

export function buildNpcNameReplacementMap(
  edits: NpcNameEditLike[] | null | undefined,
  presetNpcs: Array<{ id?: string; name?: string }> | null | undefined = [],
): NameReplacement[] {
  const presetsById = new Map(
    (Array.isArray(presetNpcs) ? presetNpcs : []).map((n) => [String(n?.id || ''), n]),
  );
  const map: NameReplacement[] = [];
  for (const edit of Array.isArray(edits) ? edits : []) {
    const id = String(edit?.id || '');
    const to = trimStr(edit?.name);
    if (!id || !to) continue;
    const preset = presetsById.get(id);
    const fromSet = new Set<string>();
    for (const n of [
      edit.originalName,
      ...(Array.isArray(edit.previousNames) ? edit.previousNames : []),
      preset?.name,
    ]) {
      const from = trimStr(n);
      if (from && from !== to) fromSet.add(from);
    }
    for (const from of fromSet) {
      map.push({ from, to, npcId: id });
    }
  }
  return map;
}

export function applyNameMapToSteps<T extends Record<string, unknown>>(
  steps: T[],
  nameMap: NameReplacement[],
): T[] {
  if (!Array.isArray(steps) || !nameMap.length) return steps || [];
  return steps.map((step) => {
    if (!step || typeof step !== 'object') return step;
    const next: Record<string, unknown> = { ...step };
    let changed = false;
    for (const key of ['speakerName', 'content', 'text', 'message', 'title', 'description']) {
      if (typeof next[key] === 'string') {
        const rewritten = rewriteTextByMap(String(next[key]), nameMap);
        if (rewritten !== next[key]) {
          next[key] = rewritten;
          changed = true;
        }
      }
    }
    if (Array.isArray(next.options)) {
      next.options = next.options.map((opt) => {
        if (typeof opt === 'string') return rewriteTextByMap(opt, nameMap);
        if (opt && typeof opt === 'object') {
          const o = opt as Record<string, unknown>;
          return {
            ...o,
            content: typeof o.content === 'string' ? rewriteTextByMap(o.content, nameMap) : o.content,
            text: typeof o.text === 'string' ? rewriteTextByMap(o.text, nameMap) : o.text,
            message: typeof o.message === 'string' ? rewriteTextByMap(o.message, nameMap) : o.message,
          };
        }
        return opt;
      });
      changed = true;
    }
    return (changed ? next : step) as T;
  });
}
