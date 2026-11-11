import { useEffect, useMemo, useState } from 'react';
import { formatEtaPrecise } from '../../utils/etaText';
import { useTranslation } from 'react-i18next';

interface UseGenerationEtaOptions {
    active: boolean;
    totalSeconds: number;
    totalCount?: number;
    batchLabel?: string;
    completedCount?: number;
    status?: string;
    estimatedRemainingSeconds?: number | null;
    /** 并行流水线：用「已完成」而非「正在生成第 N 项」，避免与日志对不上 */
    progressMode?: 'sequential' | 'pipeline';
    /** 为 false 时不展示「剩余 xx」倒计时（场景批量看板已有分项进度） */
    showRemaining?: boolean;
}

export const useGenerationEta = ({
    active,
    totalSeconds,
    totalCount = 0,
    batchLabel,
    completedCount,
    status,
    estimatedRemainingSeconds,
    progressMode = 'sequential',
    showRemaining = true,
}: UseGenerationEtaOptions): string => {
    const { t } = useTranslation();
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
        const hasRealBatchProgress = safeTotalCount > 0 && Number.isFinite(completedCount);
        const normalizedCompletedCount = hasRealBatchProgress
            ? Math.max(0, Math.min(safeTotalCount, Math.floor(Number(completedCount))))
            : 0;
        const isTerminalStatus = status === 'completed' || status === 'failed' || status === 'unknown';
        const labelPrefix = batchLabel ? `${batchLabel}，` : '';
        const usePipelineCopy = progressMode === 'pipeline';

        if (hasRealBatchProgress && safeTotalCount >= 1) {
            // 并行流水线：只展示剩余时间，分项进度由面板单独展示（避免「第 N 项」误导）
            if (usePipelineCopy) {
                if (!showRemaining) {
                    return labelPrefix.replace(/，$/, '') || '';
                }
                if (!isTerminalStatus && effectiveRemainingSeconds <= 0) {
                    return t('eta.generatingMoreTime');
                }
                return `${t('eta.remaining')} ${formatEtaPrecise(effectiveRemainingSeconds, t)}`;
            }

            const currentIndex = normalizedCompletedCount >= safeTotalCount || isTerminalStatus
                ? safeTotalCount
                : Math.min(safeTotalCount, normalizedCompletedCount + 1);
            const progressPhrase = `${t('eta.generating')} ${currentIndex}/${safeTotalCount} ${t('eta.item')}`;

            if (!showRemaining) {
                return `${labelPrefix}${progressPhrase}`;
            }

            if (!isTerminalStatus && effectiveRemainingSeconds <= 0) {
                return `${labelPrefix}${t('eta.generatingMoreTime')}，${progressPhrase}`;
            }

            return `${labelPrefix}${t('eta.remaining')} ${formatEtaPrecise(effectiveRemainingSeconds, t)}，${progressPhrase}`;
        }

        if (!showRemaining) {
            if (totalCount > 1) {
                const perItemSeconds = Math.max(1, Math.ceil(safeTotalSeconds / Math.max(1, totalCount)));
                const currentIndex = Math.min(totalCount, Math.max(1, Math.floor(elapsedSeconds / perItemSeconds) + 1));
                return `${labelPrefix}${t('eta.generating')} ${currentIndex}/${totalCount} ${t('eta.item')}`;
            }
            return labelPrefix.replace(/，$/, '') || '';
        }

        if (elapsedSeconds >= safeTotalSeconds) {
            return t('eta.generatingMoreTime');
        }

        if (totalCount > 1) {
            if (usePipelineCopy) {
                return `${t('eta.remaining')} ${formatEtaPrecise(remainingSeconds, t)}`;
            }
            const perItemSeconds = Math.max(1, Math.ceil(safeTotalSeconds / totalCount));
            const currentIndex = Math.min(totalCount, Math.max(1, Math.floor(elapsedSeconds / perItemSeconds) + 1));
            return `${labelPrefix}${t('eta.remaining')} ${formatEtaPrecise(remainingSeconds, t)}，${t('eta.generating')} ${currentIndex}/${totalCount} ${t('eta.item')}`;
        }

        return `${t('eta.remaining')} ${formatEtaPrecise(remainingSeconds, t)}`;
    }, [
        active,
        batchLabel,
        completedCount,
        estimatedRemainingSeconds,
        now,
        progressMode,
        showRemaining,
        startedAt,
        status,
        totalCount,
        totalSeconds,
        t,
    ]);
};
