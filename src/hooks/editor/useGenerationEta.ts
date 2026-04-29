import { useEffect, useMemo, useState } from 'react';
import { formatEtaPrecise } from '../../utils/etaText';

interface UseGenerationEtaOptions {
    active: boolean;
    totalSeconds: number;
    totalCount?: number;
    batchLabel?: string;
    completedCount?: number;
    status?: string;
    estimatedRemainingSeconds?: number | null;
}

export const useGenerationEta = ({
    active,
    totalSeconds,
    totalCount = 0,
    batchLabel,
    completedCount,
    status,
    estimatedRemainingSeconds,
}: UseGenerationEtaOptions): string => {
    const [startedAt, setStartedAt] = useState<number | null>(null);
    const [now, setNow] = useState<number>(Date.now());

    useEffect(() => {
        if (!active) {
            setStartedAt(null);
            return;
        }

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
        const safeTotalCount = Math.max(0, Math.floor(totalCount));
        const backendRemainingSeconds = Number.isFinite(estimatedRemainingSeconds)
            ? Math.max(0, Math.ceil(Number(estimatedRemainingSeconds)))
            : null;
        const effectiveRemainingSeconds = backendRemainingSeconds ?? remainingSeconds;
        const hasRealBatchProgress = safeTotalCount > 1 && Number.isFinite(completedCount);
        const normalizedCompletedCount = hasRealBatchProgress
            ? Math.max(0, Math.min(safeTotalCount, Math.floor(Number(completedCount))))
            : 0;
        const isTerminalStatus = status === 'completed' || status === 'failed' || status === 'unknown';

        if (hasRealBatchProgress) {
            const currentIndex = normalizedCompletedCount >= safeTotalCount || isTerminalStatus
                ? safeTotalCount
                : Math.min(safeTotalCount, normalizedCompletedCount + 1);
            const labelPrefix = batchLabel ? `${batchLabel}，` : '';
            return `${labelPrefix}预计还需 ${formatEtaPrecise(effectiveRemainingSeconds)}，正在生成第 ${currentIndex}/${safeTotalCount} 项`;
        }

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
    }, [active, batchLabel, completedCount, estimatedRemainingSeconds, now, startedAt, status, totalCount, totalSeconds]);
};
