export const formatEtaMinutes = (seconds?: number | null): string => {
    const safeSeconds = Math.max(0, Math.ceil(Number(seconds || 0)));
    if (safeSeconds >= 60) {
        return `${Math.ceil(safeSeconds / 60)} 分钟`;
    }
    return `${safeSeconds} 秒`;
};

export const formatEtaPrecise = (seconds?: number | null): string => {
    const safeSeconds = Math.max(0, Math.ceil(Number(seconds || 0)));
    if (safeSeconds >= 60) {
        const minutes = Math.floor(safeSeconds / 60);
        const remainSeconds = safeSeconds % 60;
        if (remainSeconds === 0) {
            return `${minutes} 分钟`;
        }
        return `${minutes} 分 ${remainSeconds} 秒`;
    }
    return `${safeSeconds} 秒`;
};

export const getUploadEtaText = (params: {
    status?: string;
    elapsedSeconds?: number | null;
    estimatedRemainingSeconds?: number | null;
    estimatedTotalSeconds?: number | null;
}): string => {
    const { status, elapsedSeconds, estimatedRemainingSeconds, estimatedTotalSeconds } = params;

    if (status === 'completed' || status === 'failed') {
        return '';
    }

    const remainingSeconds = Math.max(0, Math.ceil(Number(estimatedRemainingSeconds || 0)));
    const totalSeconds = Math.max(0, Math.ceil(Number(estimatedTotalSeconds || 0)));
    const elapsed = Math.max(0, Math.floor(Number(elapsedSeconds || 0)));

    // 实现超出预计后的兜底提示
    if (totalSeconds > 0 && elapsed >= totalSeconds && remainingSeconds === 0) {
        return '耗时较长，仍在处理中，请稍候';
    }

    if (remainingSeconds <= 0) {
        return '';
    }

    return `预计还需 ${formatEtaMinutes(remainingSeconds)}`;
};
