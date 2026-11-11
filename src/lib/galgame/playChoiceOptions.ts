/**
 * 局内选项展示：2～4 条。
 * - 上限：前端裁切到 4
 * - 禁止短句 / 残缺半句（如「立刻」「把怀里的」）
 * - 须「当前角色名 + 完整动宾/去向」；不足 2 时按该格式补全
 */

export const PLAY_CHOICE_OPTION_MIN = 2;
export const PLAY_CHOICE_OPTION_MAX = 4;
/** 与后端 CHOICE_OPTION_TEXT_MIN 对齐：至少 4 字 */
export const PLAY_CHOICE_OPTION_TEXT_MIN = 4;
/** 与后端 CHOICE_OPTION_COMPLETE_MIN 对齐：完整话术至少 6 字 */
export const PLAY_CHOICE_OPTION_COMPLETE_MIN = 6;

export type PlayChoiceExpandContext = {
  sceneName?: string | null;
  npcNames?: Array<string | null | undefined> | null;
  playerName?: string | null;
};

function optionTextOf(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object') {
    const o = value as { text?: unknown; content?: unknown; message?: unknown };
    return String(o.text ?? o.content ?? o.message ?? '').trim();
  }
  return String(value ?? '').trim();
}

/** 功能注释：残缺半句（句末助词未闭合、过短、动宾被截断如「找罗」）。 */
export function looksLikeIncompletePlayChoiceOption(value: unknown): boolean {
  const t = optionTextOf(value);
  if (!t) return true;
  if (Array.from(t).length < PLAY_CHOICE_OPTION_COMPLETE_MIN) return true;
  if (/[的地得着把将与和及以从在对给被让叫使跟同]$/u.test(t)) return true;
  if (/[，、；：…—\-]$/u.test(t)) return true;
  if (/^把.+的$/u.test(t)) return true;
  if (/[找见寻访问约喊叫请送迎带追拦]$/u.test(t)) return true;
  if (/[找见寻访问约喊叫请送迎带追拦][\u4e00-\u9fff]$/u.test(t)) return true;
  return false;
}

/** 功能注释：把「…找罗」补成「…找罗秀英」。 */
export function tryRepairTruncatedPlayChoiceOption(
  text: unknown,
  npcNames?: Array<string | null | undefined> | null,
): string {
  const t = optionTextOf(text);
  if (!t) return '';
  const m = t.match(/^(.*[找见寻访问约喊叫请送迎带追拦])([\u4e00-\u9fff])$/u);
  if (!m) return '';
  const stem = m[1];
  const ch = m[2];
  const names = (Array.isArray(npcNames) ? npcNames : [])
    .map((n) => String(n || '').trim())
    .filter(Boolean);
  const hit = names.find((n) => n.startsWith(ch) && Array.from(n).length >= 2);
  if (!hit) return '';
  return `${stem}${hit}`;
}

/** 功能注释：补当前角色名；「你…」有真名时改写。 */
export function ensurePlayChoiceOptionActor(text: unknown, playerName?: string | null): string {
  const name = String(playerName || '').trim() || '你';
  let t = optionTextOf(text);
  if (!t) return '';
  if (t.startsWith(name)) return t;
  if (/^你/.test(t) && name !== '你') {
    return `${name}${t.slice(1)}`;
  }
  return `${name}${t}`;
}

/** 功能注释：规范化为角色名+完整话术；残缺返回空。先补 NPC 全名再补角色名。 */
export function normalizePlayChoiceOptionText(
  value: unknown,
  playerName?: string | null,
  npcNames?: Array<string | null | undefined> | null,
): string {
  let raw = optionTextOf(value);
  if (!raw) return '';
  if (Array.from(raw).length < PLAY_CHOICE_OPTION_TEXT_MIN) return '';

  const repaired = tryRepairTruncatedPlayChoiceOption(raw, npcNames);
  if (repaired) raw = repaired;

  if (/[的地得着把将与和及以从在对给被让叫使跟同]$/u.test(raw)) return '';
  if (/[，、；：…—\-]$/u.test(raw)) return '';
  if (/^把.+的$/u.test(raw)) return '';
  if (/[找见寻访问约喊叫请送迎带追拦]$/u.test(raw)) return '';
  if (/[找见寻访问约喊叫请送迎带追拦][\u4e00-\u9fff]$/u.test(raw)) return '';

  const withActor = ensurePlayChoiceOptionActor(raw, playerName);
  if (!withActor) return '';
  if (looksLikeIncompletePlayChoiceOption(withActor)) return '';
  return withActor;
}

/** 功能注释：可展示的选项文案（非空、够长、非残缺）。 */
export function isUsablePlayChoiceOptionText(value: unknown): boolean {
  const text = optionTextOf(value);
  if (!text) return false;
  if (Array.from(text).length < PLAY_CHOICE_OPTION_TEXT_MIN) return false;
  if (looksLikeIncompletePlayChoiceOption(text)) return false;
  return true;
}

/** 合并 mainOptions + options，去空去重后的文案列表 */
export function listPlayChoiceOptionTexts(
  step: {
    mainOptions?: unknown;
    mainOption?: unknown;
    options?: unknown;
  } | null | undefined,
  playerName?: string | null,
  npcNames?: Array<string | null | undefined> | null,
): string[] {
  if (!step) return [];
  const rawMain = Array.isArray(step.mainOptions)
    ? step.mainOptions
    : (step.mainOption ? [step.mainOption] : []);
  const rawNormal = Array.isArray(step.options) ? step.options : [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of [...rawMain, ...rawNormal]) {
    const text = normalizePlayChoiceOptionText(item, playerName, npcNames);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
    if (out.length >= PLAY_CHOICE_OPTION_MAX) break;
  }
  return out;
}

export function countPlayChoiceOptions(
  step: {
    mainOptions?: unknown;
    mainOption?: unknown;
    options?: unknown;
  } | null | undefined,
  playerName?: string | null,
  npcNames?: Array<string | null | undefined> | null,
): number {
  return listPlayChoiceOptionTexts(step, playerName, npcNames).length;
}

/** 该 choice 步是否已有可点选项（含仅写在 mainOptions 的情况） */
export function choiceStepHasPlayableOptions(step: {
  type?: unknown;
  mainOptions?: unknown;
  mainOption?: unknown;
  options?: unknown;
} | null | undefined): boolean {
  return step?.type === 'choice' && countPlayChoiceOptions(step) > 0;
}

export function clampPlayChoiceOptions<T extends { text?: string }>(
  options: T[] | null | undefined,
  playerName?: string | null,
  npcNames?: Array<string | null | undefined> | null,
): T[] {
  if (!Array.isArray(options)) return [];
  const seen = new Set<string>();
  const out: T[] = [];
  for (const opt of options) {
    const text = normalizePlayChoiceOptionText(opt?.text, playerName, npcNames);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push({ ...opt, text });
    if (out.length >= PLAY_CHOICE_OPTION_MAX) break;
  }
  return out;
}

/** 功能注释：按「角色+动宾去向」生成兜底选项（与后端对齐）。 */
export function buildPlayChoiceFallbackTexts(ctx?: PlayChoiceExpandContext | null): string[] {
  const playerName = String(ctx?.playerName || '').trim() || '你';
  const sceneName = String(ctx?.sceneName || '').trim() || '此处';
  const npcNames = (Array.isArray(ctx?.npcNames) ? ctx!.npcNames : [])
    .map((n) => String(n || '').trim())
    .filter(Boolean)
    .slice(0, 3);

  const candidates: string[] = [];
  candidates.push(`${playerName}留在${sceneName}仔细观察四周`);
  candidates.push(`${playerName}立刻前往${sceneName}寻找破绽`);
  candidates.push(`${playerName}转身离开${sceneName}另寻出路`);
  for (const name of npcNames) {
    candidates.push(`${playerName}上前与${name}交谈探听消息`);
    candidates.push(`${playerName}跟着${name}去往别处查探`);
    candidates.push(`${playerName}旁观${name}的动静再决定去向`);
  }
  candidates.push(`${playerName}先稳住局面再选下一条去路`);
  candidates.push(`${playerName}四处走走看看有没有转机`);
  return candidates.filter(isUsablePlayChoiceOptionText);
}

type ChoiceOpt = { id: number; text: string; isMain?: boolean };

/**
 * 功能注释：裁切到最多 4；丢弃短句/残缺；补角色名；不足 2 时按角色+动宾补到至少 2。
 */
export function ensureMinPlayChoiceOptions<T extends { id?: number; text?: string; isMain?: boolean }>(
  options: T[] | null | undefined,
  ctx?: PlayChoiceExpandContext | null,
): ChoiceOpt[] {
  const playerName = String(ctx?.playerName || '').trim() || '你';
  const npcNames = Array.isArray(ctx?.npcNames) ? ctx!.npcNames : [];
  const clamped = clampPlayChoiceOptions(options, playerName, npcNames).map((opt, index) => {
    const row: ChoiceOpt = {
      id: Number.isFinite(Number(opt.id)) ? Number(opt.id) : index + 1,
      text: String(opt.text || '').trim(),
    };
    if (typeof opt.isMain === 'boolean') row.isMain = opt.isMain;
    return row;
  }).filter((o) => isUsablePlayChoiceOptionText(o.text));

  if (clamped.length >= PLAY_CHOICE_OPTION_MIN) {
    return clamped.slice(0, PLAY_CHOICE_OPTION_MAX);
  }

  const seen = new Set(clamped.map((o) => o.text));
  const out = [...clamped];
  let nextId = out.reduce((max, o) => Math.max(max, Number(o.id) || 0), 0) + 1;
  for (const fb of buildPlayChoiceFallbackTexts(ctx)) {
    if (out.length >= PLAY_CHOICE_OPTION_MIN) break;
    if (!isUsablePlayChoiceOptionText(fb) || seen.has(fb)) continue;
    seen.add(fb);
    out.push({ id: nextId, text: fb, isMain: false });
    nextId += 1;
  }
  let n = 1;
  while (out.length < PLAY_CHOICE_OPTION_MIN && n < 6) {
    const text = `${playerName}另寻一条可行去向（${n}）`;
    n += 1;
    if (seen.has(text) || !isUsablePlayChoiceOptionText(text)) continue;
    seen.add(text);
    out.push({ id: nextId, text, isMain: false });
    nextId += 1;
  }
  return out.slice(0, PLAY_CHOICE_OPTION_MAX);
}

/** 生成侧是否达到目标最少选项数（仅用于校验） */
export function hasEnoughPlayChoiceOptions(options: Array<{ text?: string }> | null | undefined): boolean {
  return clampPlayChoiceOptions(options).length >= PLAY_CHOICE_OPTION_MIN;
}
