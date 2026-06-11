import type { UserGameData } from '../api/home/getGameData.type';

const TYPE_LABELS: Record<string, string> = {
    TXT: 'Role-Playing',
    AVG: 'World',
    RPG: 'Story',
    CUSTOM: 'Custom',
    IVG: '\u4E92\u52A8\u5F71\u6E38',
    'ROLE-PLAYING': 'Role-Playing',
    WORLD: 'World',
    STORY: 'Story',
    '文字互动': 'Role-Playing',
    '世界互动': 'World',
    '剧情推理': 'Story',
    '自定义': 'Custom',
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
