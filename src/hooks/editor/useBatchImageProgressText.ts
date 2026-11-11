import { useMemo } from 'react';
import { formatEtaPrecise } from '../../utils/etaText';
import { useTranslation } from 'react-i18next';

interface BatchImageProgressStatusLike {
    status?: string;
    totalCount?: number;
    completedCount?: number;
    estimatedRemainingSeconds?: number | null;
}

export const useBatchImageProgressText = (
    jobStatus?: BatchImageProgressStatusLike | null,
): string => {
    const { t } = useTranslation();

    return useMemo(() => {
        if (!jobStatus) {
            return '';
        }

        const totalCount = Math.max(0, Number(jobStatus.totalCount || 0));
        if (totalCount <= 0) {
            return '';
        }

        const completedCount = Math.min(
            totalCount,
            Math.max(0, Number(jobStatus.completedCount || 0)),
        );
        const remainingSeconds = Number(jobStatus.estimatedRemainingSeconds);
        const prefix = `${t('eta.total')} ${totalCount} ${t('eta.item')}`;

        if (
            jobStatus.status !== 'completed'
            && Number.isFinite(remainingSeconds)
            && remainingSeconds > 0
        ) {
            return `${prefix}，${t('eta.remaining')} ${formatEtaPrecise(remainingSeconds, t)}，${t('eta.completed')} ${completedCount}/${totalCount} ${t('eta.item')}`;
        }

        return `${prefix}，${t('eta.completed')} ${completedCount}/${totalCount} ${t('eta.item')}`;
    }, [jobStatus, t]);
};
