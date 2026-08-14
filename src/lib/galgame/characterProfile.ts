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
  /** 真实互动/面板改过好感后为 true；未触达时可用关系重算初始分 */
  favorabilityTouched?: boolean;
  personalityTags?: string[];
  /** 局内头像（AI 生成或预设立绘 URL） */
  avatarUrl?: string;
  /** 150×150 webp 小图，气泡/列表优先 */
  avatarThumbUrl?: string;
  /**
   * 玩家在局内人设表单亲手改过性别。
   * A/B preferPresetGender：未置 true 时展示/合并跟创作台预设。
   */
  genderManuallySet?: boolean;
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

/** 功能注释：比对用归一化（去空白），判断详细简介是否复述简介。 */
export function normalizePersonaCompareText(value: unknown): string {
  return trimStr(value).replace(/\s+/g, '').toLowerCase();
}

/**
 * 功能注释：详细简介是否实质复述简介（相等、或长短互为前缀且高度重合）。
 */
export function isDuplicateDetailedBio(
  summary?: string | null,
  detailedBio?: string | null,
): boolean {
  const s = trimStr(summary);
  const d = trimStr(detailedBio);
  if (!s || !d) return false;
  const ns = normalizePersonaCompareText(s);
  const nd = normalizePersonaCompareText(d);
  if (!ns || !nd) return false;
  if (ns === nd) return true;
  if (nd.startsWith(ns) || ns.startsWith(nd)) {
    const shorter = Math.min(ns.length, nd.length);
    const longer = Math.max(ns.length, nd.length);
    if (shorter >= 20 && shorter / longer >= 0.85) return true;
  }
  return false;
}

/** 功能注释：仅返回与简介不重复的详细简介；重复则空串。 */
export function resolveDistinctDetailedBio(
  summary?: string | null,
  detailedBio?: string | null,
): string {
  const d = trimStr(detailedBio);
  if (!d) return '';
  if (isDuplicateDetailedBio(summary, d)) return '';
  return d;
}

/** 功能注释：占位「暂无简介」等视为空，避免挡住文档字段回填。 */
export function isBlankPersonaText(value: unknown): boolean {
  const s = trimStr(value);
  if (!s) return true;
  return /^(暂无简介|暂无人物介绍|暂无|无简介|未知|n\/a|none|-|—|－|\.{1,3}|…)$/i.test(s);
}

/**
 * 功能注释：从文档 NPC 多字段拼人设简介。
 * description 优先；缺失时用 background / 职业 / 外貌 / 性格 / 语气，避免主要角色落成「暂无简介」。
 */
export function composeNpcPersonaSummary(npc: {
  description?: string;
  background?: string;
  appearance?: string;
  personality?: string;
  tone?: string;
  job?: string;
  relationship?: string;
} | null | undefined): string {
  if (!npc) return '';
  const description = trimStr(npc.description);
  if (!isBlankPersonaText(description)) return description;

  const background = trimStr(npc.background);
  if (!isBlankPersonaText(background)) return background;

  const chunks: string[] = [];
  const job = trimStr(npc.job || npc.relationship);
  const appearance = trimStr(npc.appearance);
  const personality = trimStr(npc.personality);
  const tone = trimStr(npc.tone);

  if (!isBlankPersonaText(job)) chunks.push(job);
  if (!isBlankPersonaText(appearance)) chunks.push(appearance);
  if (!isBlankPersonaText(personality)) {
    chunks.push(personality.startsWith('性格') ? personality : `性格：${personality}`);
  }
  if (!isBlankPersonaText(tone)) {
    chunks.push(tone.startsWith('语气') || tone.startsWith('说话') ? tone : `语气：${tone}`);
  }

  return chunks
    .join('。')
    .replace(/。{2,}/g, '。')
    .replace(/^。+|。+$/g, '')
    .trim();
}

/** 创作台/文档性别常为「男」「女」；归一到局内枚举，避免落成「未知」。 */
export function normalizeNpcGender(
  raw: unknown,
  fallback: NpcGender = 'female',
): NpcGender {
  const g = trimStr(raw).toLowerCase();
  if (g === 'male' || g === 'm' || g === '男') return 'male';
  if (g === 'female' || g === 'f' || g === '女') return 'female';
  if (g === 'other' || g === '其他') return 'other';
  if (g === 'unknown' || g === '未知') {
    return fallback === 'unknown' ? 'unknown' : fallback;
  }
  return NPC_GENDERS.includes(fallback) ? fallback : 'female';
}

function clampLen(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max);
}

/** 功能注释：同关系档内按 id 稳定微扰，避免全员同分。 */
function stableFavorJitter(base: number, npcId = ''): number {
  const id = String(npcId || '');
  let h = 0;
  for (let i = 0; i < id.length; i += 1) {
    h = ((h << 5) - h) + id.charCodeAt(i);
    h |= 0;
  }
  const delta = (Math.abs(h) % 9) - 4;
  return Math.min(
    CHARACTER_PROFILE_LIMITS.favorability.max,
    Math.max(CHARACTER_PROFILE_LIMITS.favorability.min, Math.round(base + delta)),
  );
}

/**
 * 功能注释：按关系/态度亲疏推断初始好感（与后端 npcFavorability 对齐）。
 */
export function inferInitialFavorabilityFromRelation(
  profileOrSeed: {
    id?: string;
    relationship?: string;
    job?: string;
    identity?: string;
    attitudeToPlayer?: string;
    personality?: string;
    summary?: string;
    description?: string;
    detailedBio?: string;
  } | null | undefined = {},
  npcId = '',
): number {
  const relationship = trimStr(
    profileOrSeed?.relationship || profileOrSeed?.job || profileOrSeed?.identity,
  );
  const attitude = trimStr(profileOrSeed?.attitudeToPlayer || profileOrSeed?.personality);
  const summary = trimStr(
    profileOrSeed?.summary || profileOrSeed?.description || profileOrSeed?.detailedBio,
  );
  const text = `${relationship} ${attitude} ${summary}`;
  const id = trimStr(npcId) || trimStr(profileOrSeed?.id);

  let base = 28;
  if (/恋人|情侣|爱人|夫妻|未婚夫|未婚妻|男朋友|女朋友|老公|老婆|丈夫|妻子|白月光|竹马|青梅/.test(text)) {
    base = 72;
  } else if (/挚友|闺蜜|死党|发小|家人|母亲|妈妈|父亲|爸爸|哥哥|姐姐|弟弟|妹妹|兄妹|姐弟|亲属/.test(text)) {
    base = 58;
  } else if (/朋友|好友|同学|同事|队友|室友|搭档|搭子|伙伴|男嘉宾|女嘉宾|嘉宾之一/.test(text)) {
    base = 42;
  } else if (/熟人|邻居|同僚|上司|下属|客户|常客|粉丝|观众/.test(text)) {
    base = 34;
  } else if (/对手|竞争|对头|冤家|情敌/.test(text)) {
    base = 16;
  } else if (/仇敌|死敌|死对头|敌人|宿敌|仇人/.test(text)) {
    base = 8;
  } else if (/陌生人|路人|过客|客人|店员|老板|未知|路人甲/.test(text)) {
    base = 18;
  }

  if (/冷淡|防备|戒备|厌恶|讨厌|敌意|疏离|不屑|提防/.test(text)) base -= 12;
  if (/温柔|热情|喜欢|关心|信赖|亲近|治愈|亲和|友善|体贴/.test(text)) base += 10;
  if (/占有|暧昧|心动|倾心|迷恋|宠溺/.test(text)) base += 12;

  return stableFavorJitter(base, id);
}

export function isLegacyUniformFavorability(profile: {
  favorability?: number | null;
  favorabilityTouched?: boolean;
} | null | undefined): boolean {
  if (!profile || profile.favorabilityTouched) return false;
  if (profile.favorability == null || profile.favorability === ('' as unknown)) return true;
  const n = Number(profile.favorability);
  if (!Number.isFinite(n)) return true;
  return n >= 18 && n <= 22;
}

/** 功能注释：角色卡展示用好感；旧统一底分按关系重算。 */
export function resolveNpcFavorabilityForDisplay(
  profile: PlayerEditableNpc | null | undefined,
  npcId = '',
): number {
  if (
    profile?.favorability != null
    && profile.favorability !== ('' as unknown)
    && !isLegacyUniformFavorability(profile)
  ) {
    return Math.min(
      CHARACTER_PROFILE_LIMITS.favorability.max,
      Math.max(CHARACTER_PROFILE_LIMITS.favorability.min, Math.round(Number(profile.favorability))),
    );
  }
  return inferInitialFavorabilityFromRelation(profile || {}, npcId || profile?.id);
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
  const detailedBioRaw = trimStr(input?.detailedBio);
  const detailedBio = resolveDistinctDetailedBio(summary, detailedBioRaw);
  const gender = String(input?.gender || '').trim() as NpcGender;

  if (!name) return { ok: false, message: '请填写姓名' };
  if (name.length > CHARACTER_PROFILE_LIMITS.name.max) {
    return { ok: false, message: `姓名不能超过${CHARACTER_PROFILE_LIMITS.name.max}字` };
  }
  if (!NPC_GENDERS.includes(gender) || gender === 'unknown') {
    return { ok: false, message: '请选择性别（男/女）' };
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
      ...(input?.genderManuallySet === true ? { genderManuallySet: true } : {}),
      ...(input?.genderManuallySet === false ? { genderManuallySet: false } : {}),
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
      // 自建角色无创作台预设，性别以表单为准
      genderManuallySet: true,
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
      genderManuallySet:
        typeof patch.genderManuallySet === 'boolean'
          ? patch.genderManuallySet
          : existing.genderManuallySet === true,
    },
  };
}

/**
 * A/B：未手改性别时跟创作台预设；已手改或对照组则优先局内 gender。
 */
export function resolveEditableNpcGender(opts: {
  preferPresetGender?: boolean;
  presetGender?: string | null;
  localGender?: string | null;
  genderManuallySet?: boolean;
  fallback?: NpcGender;
}): NpcGender {
  const fallback = opts.fallback && NPC_GENDERS.includes(opts.fallback) ? opts.fallback : 'female';
  const hasLocal = opts.localGender != null && String(opts.localGender).trim() !== '';
  const local = hasLocal ? normalizeNpcGender(opts.localGender, fallback) : null;
  const hasPreset = opts.presetGender != null && String(opts.presetGender).trim() !== '';
  const preset = hasPreset ? normalizeNpcGender(opts.presetGender, fallback) : null;

  if (opts.preferPresetGender && !opts.genderManuallySet && preset) {
    return preset;
  }
  return local || preset || fallback;
}

/** 功能注释：预设 NPC → 可编辑档案默认值。 */
export function npcLikeToEditableProfile(
  npc: {
    id?: string;
    name?: string;
    gender?: string;
    job?: string;
    description?: string;
    background?: string;
    appearance?: string;
    personality?: string;
    tone?: string;
    relationship?: string;
    images?: { base?: string } | string | null;
    imagePath?: string;
    avatarUrl?: string;
  },
  opts: { encountered?: boolean } = {},
): PlayerEditableNpc | null {
  const id = String(npc?.id || '').trim();
  if (!id) return null;
  const gender = normalizeNpcGender(npc?.gender, 'female');
  let avatarUrl = trimStr(npc.avatarUrl);
  if (!avatarUrl && typeof npc.images === 'string') avatarUrl = trimStr(npc.images);
  if (!avatarUrl && npc.images && typeof npc.images === 'object') {
    avatarUrl = trimStr(npc.images.base);
  }
  if (!avatarUrl) avatarUrl = trimStr(npc.imagePath);
  const relationshipRaw = trimStr(npc.job) || trimStr(npc.relationship);
  const summaryRaw = composeNpcPersonaSummary(npc);
  const attitudeRaw = trimStr(npc.personality);
  const relationship = clampLen(
    isBlankPersonaText(relationshipRaw) ? '' : relationshipRaw,
    CHARACTER_PROFILE_LIMITS.relationship.max,
  );
  const summary = clampLen(summaryRaw, CHARACTER_PROFILE_LIMITS.summary.max);
  const attitudeToPlayer = clampLen(
    isBlankPersonaText(attitudeRaw) ? '' : attitudeRaw,
    CHARACTER_PROFILE_LIMITS.attitudeToPlayer.max,
  );
  return {
    id,
    name: trimStr(npc.name) || id,
    gender,
    relationship,
    // 禁止写入「暂无简介」占位；有外貌/性格等则拼出人设
    summary,
    attitudeToPlayer,
    favorability: inferInitialFavorabilityFromRelation({
      id,
      relationship,
      attitudeToPlayer,
      summary,
      personality: attitudeRaw,
    }, id),
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
