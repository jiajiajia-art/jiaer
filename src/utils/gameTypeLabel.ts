import i18n from 'i18next';
import type { UserGameData } from '../api/home/getGameData.type';

/** 玩法展示名 i18n key；引擎码仍为 TXT / AVG / CUSTOM 等，不入库改写 */
export const GAME_TYPE_LABEL_KEYS = {
    aiWenyou: 'gameType.labels.aiWenyou',
    tavern: 'gameType.labels.tavern',
    custom: 'gameType.labels.custom',
    visualNovel: 'gameType.labels.visualNovel',
    ivg: 'gameType.labels.ivg',
    story: 'gameType.labels.story',
} as const;

type GameTypeLabelId = keyof typeof GAME_TYPE_LABEL_KEYS;

/**
 * 功能注释：i18n 未初始化时（Node 单测）回落简体，须与 locales 里 gameType.labels 保持一致。
 */
const FALLBACK_LABELS_ZH: Record<string, string> = {
    [GAME_TYPE_LABEL_KEYS.aiWenyou]: 'AI文游',
    [GAME_TYPE_LABEL_KEYS.tavern]: '酒馆卡',
    [GAME_TYPE_LABEL_KEYS.custom]: '自定义',
    [GAME_TYPE_LABEL_KEYS.visualNovel]: '视觉小说',
    [GAME_TYPE_LABEL_KEYS.ivg]: '互动影游',
    [GAME_TYPE_LABEL_KEYS.story]: 'Story',
};

const translateLabel = (key: string): string => {
    if (i18n.isInitialized) {
        const translated = i18n.t(key);
        if (translated && translated !== key) {
            return translated;
        }
    }
    return FALLBACK_LABELS_ZH[key] || key;
};

/** 当前语言下的展示名（角标等优先走 getGameTypeLabel） */
export const AI_WENYOU_LABEL = () => translateLabel(GAME_TYPE_LABEL_KEYS.aiWenyou);
export const TAVERN_CARD_LABEL = () => translateLabel(GAME_TYPE_LABEL_KEYS.tavern);
export const CUSTOM_LABEL = () => translateLabel(GAME_TYPE_LABEL_KEYS.custom);
export const VISUAL_NOVEL_LABEL = () => translateLabel(GAME_TYPE_LABEL_KEYS.visualNovel);
export const INTERACTIVE_VIDEO_LABEL = () => translateLabel(GAME_TYPE_LABEL_KEYS.ivg);

/** 封面角标分色 key，供 CSS 模块映射 */
export type GameTypeTone =
    | 'aiWenyou'
    | 'tavern'
    | 'custom'
    | 'visualNovel'
    | 'ivg'
    | 'default';

/** 引擎码 / 历史别名 → i18n key（语言无关） */
const TYPE_LABEL_KEYS: Record<string, string> = {
    TXT: GAME_TYPE_LABEL_KEYS.aiWenyou,
    AVG: GAME_TYPE_LABEL_KEYS.tavern,
    RPG: GAME_TYPE_LABEL_KEYS.story,
    CUSTOM: GAME_TYPE_LABEL_KEYS.custom,
    IVG: GAME_TYPE_LABEL_KEYS.ivg,
    NOVEL: GAME_TYPE_LABEL_KEYS.visualNovel,
    ST: GAME_TYPE_LABEL_KEYS.tavern,
    'ROLE-PLAYING': GAME_TYPE_LABEL_KEYS.aiWenyou,
    WORLD: GAME_TYPE_LABEL_KEYS.tavern,
    STORY: GAME_TYPE_LABEL_KEYS.story,
    '文字互动': GAME_TYPE_LABEL_KEYS.aiWenyou,
    '角色扮演': GAME_TYPE_LABEL_KEYS.aiWenyou,
    '世界互动': GAME_TYPE_LABEL_KEYS.tavern,
    '剧情推理': GAME_TYPE_LABEL_KEYS.story,
    '自定义': GAME_TYPE_LABEL_KEYS.custom,
    '小说': GAME_TYPE_LABEL_KEYS.visualNovel,
    '视觉小说': GAME_TYPE_LABEL_KEYS.visualNovel,
    '互动影游': GAME_TYPE_LABEL_KEYS.ivg,
};

/** 功能注释：入库引擎码（非题材名）；列表正文 pill 过滤它们，避免与封面「自定义/AI文游」角标重复。 */
const ENGINE_STORAGE_CODES = new Set([
    'CUSTOM',
    'TXT',
    'AVG',
    'RPG',
    'IVG',
    'NOVEL',
    'ST',
]);

export const isGameEngineStorageTag = (raw: string): boolean => {
    const name = String(raw || '').trim();
    if (!name) return false;
    return ENGINE_STORAGE_CODES.has(name.toUpperCase());
};

const TONE_BY_NORMALIZED: Record<string, GameTypeTone> = {
    TXT: 'aiWenyou',
    'ROLE-PLAYING': 'aiWenyou',
    '文字互动': 'aiWenyou',
    '角色扮演': 'aiWenyou',
    AVG: 'tavern',
    WORLD: 'tavern',
    ST: 'tavern',
    '世界互动': 'tavern',
    CUSTOM: 'custom',
    '自定义': 'custom',
    NOVEL: 'visualNovel',
    '小说': 'visualNovel',
    '视觉小说': 'visualNovel',
    IVG: 'ivg',
    '互动影游': 'ivg',
};

const normalizeRawGameType = (value?: string | null): string => {
    if (!value) return '';

    return String(value)
        .trim()
        .replace(/^\[\s*/, '')
        .replace(/\s*\]$/, '')
        .split(',')[0]
        .replace(/^["']|["']$/g, '')
        .trim();
};

const resolveTypeLabelKey = (normalizedValue: string): string | null => {
    const upper = normalizedValue.toUpperCase();
    return TYPE_LABEL_KEYS[upper] || TYPE_LABEL_KEYS[normalizedValue] || null;
};

export const getGameTypeLabel = (gameTags?: string | null, engine?: string | null): string => {
    const normalizedValue = normalizeRawGameType(gameTags || engine);
    if (!normalizedValue) return '';

    const labelKey = resolveTypeLabelKey(normalizedValue);
    if (labelKey) {
        return translateLabel(labelKey);
    }

    return normalizedValue;
};

export const getGameTypeLabelFromMeta = (
    meta: Pick<UserGameData, 'game_tags' | 'engine'>,
): string => getGameTypeLabel(meta.game_tags, meta.engine);

/** 根据引擎/标记解析封面角标色调，保证同类玩法共用一色 */
export const getGameTypeTone = (gameTags?: string | null, engine?: string | null): GameTypeTone => {
    const normalizedValue = normalizeRawGameType(gameTags || engine);
    if (!normalizedValue) return 'default';

    const upper = normalizedValue.toUpperCase();
    return TONE_BY_NORMALIZED[upper] || TONE_BY_NORMALIZED[normalizedValue] || 'default';
};

export const getGameTypeToneFromMeta = (
    meta: Pick<UserGameData, 'game_tags' | 'engine'>,
): GameTypeTone => getGameTypeTone(meta.game_tags, meta.engine);

export type { GameTypeLabelId };
