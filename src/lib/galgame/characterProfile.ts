/**
 * 局内可编辑 NPC 档案：校验、规范化、与出场列表合并。
 * 字段口径对齐《TXT模式自由度改版》§4.1 / §6.1。
 */

export const NPC_GENDERS = Object.freeze(['male', 'female', 'other', 'unknown'] as const);
export type NpcGender = (typeof NPC_GENDERS)[number];

export const NPC_IMPORTANCE = Object.freeze(['major', 'minor', 'extra'] as const);
export type NpcImportance = (typeof NPC_IMPORTANCE)[number];

export const NPC_SURVIVAL = Object.freeze(['alive', 'dead', 'unknown'] as const);
export type NpcSurvival = (typeof NPC_SURVIVAL)[number];

export type PlayerEditableNpc = {
  id: string;
  name: string;
  gender: NpcGender;
  relationship: string;
  summary: string;
  attitudeToPlayer: string;
  detailedBio?: string;
  importance?: NpcImportance;
  survival?: NpcSurvival;
  favorability?: number;
  personalityTags?: string[];
  /** 局内头像（AI 生成或预设立绘 URL） */
  avatarUrl?: string;
  /** 150×150 webp 小图，气泡/列表优先 */
  avatarThumbUrl?: string;
  source: 'preset' | 'player_created';
  encountered: boolean;
};

export const CHARACTER_PROFILE_LIMITS = Object.freeze({
  name: { min: 1, max: 40 },
  relationship: { min: 1, max: 20 },
  summary: { min: 1, max: 200 },
  attitudeToPlayer: { min: 1, max: 100 },
  detailedBio: { min: 0, max: 500 },
  favorability: { min: 0, max: 100 },
});

function trimStr(value: unknown): string {
  return String(value ?? '').trim();
}

function clampLen(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max);
}

/** 功能注释：校验必填与字数；返回中文 message 便于 Toast。 */
export function validateCharacterProfileInput(input: Partial<PlayerEditableNpc> | null | undefined): {
  ok: boolean;
  message?: string;
  data?: Omit<PlayerEditableNpc, 'id' | 'source' | 'encountered'>;
} {
  const name = trimStr(input?.name);
  const relationship = trimStr(input?.relationship);
  const summary = trimStr(input?.summary);
  const attitudeToPlayer = trimStr(input?.attitudeToPlayer);
  const detailedBio = trimStr(input?.detailedBio);
  const gender = String(input?.gender || '').trim() as NpcGender;

  if (!name) return { ok: false, message: '请填写姓名' };
  if (name.length > CHARACTER_PROFILE_LIMITS.name.max) {
    return { ok: false, message: `姓名不能超过${CHARACTER_PROFILE_LIMITS.name.max}字` };
  }
  if (!NPC_GENDERS.includes(gender)) {
    return { ok: false, message: '请选择有效性别' };
  }
  if (!relationship) return { ok: false, message: '请填写关系' };
  if (relationship.length > CHARACTER_PROFILE_LIMITS.relationship.max) {
    return { ok: false, message: `关系不能超过${CHARACTER_PROFILE_LIMITS.relationship.max}字` };
  }
  if (!summary) return { ok: false, message: '请填写简介' };
  if (summary.length > CHARACTER_PROFILE_LIMITS.summary.max) {
    return { ok: false, message: `简介不能超过${CHARACTER_PROFILE_LIMITS.summary.max}字` };
  }
  if (!attitudeToPlayer) return { ok: false, message: '请填写对你的态度' };
  if (attitudeToPlayer.length > CHARACTER_PROFILE_LIMITS.attitudeToPlayer.max) {
    return { ok: false, message: `态度不能超过${CHARACTER_PROFILE_LIMITS.attitudeToPlayer.max}字` };
  }
  if (detailedBio.length > CHARACTER_PROFILE_LIMITS.detailedBio.max) {
    return { ok: false, message: `详细简介不能超过${CHARACTER_PROFILE_LIMITS.detailedBio.max}字` };
  }

  let importance: NpcImportance | undefined;
  if (input?.importance != null && String(input.importance).trim() !== '') {
    const raw = String(input.importance).trim() as NpcImportance;
    if (!NPC_IMPORTANCE.includes(raw)) {
      return { ok: false, message: '重要程度无效' };
    }
    importance = raw;
  }

  let survival: NpcSurvival | undefined;
  if (input?.survival != null && String(input.survival).trim() !== '') {
    const raw = String(input.survival).trim() as NpcSurvival;
    if (!NPC_SURVIVAL.includes(raw)) {
      return { ok: false, message: '存活状态无效' };
    }
    survival = raw;
  }

  let favorability: number | undefined;
  if (input?.favorability != null && input.favorability !== ('' as unknown)) {
    const n = Number(input.favorability);
    if (!Number.isFinite(n)) return { ok: false, message: '好感度必须是数字' };
    favorability = Math.min(
      CHARACTER_PROFILE_LIMITS.favorability.max,
      Math.max(CHARACTER_PROFILE_LIMITS.favorability.min, Math.round(n)),
    );
  }

  const tags = Array.isArray(input?.personalityTags)
    ? input!.personalityTags!.map((t) => trimStr(t)).filter(Boolean).slice(0, 20)
    : undefined;

  const avatarUrl = trimStr(input?.avatarUrl) || undefined;
  const avatarThumbUrl = trimStr(input?.avatarThumbUrl) || undefined;

  return {
    ok: true,
    data: {
      name,
      gender,
      relationship: clampLen(relationship, CHARACTER_PROFILE_LIMITS.relationship.max),
      summary: clampLen(summary, CHARACTER_PROFILE_LIMITS.summary.max),
      attitudeToPlayer: clampLen(attitudeToPlayer, CHARACTER_PROFILE_LIMITS.attitudeToPlayer.max),
      detailedBio: detailedBio
        ? clampLen(detailedBio, CHARACTER_PROFILE_LIMITS.detailedBio.max)
        : undefined,
      importance,
      survival,
      favorability,
      personalityTags: tags?.length ? tags : undefined,
      avatarUrl,
      avatarThumbUrl,
    },
  };
}

/** 功能注释：新建玩家自建 NPC（未出场），生成稳定 id。 */
export function createPlayerNpcProfile(
  input: Partial<PlayerEditableNpc>,
  opts: { id?: string; nowIso?: string } = {},
): { ok: true; profile: PlayerEditableNpc } | { ok: false; message: string } {
  const checked = validateCharacterProfileInput(input);
  if (!checked.ok || !checked.data) {
    return { ok: false, message: checked.message || '表单无效' };
  }
  const id = String(opts.id || `pc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`);
  return {
    ok: true,
    profile: {
      id,
      ...checked.data,
      source: 'player_created',
      encountered: false,
    },
  };
}

/** 功能注释：把校验后的字段合并进已有档案（保留 id/source/encountered，除非显式覆盖）。 */
export function mergeCharacterProfilePatch(
  existing: PlayerEditableNpc,
  patch: Partial<PlayerEditableNpc>,
): { ok: true; profile: PlayerEditableNpc } | { ok: false; message: string } {
  const checked = validateCharacterProfileInput({ ...existing, ...patch });
  if (!checked.ok || !checked.data) {
    return { ok: false, message: checked.message || '表单无效' };
  }
  return {
    ok: true,
    profile: {
      ...existing,
      ...checked.data,
      id: existing.id,
      source: existing.source,
      encountered:
        typeof patch.encountered === 'boolean' ? patch.encountered : existing.encountered,
    },
  };
}

/** 功能注释：预设 NPC → 可编辑档案默认值。 */
export function npcLikeToEditableProfile(
  npc: {
    id?: string;
    name?: string;
    gender?: string;
    job?: string;
    description?: string;
    personality?: string;
    images?: { base?: string } | string | null;
    imagePath?: string;
    avatarUrl?: string;
  },
  opts: { encountered?: boolean } = {},
): PlayerEditableNpc | null {
  const id = String(npc?.id || '').trim();
  if (!id) return null;
  const genderRaw = String(npc?.gender || 'unknown').toLowerCase();
  const gender = (NPC_GENDERS.includes(genderRaw as NpcGender)
    ? genderRaw
    : 'unknown') as NpcGender;
  let avatarUrl = trimStr(npc.avatarUrl);
  if (!avatarUrl && typeof npc.images === 'string') avatarUrl = trimStr(npc.images);
  if (!avatarUrl && npc.images && typeof npc.images === 'object') {
    avatarUrl = trimStr(npc.images.base);
  }
  if (!avatarUrl) avatarUrl = trimStr(npc.imagePath);
  return {
    id,
    name: trimStr(npc.name) || id,
    gender,
    relationship: clampLen(trimStr(npc.job) || '未知', CHARACTER_PROFILE_LIMITS.relationship.max),
    summary: clampLen(trimStr(npc.description) || '暂无简介', CHARACTER_PROFILE_LIMITS.summary.max),
    attitudeToPlayer: clampLen(
      trimStr(npc.personality) || '未知',
      CHARACTER_PROFILE_LIMITS.attitudeToPlayer.max,
    ),
    ...(avatarUrl ? { avatarUrl } : {}),
    source: 'preset',
    encountered: opts.encountered !== false,
  };
}

/** 功能注释：从局内自建 id（pc_<base36时间>_…）取创建时间，用于新建置顶。 */
export function playerCreatedRecencyMs(id: unknown): number {
  const m = String(id || '').match(/^pc_([a-z0-9]+)_/i);
  if (!m) return 0;
  const n = Number.parseInt(m[1], 36);
  return Number.isFinite(n) ? n : 0;
}

/**
 * 功能注释：列表展示排序。
 * 自定义角色置顶（新建越新越靠前）→ 同组出场优先 → 姓名中文序。
 */
export function sortEditableNpcProfiles(list: PlayerEditableNpc[]): PlayerEditableNpc[] {
  return [...(list || [])].sort((a, b) => {
    const aCustom = a.source === 'player_created' ? 1 : 0;
    const bCustom = b.source === 'player_created' ? 1 : 0;
    if (aCustom !== bCustom) return bCustom - aCustom;

    if (aCustom) {
      const byNew = playerCreatedRecencyMs(b.id) - playerCreatedRecencyMs(a.id);
      if (byNew !== 0) return byNew;
    }

    if (a.encountered !== b.encountered) return a.encountered ? -1 : 1;
    return String(a.name).localeCompare(String(b.name), 'zh');
  });
}
