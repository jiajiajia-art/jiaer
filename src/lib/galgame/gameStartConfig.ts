/**
 * 开局配置包：与创作台 storylines 解耦；openingRoute 必选 gate。
 * §3.1 默认方案 C：选中项=开场；其余=后续阶段约束（由 openingRouteId + retainedStorylineIds 表达）。
 */

export type WritingPace = 'slow' | 'medium' | 'fast';

export type GameStartPersonaBlocks = {
  identity?: string;
  traits?: string;
  background?: string;
  goal?: string;
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
};

export const GAME_START_LIMITS = Object.freeze({
  playerName: { min: 1, max: 40 },
  openingMonologue: { max: 2000 },
  avoidWordMax: 40,
  avoidWordsMax: 50,
});

const PACES = new Set<WritingPace>(['slow', 'medium', 'fast']);

function trimStr(value: unknown): string {
  return String(value ?? '').trim();
}

/** 功能注释：未选故事线不可提交；已选可提交。 */
export function canSubmitGameStart(config: Partial<GameStartConfig> | null | undefined): boolean {
  const routeId = trimStr(config?.openingRouteId);
  const name = trimStr(config?.player?.name);
  return Boolean(routeId) && Boolean(name);
}

/** 功能注释：完整校验开局包。 */
export function validateGameStartConfig(input: Partial<GameStartConfig> | null | undefined): {
  ok: boolean;
  message?: string;
  data?: GameStartConfig;
} {
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
    return { ok: false, message: '请选择故事线后再开始冒险' };
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

  const personaBlocks = input?.player?.personaBlocks
    ? {
        identity: trimStr(input.player.personaBlocks.identity) || undefined,
        traits: trimStr(input.player.personaBlocks.traits) || undefined,
        background: trimStr(input.player.personaBlocks.background) || undefined,
        goal: trimStr(input.player.personaBlocks.goal) || undefined,
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
