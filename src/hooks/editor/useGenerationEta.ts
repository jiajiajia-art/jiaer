import { useEffect, useMemo, useState } from 'react';
import { formatEtaPrecise } from '../../utils/etaText';

interface UseGenerationEtaOptions {
    active: boolean;
    totalSeconds: number;
    totalCount?: number;
    batchLabel?: string;
}

export const useGenerationEta = ({
    active,
    totalSeconds,
    totalCount = 0,
    batchLabel,
}: UseGenerationEtaOptions): string => {
    const [startedAt, setStartedAt] = useState<number | null>(null);
    const [now, setNow] = useState<number>(Date.now());

    useEffect(() => {
        if (!active) {
            setStartedAt(null);
            return;
        }

        // 实现生成任务起始时间记录
        setStartedAt((prev) => prev ?? Date.now());
    }, [active]);

    useEffect(() => {
        if (!active) {
            return;
        }

        const timer = window.setInterval(() => {
            setNow(Date.now());
        }, 1000);

        return () => window.clearInterval(timer);
    }, [active]);

    return useMemo(() => {
        if (!active || !startedAt) {
            return '';
        }

        const safeTotalSeconds = Math.max(1, Math.ceil(totalSeconds));
        const elapsedSeconds = Math.max(0, Math.floor((now - startedAt) / 1000));
        const remainingSeconds = Math.max(0, safeTotalSeconds - elapsedSeconds);

        // 实现超出预计后的等待提示
        if (elapsedSeconds >= safeTotalSeconds) {
            return '生成时间比平时更长，请继续等待';
        }

        if (totalCount > 1) {
            const perItemSeconds = Math.max(1, Math.ceil(safeTotalSeconds / totalCount));
            const currentIndex = Math.min(totalCount, Math.max(1, Math.floor(elapsedSeconds / perItemSeconds) + 1));
            const labelPrefix = batchLabel ? `${batchLabel}，` : '';
            return `${labelPrefix}预计还需 ${formatEtaPrecise(remainingSeconds)}，正在生成第 ${currentIndex}/${totalCount} 项`;
        }

        return `预计还需 ${formatEtaPrecise(remainingSeconds)}`;
    }, [active, batchLabel, now, startedAt, totalCount, totalSeconds]);
};
