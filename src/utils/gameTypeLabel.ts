import type { UserGameData } from '../api/home/getGameData.type';

const TYPE_LABELS: Record<string, string> = {
    TXT: 'Role-Playing',
    AVG: 'World',
    RPG: 'Story',
    CUSTOM: 'Custom',
    'ROLE-PLAYING': 'Role-Playing',
    WORLD: 'World',
    STORY: 'Story',
    '\u6587\u5B57\u4E92\u52A8': 'Role-Playing',
    '\u4E16\u754C\u4E92\u52A8': 'World',
    '\u5267\u60C5\u5192\u9669': 'Story',
    '\u81EA\u5B9A\u4E49': 'Custom',
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
