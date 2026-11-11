/**
 * 开局配置包：与创作台 storylines 解耦；openingRoute 必选 gate。
 * §3.1 默认方案 C：选中项=开场；其余=后续阶段约束（由 openingRouteId + retainedStorylineIds 表达）。
 */

import { resolvePlayerDisplayName } from './playerDisplayName.ts';

export type WritingPace = 'slow' | 'medium' | 'fast';

export type GameStartPersonaBlocks = {
  identity?: string;
  traits?: string;
  background?: string;
  goal?: string;
  /** 玩家未公开的秘密动机；NPC 不可全知 */
  secret?: string;
};

export type GameStartWorldBookEntry = {
  id?: string;
  title: string;
  content: string;
  keywords?: string[];
  constant?: boolean;
  enabled?: boolean;
};

export type GameStartWritingStyle = {
  toggles: string[];
  pace: WritingPace;
  avoidWords: string[];
};

export type GameStartConfig = {
  player: {
    name: string;
    gender: 'male' | 'female' | 'other';
    personaBlocks?: GameStartPersonaBlocks;
    attributes?: Record<string, number>;
  };
  worldBookEntries?: GameStartWorldBookEntry[];
  writingStyle?: GameStartWritingStyle;
  /**
   * 玩家设置的「最大回复」字数（汉字）。写入后覆盖世界 llmConfig 的输出长度引导。
   * 未设置时沿用创作台 / 默认 target≈400。
   */
  maxResponseChars?: number;
  /** 玩法侧开局路线 id（必填） */
  openingRouteId: string;
  openingMonologue?: string;
  /**
   * 方案 C：除开场路线外，后续阶段仍注入的创作台 storyline id 列表。
   * 无多阶段结构时为空数组（退化为方案 A）。
   */
  retainedStorylineIds?: string[];
};

export type OpeningRouteOption = {
  id: string;
  title: string;
  summary?: string;
  openingMonologue?: string;
  /** 该路线对应的确定性人设（供档案写入） */
  persona?: string;
};

export const GAME_START_LIMITS = Object.freeze({
  playerName: { min: 1, max: 40 },
  openingMonologue: { max: 2000 },
  avoidWordMax: 40,
  avoidWordsMax: 50,
  /** 设置「最大回复」：200～2000 字（需求图） */
  maxResponseChars: { min: 200, max: 2000, default: 800, step: 100 },
});

/**
 * 功能注释：把玩家选择的最大回复字数钳到合法区间；非法则返回 null（表示不覆盖世界配置）。
 * 注意：Number(null)===0，须先排除 null/空串。
 */
export function clampMaxResponseChars(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  const { min, max } = GAME_START_LIMITS.maxResponseChars;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/**
 * 开局 / 路线相关文案（对齐《TXT模式自由度改版》§4.3 / §4.4 UE）。
 * 新开局不再弹窗；路线改在系统面板「目前选择路线」调整。
 */
export const GAME_START_UE_COPY = Object.freeze({
  /** §4.4 系统模块 */
  currentRouteSection: '目前选择路线',
  currentRouteHint: '展示当前开场路线；切换后将按新路线约束后续叙事',
  changeRouteConfirmTitle: '更换路线',
  changeRouteConfirmMessage: '确认切换到该开场路线？后续叙事将按新路线约束。',
  changeRouteConfirmOk: '确认更换',
  /** 无创作台 keyEvents 时的兜底路线名（勿用「默认开场」） */
  fallbackRouteTitle: '开场路线',
  storylinePickLabel: '故事线选择',
  /** 静默开局姓名兜底（优先用创作台玩家名；禁止用「玩家」） */
  fallbackPlayerName: '旅人',
});

const PACES = new Set<WritingPace>(['slow', 'medium', 'fast']);

function trimStr(value: unknown): string {
  return String(value ?? '').trim();
}

/** 文档人设若仍是「可三选一」类引导文，不当作局内确定人设。 */
export function isMultiChoicePersonaText(text: unknown): boolean {
  const t = trimStr(text);
  if (!t) return false;
  return /可在.{0,24}选择|三种职业|三选一|多种身份|可选身份|玩家可/.test(t);
}

/** 从开局路线取确定性人设文案。 */
export function resolveRoutePersona(route?: OpeningRouteOption | null): string {
  if (!route) return '';
  const persona = trimStr(route.persona) || trimStr(route.summary) || trimStr(route.openingMonologue);
  if (!persona || isMultiChoicePersonaText(persona)) return '';
  return persona;
}

/** 功能注释：把创作台玩家性别归一成开局包三态。 */
export function normalizeGameStartGender(
  raw: unknown,
): GameStartConfig['player']['gender'] {
  const g = String(raw || '').trim().toLowerCase();
  if (g === 'male' || g === 'm' || g === '男') return 'male';
  if (g === 'female' || g === 'f' || g === '女') return 'female';
  return 'other';
}

type WorldKeyEventLike = { title?: string; description?: string };

/**
 * 功能注释：从世界 keyEvents 生成开场路线列表；空列表时给一条「开场路线」兜底。
 * 路线 description 同时作为确定性人设候选（选择性身份应体现在多条路线上）。
 */
export function buildOpeningRoutesFromWorldKeyEvents(
  keyEvents: WorldKeyEventLike[] | null | undefined,
  options?: { initialPlot?: string },
): OpeningRouteOption[] {
  const list = Array.isArray(keyEvents) ? keyEvents : [];
  const initialPlot = trimStr(options?.initialPlot);
  if (list.length === 0) {
    return [
      {
        id: 'opening-default',
        title: GAME_START_UE_COPY.fallbackRouteTitle,
        summary: '',
        openingMonologue: initialPlot || undefined,
        persona: initialPlot && !isMultiChoicePersonaText(initialPlot) ? initialPlot : undefined,
      },
    ];
  }
  return list.map((ev, idx) => {
    const title = trimStr(ev?.title) || `故事线 ${idx + 1}`;
    const description = trimStr(ev?.description);
    const persona = description && !isMultiChoicePersonaText(description) ? description : '';
    return {
      id: `route-${idx}-${title.slice(0, 12)}`,
      title,
      summary: description.slice(0, 120) || undefined,
      openingMonologue: description || initialPlot || undefined,
      persona: persona || undefined,
    };
  });
}

/**
 * 功能注释：规范化创作者默认定位块；空对象返回 undefined。
 */
export function normalizeDefaultPersonaBlocks(
  input: unknown,
): GameStartPersonaBlocks | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const src = input as GameStartPersonaBlocks;
  const identity = trimStr(src.identity) || undefined;
  const traits = trimStr(src.traits) || undefined;
  const background = trimStr(src.background) || undefined;
  const goal = trimStr(src.goal) || undefined;
  const secret = trimStr(src.secret) || undefined;
  if (!identity && !traits && !background && !goal && !secret) return undefined;
  return { identity, traits, background, goal, secret };
}

/**
 * 功能注释：新开局无弹窗时的静默开局包——用创作台玩家信息 + 首条故事线。
 */
export function buildSilentDefaultGameStartConfig(input: {
  playerName?: string | null;
  gender?: unknown;
  routes: OpeningRouteOption[];
  /** 文档人设；若是多选引导文则忽略，改用路线人设 */
  documentPersona?: string | null;
  /** 创作者在「玩家目前定位」填写的默认身份/立场/秘密 */
  defaultPersonaBlocks?: GameStartPersonaBlocks | null;
}): { ok: true; data: GameStartConfig } | { ok: false; message: string } {
  const routes =
    Array.isArray(input.routes) && input.routes.length > 0
      ? input.routes
      : buildOpeningRoutesFromWorldKeyEvents([]);
  const firstId = trimStr(routes[0]?.id);
  const resolved = resolveOpeningRouteSelection(routes, firstId);
  if (!resolved.ok || !resolved.openingRouteId) {
    return { ok: false, message: resolved.message || '请选择故事线' };
  }
  const selected = routes.find((r) => r.id === resolved.openingRouteId) || routes[0];
  const routePersona = resolveRoutePersona(selected);
  const docPersona = trimStr(input.documentPersona);
  const persona =
    routePersona
    || (!isMultiChoicePersonaText(docPersona) ? docPersona : '');
  const creatorBlocks = normalizeDefaultPersonaBlocks(input.defaultPersonaBlocks);
  const identity = trimStr(creatorBlocks?.identity) || persona || undefined;
  const traits = trimStr(creatorBlocks?.traits) || undefined;
  const secret = trimStr(creatorBlocks?.secret) || undefined;
  const personaBlocks =
    identity || traits || secret || creatorBlocks?.background || creatorBlocks?.goal
      ? {
          identity,
          traits,
          background: creatorBlocks?.background,
          goal: creatorBlocks?.goal,
          secret,
        }
      : undefined;
  const validated = validateGameStartConfig({
    player: {
      name:
        resolvePlayerDisplayName([input.playerName])
        || GAME_START_UE_COPY.fallbackPlayerName,
      gender: normalizeGameStartGender(input.gender),
      ...(personaBlocks ? { personaBlocks } : {}),
    },
    // 功能注释：新开局默认给更长回复，缓解「每次只有一两百字」；玩家可在设置再调
    maxResponseChars: GAME_START_LIMITS.maxResponseChars.default,
    openingRouteId: resolved.openingRouteId,
    openingMonologue: resolved.openingMonologue,
    retainedStorylineIds: resolved.retainedStorylineIds,
  });
  if (!validated.ok) {
    return { ok: false, message: validated.message || '开局配置无效' };
  }
  return { ok: true, data: validated.data };
}

/** 功能注释：未选故事线不可提交；已选可提交。 */
export function canSubmitGameStart(config: Partial<GameStartConfig> | null | undefined): boolean {
  const routeId = trimStr(config?.openingRouteId);
  const name = trimStr(config?.player?.name);
  return Boolean(routeId) && Boolean(name);
}

/** 功能注释：完整校验开局包。 */
export function validateGameStartConfig(input: Partial<GameStartConfig> | null | undefined):
  | { ok: true; data: GameStartConfig }
  | { ok: false; message: string } {
  const name = trimStr(input?.player?.name);
  const gender = String(input?.player?.gender || '').trim() as GameStartConfig['player']['gender'];
  const openingRouteId = trimStr(input?.openingRouteId);
  const openingMonologue = trimStr(input?.openingMonologue);

  if (!name) return { ok: false, message: '请填写角色姓名' };
  if (name.length > GAME_START_LIMITS.playerName.max) {
    return { ok: false, message: `姓名不能超过${GAME_START_LIMITS.playerName.max}字` };
  }
  if (!['male', 'female', 'other'].includes(gender)) {
    return { ok: false, message: '请选择性别' };
  }
  if (!openingRouteId) {
    return { ok: false, message: '请先完成故事线选择' };
  }
  if (openingMonologue.length > GAME_START_LIMITS.openingMonologue.max) {
    return { ok: false, message: '开场白过长' };
  }

  let writingStyle: GameStartWritingStyle | undefined;
  if (input?.writingStyle) {
    const pace = String(input.writingStyle.pace || 'medium') as WritingPace;
    if (!PACES.has(pace)) return { ok: false, message: '文风节奏无效' };
    const avoidWords = (input.writingStyle.avoidWords || [])
      .map((w) => trimStr(w))
      .filter(Boolean)
      .slice(0, GAME_START_LIMITS.avoidWordsMax)
      .map((w) => w.slice(0, GAME_START_LIMITS.avoidWordMax));
    writingStyle = {
      toggles: (input.writingStyle.toggles || []).map((t) => trimStr(t)).filter(Boolean),
      pace,
      avoidWords,
    };
  }

  const maxResponseChars = clampMaxResponseChars(input?.maxResponseChars);

  const personaBlocks = input?.player?.personaBlocks
    ? {
        identity: trimStr(input.player.personaBlocks.identity) || undefined,
        traits: trimStr(input.player.personaBlocks.traits) || undefined,
        background: trimStr(input.player.personaBlocks.background) || undefined,
        goal: trimStr(input.player.personaBlocks.goal) || undefined,
        secret: trimStr(input.player.personaBlocks.secret) || undefined,
      }
    : undefined;

  return {
    ok: true,
    data: {
      player: {
        name,
        gender,
        personaBlocks,
        attributes: input?.player?.attributes && typeof input.player.attributes === 'object'
          ? { ...input.player.attributes }
          : undefined,
      },
      worldBookEntries: Array.isArray(input?.worldBookEntries)
        ? input!.worldBookEntries!.map((e) => ({
            id: e.id ? String(e.id) : undefined,
            title: trimStr(e.title),
            content: trimStr(e.content),
            keywords: Array.isArray(e.keywords) ? e.keywords.map((k) => trimStr(k)).filter(Boolean) : [],
            constant: Boolean(e.constant),
            enabled: e.enabled !== false,
          })).filter((e) => e.title || e.content)
        : undefined,
      writingStyle,
      ...(maxResponseChars != null ? { maxResponseChars } : {}),
      openingRouteId,
      openingMonologue: openingMonologue || undefined,
      retainedStorylineIds: Array.isArray(input?.retainedStorylineIds)
        ? input!.retainedStorylineIds!.map((id) => trimStr(id)).filter(Boolean)
        : [],
    },
  };
}

/**
 * 功能注释：方案 C——选中路线为开场；其余路线 id 进入 retained（后续约束）。
 * 仅一条时 retained 为空（退化 A）。
 */
export function resolveOpeningRouteSelection(
  routes: OpeningRouteOption[],
  selectedId: string,
): {
  ok: boolean;
  message?: string;
  openingRouteId?: string;
  openingMonologue?: string;
  retainedStorylineIds?: string[];
  selected?: OpeningRouteOption;
} {
  const id = trimStr(selectedId);
  if (!id) return { ok: false, message: '请选择故事线' };
  const list = Array.isArray(routes) ? routes : [];
  const selected = list.find((r) => String(r.id) === id);
  if (!selected) return { ok: false, message: '故事线不存在' };
  const retainedStorylineIds = list
    .map((r) => String(r.id))
    .filter((rid) => rid && rid !== id);
  return {
    ok: true,
    openingRouteId: id,
    openingMonologue: trimStr(selected.openingMonologue) || undefined,
    retainedStorylineIds,
    selected,
  };
}

/** 功能注释：「开始冒险」按钮是否可点。 */
export function isStartAdventureEnabled(config: Partial<GameStartConfig> | null | undefined): boolean {
  return canSubmitGameStart(config);
}
