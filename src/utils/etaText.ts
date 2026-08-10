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

/** i18n 可能是 eta.second，默认表也可能是 short key */
const tx = (t: TranslateFn, shortKey: string): string => {
    const nestedKey = `eta.${shortKey}`;
    const nested = t(nestedKey);
    if (nested && nested !== nestedKey) {
        return nested;
    }
    const direct = t(shortKey);
    if (direct && direct !== shortKey) {
        return direct;
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
        return t('takingLonger');
    }

    if (remainingSeconds <= 0) {
        return '';
    }

    return `${t('remaining')} ${formatEtaMinutes(remainingSeconds, t)}`;
};
