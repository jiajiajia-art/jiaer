import { useMemo } from 'react';
import { formatEtaPrecise } from '../../utils/etaText';

interface BatchImageProgressStatusLike {
    status?: string;
    totalCount?: number;
    completedCount?: number;
    estimatedRemainingSeconds?: number | null;
}

export const useBatchImageProgressText = (
    jobStatus?: BatchImageProgressStatusLike | null,
): string => {
    return useMemo(() => {
        if (!jobStatus) {
            return '';
        }

        const totalCount = Math.max(0, Number(jobStatus.totalCount || 0));
        if (totalCount <= 0) {
            return '';
        }

        // 实现批量真实完成数展示
        const completedCount = Math.min(
            totalCount,
            Math.max(0, Number(jobStatus.completedCount || 0)),
        );
        const remainingSeconds = Number(jobStatus.estimatedRemainingSeconds);
        const prefix = `本次共生成 ${totalCount} 项`;

        // 实现 ETA 可用时的完整提示
        if (
            jobStatus.status !== 'completed'
            && Number.isFinite(remainingSeconds)
            && remainingSeconds > 0
        ) {
            return `${prefix}，预计还需 ${formatEtaPrecise(remainingSeconds)}，已完成 ${completedCount}/${totalCount} 项`;
        }

        return `${prefix}，已完成 ${completedCount}/${totalCount} 项`;
    }, [jobStatus]);
};
