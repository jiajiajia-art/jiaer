/**
 * 账号级玩家角色卡：校验、导入覆盖合并（云端卡 → 本局玩家档案）。
 */

export const PLAYER_CARD_GENDERS = Object.freeze(['male', 'female', 'other'] as const);
export type PlayerCardGender = (typeof PLAYER_CARD_GENDERS)[number];

export const PLAYER_CARD_KINDS = Object.freeze(['player', 'npc'] as const);
export type PlayerCardKind = (typeof PLAYER_CARD_KINDS)[number];

export type PlayerCharacterCard = {
  id: string;
  userId: string;
  name: string;
  gender: PlayerCardGender;
  persona: string;
  attributes: Record<string, number>;
  cardKind?: PlayerCardKind;
  isDefault?: boolean;
  isPublic?: boolean;
  tags?: string[];
  avatarUrl?: string;
  authorName?: string;
  sourceCardId?: string | null;
  createdAt: string;
  updatedAt: string;
};

/** 本局玩家档案（自设层，与 LLM 动态属性分区） */
export type SessionPlayerProfile = {
  name: string;
  gender: PlayerCardGender;
  persona: string;
  /** 自设属性层 */
  customAttributes: Record<string, number>;
  importedCardId?: string | null;
  /** 当前主角头像（原图） */
  avatarUrl?: string;
  /** 150×150 webp 头部小图（原图顶部约 30%），聊天/列表/档案优先 */
  avatarThumbUrl?: string;
  /** 实验组：换角后需重新 AI 生成头像 */
  avatarNeedsRegen?: boolean;
};

export const PLAYER_CARD_LIMITS = Object.freeze({
  name: { min: 1, max: 40 },
  persona: { min: 0, max: 2000 },
  attributeValue: { min: 0, max: 100 },
  attributeKeyMax: 20,
  attributeCountMax: 20,
});

function trimStr(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeAttributes(raw: unknown): { ok: true; value: Record<string, number> } | { ok: false; error: string } {
  if (raw == null) return { ok: true, value: {} };
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: '属性格式无效' };
  }
  const out: Record<string, number> = {};
  const entries = Object.entries(raw as Record<string, unknown>);
  if (entries.length > PLAYER_CARD_LIMITS.attributeCountMax) {
    return { ok: false, error: `属性项不能超过${PLAYER_CARD_LIMITS.attributeCountMax}个` };
  }
  for (const [k, v] of entries) {
    const key = trimStr(k);
    if (!key) return { ok: false, error: '属性名不能为空' };
    if (key.length > PLAYER_CARD_LIMITS.attributeKeyMax) {
      return { ok: false, error: `属性名不能超过${PLAYER_CARD_LIMITS.attributeKeyMax}字` };
    }
    const n = Number(v);
    if (!Number.isFinite(n)) return { ok: false, error: `属性「${key}」必须是数字` };
    out[key] = Math.min(
      PLAYER_CARD_LIMITS.attributeValue.max,
      Math.max(PLAYER_CARD_LIMITS.attributeValue.min, Math.round(n)),
    );
  }
  return { ok: true, value: out };
}

/** 功能注释：新建/更新卡字段校验。 */
export function validatePlayerCharacterCardInput(input: Partial<PlayerCharacterCard> | null | undefined):
  | {
    ok: true;
    data: { name: string; gender: PlayerCardGender; persona: string; attributes: Record<string, number> };
  }
  | { ok: false; message: string } {
  const name = trimStr(input?.name);
  const persona = trimStr(input?.persona);
  const gender = String(input?.gender || '').trim() as PlayerCardGender;

  if (!name) return { ok: false, message: '请填写姓名' };
  if (name.length > PLAYER_CARD_LIMITS.name.max) {
    return { ok: false, message: `姓名不能超过${PLAYER_CARD_LIMITS.name.max}字` };
  }
  if (!PLAYER_CARD_GENDERS.includes(gender)) {
    return { ok: false, message: '请选择有效性别' };
  }
  if (persona.length > PLAYER_CARD_LIMITS.persona.max) {
    return { ok: false, message: `人设不能超过${PLAYER_CARD_LIMITS.persona.max}字` };
  }
  const attrs = normalizeAttributes(input?.attributes);
  if (!attrs.ok) {
    return { ok: false, message: String(attrs.error) };
  }

  return { ok: true, data: { name, gender, persona, attributes: attrs.value } };
}

/**
 * 功能注释：用账号卡覆盖本局玩家档案（整卡替换自设层，不合并旧人设）。
 * 空卡 / 缺字段 → 失败。
 */
export function applyPlayerCardImport(
  card: Partial<PlayerCharacterCard> | null | undefined,
  opts: { currentUserId?: string } = {},
): { ok: true; profile: SessionPlayerProfile } | { ok: false; message: string; code?: string } {
  if (!card || typeof card !== 'object') {
    return { ok: false, message: '角色卡不存在', code: 'empty_card' };
  }
  if (opts.currentUserId && card.userId && String(card.userId) !== String(opts.currentUserId)) {
    return { ok: false, message: '无权导入该角色卡', code: 'forbidden' };
  }
  const checked = validatePlayerCharacterCardInput(card);
  if (!checked.ok) {
    return { ok: false, message: checked.message || '角色卡无效', code: 'invalid_card' };
  }
  return {
    ok: true,
    profile: {
      name: checked.data.name,
      gender: checked.data.gender,
      persona: checked.data.persona,
      customAttributes: { ...checked.data.attributes },
      importedCardId: card.id ? String(card.id) : null,
    },
  };
}

/** 功能注释：卡库搜索（姓名/人设子串，大小写不敏感）。 */
export function filterPlayerCharacterCards(
  cards: PlayerCharacterCard[],
  query: string,
): PlayerCharacterCard[] {
  const q = trimStr(query).toLowerCase();
  if (!q) return [...(cards || [])];
  return (cards || []).filter((c) => {
    const name = String(c.name || '').toLowerCase();
    const persona = String(c.persona || '').toLowerCase();
    return name.includes(q) || persona.includes(q);
  });
}

/** 功能注释：导入预览——标出将变化的属性（UE 绿色对比用）。 */
export function previewPlayerCardImportDiff(
  current: SessionPlayerProfile | null | undefined,
  card: Partial<PlayerCharacterCard>,
): {
  ok: boolean;
  message?: string;
  changedKeys: string[];
  next?: SessionPlayerProfile;
} {
  const applied = applyPlayerCardImport(card);
  if (!applied.ok) return { ok: false, message: applied.message, changedKeys: [] };
  const next = applied.profile;
  const changedKeys: string[] = [];
  if (!current || current.name !== next.name) changedKeys.push('name');
  if (!current || current.gender !== next.gender) changedKeys.push('gender');
  if (!current || current.persona !== next.persona) changedKeys.push('persona');
  const curAttrs = current?.customAttributes || {};
  const allKeys = new Set([...Object.keys(curAttrs), ...Object.keys(next.customAttributes)]);
  for (const k of allKeys) {
    if (Number(curAttrs[k] ?? NaN) !== Number(next.customAttributes[k] ?? NaN)) {
      changedKeys.push(`attr:${k}`);
    }
  }
  return { ok: true, changedKeys, next };
}
