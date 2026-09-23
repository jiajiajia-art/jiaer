type TranslateFn = (key: string) => string;

const defaultTranslations: TranslateFn = (key: string) => {
    const translations: Record<string, string> = {
        'minutes': '分钟',
        'second': '秒',
        'eta.minutes': '分钟',
        'eta.second': '秒',
        'minutesAndSeconds': '{{minutes}} 分 {{seconds}} 秒',
        'eta.minutesAndSeconds': '{{minutes}} 分 {{seconds}} 秒',
        'remaining': '预计还需',
        'takingLonger': '耗时较长，仍在处理中，请稍候',
        'generating': '正在生成第',
        'generatingMoreTime': '生成时间比平时更长，请继续等待',
        'item': '项',
        'total': '本次共生成',
        'completed': '已完成',
    };
    return translations[key] || key;
};

/** i18n 可能是 eta.second，也可能已被调用方加上 eta. 前缀；未命中再回默认中文 */
const tx = (t: TranslateFn, shortKey: string): string => {
    const direct = t(shortKey);
    if (direct && direct !== shortKey && !String(direct).startsWith('eta.')) {
        return direct;
    }
    const nestedKey = `eta.${shortKey}`;
    const nested = t(nestedKey);
    if (nested && nested !== nestedKey && !String(nested).startsWith('eta.eta.')) {
        return nested;
    }
    return defaultTranslations(shortKey);
};

export const formatEtaMinutes = (
    seconds?: number | null,
    t: TranslateFn = defaultTranslations,
): string => {
    const safeSeconds = Math.max(0, Math.ceil(Number(seconds || 0)));
    if (safeSeconds >= 60) {
        return `${Math.ceil(safeSeconds / 60)} ${tx(t, 'minutes')}`;
    }
    return `${safeSeconds} ${tx(t, 'second')}`;
};

export const formatEtaPrecise = (
    seconds?: number | null,
    t: TranslateFn = defaultTranslations,
): string => {
    const safeSeconds = Math.max(0, Math.ceil(Number(seconds || 0)));
    if (safeSeconds >= 60) {
        const minutes = Math.floor(safeSeconds / 60);
        const remainSeconds = safeSeconds % 60;
        if (remainSeconds === 0) {
            return `${minutes} ${tx(t, 'minutes')}`;
        }
        const template = tx(t, 'minutesAndSeconds');
        return template.replace('{{minutes}}', String(minutes)).replace('{{seconds}}', String(remainSeconds));
    }
    return `${safeSeconds} ${tx(t, 'second')}`;
};

export const getUploadEtaText = (
    params: {
        status?: string;
        elapsedSeconds?: number | null;
        estimatedRemainingSeconds?: number | null;
        estimatedTotalSeconds?: number | null;
    },
    t: TranslateFn = defaultTranslations,
): string => {
    const { status, elapsedSeconds, estimatedRemainingSeconds, estimatedTotalSeconds } = params;

    if (status === 'completed' || status === 'failed') {
        return '';
    }

    const remainingSeconds = Math.max(0, Math.ceil(Number(estimatedRemainingSeconds || 0)));
    const totalSeconds = Math.max(0, Math.ceil(Number(estimatedTotalSeconds || 0)));
    const elapsed = Math.max(0, Math.floor(Number(elapsedSeconds || 0)));

    if (totalSeconds > 0 && elapsed >= totalSeconds && remainingSeconds === 0) {
        return tx(t, 'takingLonger');
    }

    if (remainingSeconds <= 0) {
        return '';
    }

    // 功能注释：必须走 tx，避免 t('remaining') 命中不到 eta.remaining 时英文 key 和中文「分钟」拼在一起
    return `${tx(t, 'remaining')} ${formatEtaMinutes(remainingSeconds, t)}`;
};
