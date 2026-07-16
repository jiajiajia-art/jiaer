import type { UserGameData } from '../api/home/getGameData.type';

/** 对外展示名；引擎码仍为 TXT / AVG / CUSTOM 等，不入库改写 */
export const AI_WENYOU_LABEL = 'AI文游';
export const TAVERN_CARD_LABEL = '酒馆卡';
export const CUSTOM_LABEL = '自定义';
export const VISUAL_NOVEL_LABEL = '视觉小说';
export const INTERACTIVE_VIDEO_LABEL = '\u4E92\u52A8\u5F71\u6E38';

/** 封面角标分色 key，供 CSS 模块映射 */
export type GameTypeTone =
    | 'aiWenyou'
    | 'tavern'
    | 'custom'
    | 'visualNovel'
    | 'ivg'
    | 'default';

const TYPE_LABELS: Record<string, string> = {
    TXT: AI_WENYOU_LABEL,
    AVG: TAVERN_CARD_LABEL,
    RPG: 'Story',
    CUSTOM: CUSTOM_LABEL,
    IVG: INTERACTIVE_VIDEO_LABEL,
    NOVEL: VISUAL_NOVEL_LABEL,
    ST: TAVERN_CARD_LABEL,
    'ROLE-PLAYING': AI_WENYOU_LABEL,
    WORLD: TAVERN_CARD_LABEL,
    STORY: 'Story',
    '文字互动': AI_WENYOU_LABEL,
    '角色扮演': AI_WENYOU_LABEL,
    '世界互动': TAVERN_CARD_LABEL,
    '剧情推理': 'Story',
    '自定义': CUSTOM_LABEL,
    '小说': VISUAL_NOVEL_LABEL,
    '视觉小说': VISUAL_NOVEL_LABEL,
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

export const getGameTypeLabel = (gameTags?: string | null, engine?: string | null): string => {
    const normalizedValue = normalizeRawGameType(gameTags || engine);
    if (!normalizedValue) return '';

    return TYPE_LABELS[normalizedValue.toUpperCase()] || normalizedValue;
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
