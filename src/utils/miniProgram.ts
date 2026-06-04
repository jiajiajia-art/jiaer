type MiniProgramWindow = Window & {
    __wxjs_environment?: string;
};

export type CreatorGameType = 'rpg' | 'txt' | 'avg' | 'custom' | 'st';
export type CreatorEngine = 'RPG' | 'TXT' | 'AVG' | 'CUSTOM' | 'ST' | 'IVG';

export const MINI_PROGRAM_CREATOR_PC_URL = 'https://funloom.kurangames.com/funloom/home';

const CREATOR_ENGINE_LABELS: Record<CreatorEngine, string> = {
    RPG: 'RPG',
    TXT: 'TXT',
    AVG: 'AVG',
    CUSTOM: '自定义',
    ST: '自由',
    IVG: '互动影游',
};

const CREATOR_TYPE_TO_ENGINE: Record<CreatorGameType, CreatorEngine> = {
    rpg: 'RPG',
    txt: 'TXT',
    avg: 'AVG',
    custom: 'CUSTOM',
    st: 'ST',
};

// 统一识别微信小程序环境，避免各页面出现不同的平台判断逻辑。
export const isMiniProgramEnv = (): boolean => {
    if (typeof window === 'undefined') {
        return false;
    }

    const win = window as MiniProgramWindow;
    return String(win.__wxjs_environment || '').toLowerCase() === 'miniprogram';
};

export const isCreatorRoutePath = (pathname: string): boolean => {
    return (
        pathname.startsWith('/create') ||
        pathname.startsWith('/createGame') ||
        pathname.startsWith('/gameSettingsEditor')
    );
};

export const toCreatorEngine = (value?: string | null): CreatorEngine | null => {
    if (!value) {
        return null;
    }

    const normalizedValue = value.trim().toUpperCase();
    if (normalizedValue in CREATOR_ENGINE_LABELS) {
        return normalizedValue as CreatorEngine;
    }

    const matchedEntry = Object.entries(CREATOR_TYPE_TO_ENGINE).find(([type]) => type.toUpperCase() === normalizedValue);
    return matchedEntry ? matchedEntry[1] : null;
};

export const resolveCreatorEngine = (engine?: string | null, gameTag?: string | null): CreatorEngine | null => {
    return toCreatorEngine(engine) ?? toCreatorEngine(gameTag);
};

export const isMiniProgramCreatorEngineSupported = (engine?: string | null): boolean => {
    return toCreatorEngine(engine) === 'TXT';
};

export const isMiniProgramCreatorTypeSupported = (type: CreatorGameType): boolean => {
    return CREATOR_TYPE_TO_ENGINE[type] === 'TXT';
};

export const getCreatorEngineLabel = (engine?: string | null): string => {
    const normalizedEngine = toCreatorEngine(engine);
    return normalizedEngine ? CREATOR_ENGINE_LABELS[normalizedEngine] : '当前模式';
};

// 小程序端仅开放 TXT 创作，其余模式统一引导至 PC 端操作。
export const getMiniProgramCreatorBlockedMessage = (engineOrType?: string | null): string => {
    const label = getCreatorEngineLabel(engineOrType);
    return `小程序端当前仅支持 TXT 模式创作，${label} 请前往 PC 端操作。PC 端地址：${MINI_PROGRAM_CREATOR_PC_URL}，请在电脑浏览器打开。`;
};
