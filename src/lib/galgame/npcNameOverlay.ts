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

/**
 * 按从长到短替换人名。
 * 先保护已是目标名 `to` 的片段，避免短别名「白→白白」把已有「白白」扩成「白白白白」。
 * 替换后对每个目标名（长度≥2）再压掉已叠坏的 to+to（如「白白白白」→「白白」），
 * 不依赖 from 必须是 to 的一半（「玩家→白白」时 LLM 仍可能写出叠名）。
 */
export function rewriteTextByMap(text: string, replacements: NameReplacement[]): string {
  let out = String(text ?? '');
  if (!out || !replacements?.length) return out;
  const sorted = [...replacements]
    .filter((r) => r && trimStr(r.from) && trimStr(r.to) && trimStr(r.from) !== trimStr(r.to))
    .sort((a, b) => trimStr(b.from).length - trimStr(a.from).length);
  const collapseTargets = new Set<string>();
  for (let i = 0; i < sorted.length; i += 1) {
    const from = trimStr(sorted[i].from);
    const to = trimStr(sorted[i].to);
    if (!from || !to || from === to) continue;
    // 私用区占位，避免与正文冲突
    const guard = `\uE000${i}\uE001`;
    if (out.includes(to)) {
      out = out.split(to).join(guard);
    }
    out = out.replace(new RegExp(escapeRegExp(from), 'g'), to);
    if (out.includes(guard)) {
      out = out.split(guard).join(to);
    }
    if (to.length >= 2) collapseTargets.add(to);
  }
  return collapseStackedDisplayNames(out, [...collapseTargets]);
}

/**
 * 功能注释：把正文里连续重复的现用名压回单次（「白白白白」→「白白」）。
 * 仅处理长度≥2 的名字，避免单字「白」把正确的「白白」拆坏。
 */
export function collapseStackedDisplayNames(
  text: string,
  names: Array<string | null | undefined>,
): string {
  let out = String(text ?? '');
  if (!out) return out;
  const unique = [...new Set(
    (Array.isArray(names) ? names : [])
      .map((n) => trimStr(n))
      .filter((n) => n.length >= 2),
  )].sort((a, b) => b.length - a.length);
  for (const name of unique) {
    const doubled = `${name}${name}`;
    while (out.includes(doubled)) {
      out = out.split(doubled).join(name);
    }
  }
  return out;
}

/** 功能注释：旧中文名推「姓+老师/同学…」等常见旧称呼，便于改名后展示层同步。 */
export function deriveLikelyFormerNicknames(oldName: string, newName: string): string[] {
  const old = trimStr(oldName);
  const next = trimStr(newName);
  if (!old || !next || old === next) return [];
  if (!/^[\u4e00-\u9fff]{2,4}$/.test(old)) return [];
  const surname = old[0];
  if (next.startsWith(surname)) return [];
  const out: string[] = [];
  for (const suf of ['老师', '同学', '哥', '姐', '总', '少', '先生', '小姐']) {
    const nick = `${surname}${suf}`;
    if (nick !== next && nick !== old) out.push(nick);
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
    for (const from of [...fromSet]) {
      for (const nick of deriveLikelyFormerNicknames(from, to)) {
        fromSet.add(nick);
      }
    }
    for (const from of fromSet) {
      map.push({ from, to, npcId: id });
    }
  }
  map.sort((a, b) => trimStr(b.from).length - trimStr(a.from).length);
  return map;
}

/**
 * 主角改名展示层：文档原名 / 历史曾用名 → 当前局内档案名。
 */
export function buildPlayerNameReplacementMap(input: {
  currentName?: string | null;
  aliases?: Array<string | null | undefined>;
}): NameReplacement[] {
  const to = trimStr(input.currentName);
  if (!to) return [];
  const seen = new Set<string>();
  const map: NameReplacement[] = [];
  for (const raw of input.aliases || []) {
    const from = trimStr(raw);
    if (!from || from === to || seen.has(from)) continue;
    seen.add(from);
    map.push({ from, to });
  }
  return map;
}

export function applyDisplayNameRewrites(
  text: string,
  nameMap: NameReplacement[],
  collapseNames: Array<string | null | undefined> = [],
): string {
  let out = String(text ?? '');
  if (!out) return out;
  if (nameMap?.length) out = rewriteTextByMap(out, nameMap);
  return collapseStackedDisplayNames(out, collapseNames);
}

/** 角色档案笺展示字段：简介 / 详细简介 / 态度 / 关系等随玩家现用名替换 */
export const DOSSIER_DISPLAY_TEXT_KEYS = Object.freeze([
  'summary',
  'detailedBio',
  'attitudeToPlayer',
  'relationship',
  'description',
  'personality',
] as const);

/**
 * 对档案展示用字段做旧名→现用名替换（不改 id/name 等结构字段）
 */
export function rewriteDossierTextFields<T extends Record<string, unknown>>(
  fields: T,
  nameMap: NameReplacement[],
  collapseNames: Array<string | null | undefined> = [],
): T {
  if (!fields || typeof fields !== 'object') return fields;
  if (!(nameMap && nameMap.length) && !(collapseNames && collapseNames.length)) {
    return fields;
  }
  const next: Record<string, unknown> = { ...fields };
  let changed = false;
  for (const key of DOSSIER_DISPLAY_TEXT_KEYS) {
    const raw = next[key];
    if (typeof raw !== 'string' || !raw) continue;
    const rewritten = applyDisplayNameRewrites(raw, nameMap, collapseNames);
    if (rewritten !== raw) {
      next[key] = rewritten;
      changed = true;
    }
  }
  return (changed ? next : fields) as T;
}

export function applyNameMapToSteps<T extends Record<string, unknown>>(
  steps: T[],
  nameMap: NameReplacement[],
  collapseNames: Array<string | null | undefined> = [],
): T[] {
  if (!Array.isArray(steps)) return steps || [];
  if (!nameMap.length && !(collapseNames && collapseNames.length)) return steps;
  const rewrite = (value: string) => applyDisplayNameRewrites(value, nameMap, collapseNames);
  return steps.map((step) => {
    if (!step || typeof step !== 'object') return step;
    const next: Record<string, unknown> = { ...step };
    let changed = false;
    for (const key of ['speakerName', 'content', 'text', 'message', 'title', 'description']) {
      if (typeof next[key] === 'string') {
        const rewritten = rewrite(String(next[key]));
        if (rewritten !== next[key]) {
          next[key] = rewritten;
          changed = true;
        }
      }
    }
    if (Array.isArray(next.options)) {
      next.options = next.options.map((opt) => {
        if (typeof opt === 'string') return rewrite(opt);
        if (opt && typeof opt === 'object') {
          const o = opt as Record<string, unknown>;
          return {
            ...o,
            content: typeof o.content === 'string' ? rewrite(o.content) : o.content,
            text: typeof o.text === 'string' ? rewrite(o.text) : o.text,
            message: typeof o.message === 'string' ? rewrite(o.message) : o.message,
          };
        }
        return opt;
      });
      changed = true;
    }
    return (changed ? next : step) as T;
  });
}
