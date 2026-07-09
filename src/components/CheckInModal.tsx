import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import { auth } from '../api/account/authApi';
import type { MembershipSignInStatus } from '../api/account/auth.type';
import styles from './CheckInModal.module.css';

interface CheckInModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSignInSuccess?: () => void;
}

const CheckInModal: React.FC<CheckInModalProps> = ({
    isOpen,
    onClose,
    onSignInSuccess,
}) => {
    const { t } = useTranslation();
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingStatus, setIsFetchingStatus] = useState(false);
    const [signInStatus, setSignInStatus] = useState<MembershipSignInStatus | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        void fetchSignInStatus();
    }, [isOpen]);

    const fetchSignInStatus = async () => {
        setIsFetchingStatus(true);
        try {
            const response = await auth.getSignInStatus();
            if (response.data.success && response.data.data) {
                setSignInStatus(response.data.data);
            } else {
                setSignInStatus(null);
            }
        } catch (error) {
            console.error('获取签到状态失败:', error);
            setSignInStatus(null);
        } finally {
            setIsFetchingStatus(false);
        }
    };

    const streakDay = signInStatus?.streakDay ?? 0;
    const schedule = signInStatus?.displaySchedule ?? [];
    const signedInToday = signInStatus?.signedInToday ?? false;

    const todaySchedulePoints = useMemo(() => {
        if (!schedule.length) return 0;
        if (streakDay <= 0) return schedule[0] ?? 0;
        return schedule[streakDay - 1] ?? 0;
    }, [schedule, streakDay]);

    const todayPoints = signInStatus?.totalPointsToday ?? todaySchedulePoints;
    const isStatusReady = Boolean(signInStatus);

    if (!isOpen) return null;

    const handleCheckIn = async () => {
        if (isLoading || isFetchingStatus || !isStatusReady || signedInToday) return;

        setIsLoading(true);
        try {
            const response = await auth.checkIn();
            if (response.data.success) {
                await fetchSignInStatus();
                toast.success(t('checkIn.success', { points: todayPoints }));
                onSignInSuccess?.();
                window.setTimeout(onClose, 900);
            } else {
                toast.error(response.data.message || t('checkIn.failed'));
            }
        } catch {
            toast.error(t('checkIn.requestFailed'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.content} onClick={(event) => event.stopPropagation()}>
                <button type="button" className={styles.closeButton} onClick={onClose}>
                    ×
                </button>

                {isFetchingStatus && !isStatusReady ? (
                    <p className={styles.loadingText}>{t('checkIn.loading')}</p>
                ) : !isStatusReady ? (
                    <div className={styles.buttonContainer}>
                        <button
                            type="button"
                            className={styles.signInButton}
                            onClick={() => {
                                void fetchSignInStatus();
                            }}
                            disabled={isLoading || isFetchingStatus}
                        >
                            {t('checkIn.retry')}
                        </button>
                    </div>
                ) : (
                    <>
                        <div className={styles.header}>
                            <h3 className={styles.title}>
                                {signedInToday ? t('checkIn.titleSignedIn') : t('checkIn.title')}
                            </h3>
                            <p className={styles.subtitle}>
                                {signedInToday
                                    ? t('checkIn.subtitleTomorrow')
                                    : t('checkIn.subtitlePoints', { points: todayPoints })}
                            </p>
                        </div>

                        {schedule.length > 0 && (
                            <div className={styles.calendarWrapper}>
                                <div className={styles.monthlyGrid}>
                                    {schedule.map((points, index) => {
                                        const dayNum = index + 1;
                                        const isToday = dayNum === streakDay && !signedInToday;
                                        const isCompleted = dayNum < streakDay || (dayNum === streakDay && signedInToday);
                                        const isFuture = dayNum > streakDay;
                                        const isBonus = points > 9;

                                        return (
                                            <div
                                                key={`${dayNum}-${points}`}
                                                className={`
                                                    ${styles.dayCell}
                                                    ${isToday ? styles.dayCellToday : ''}
                                                    ${isCompleted ? styles.dayCellCompleted : ''}
                                                    ${isFuture ? styles.dayCellFuture : ''}
                                                    ${isBonus ? styles.dayCellBonus : ''}
                                                `}
                                            >
                                                <span className={styles.dayCellNumber}>
                                                    {isCompleted && !isToday ? (
                                                        <svg className={styles.checkIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                                            <polyline points="20 6 9 17 4 12"/>
                                                        </svg>
                                                    ) : dayNum}
                                                </span>
                                                <span className={styles.dayCellPoints}>+{points}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {!signedInToday && (
                            <div className={styles.buttonContainer}>
                                <button
                                    type="button"
                                    className={styles.signInButton}
                                    onClick={handleCheckIn}
                                    disabled={isLoading || isFetchingStatus}
                                >
                                    {isLoading ? (
                                        <span className={styles.buttonLoading}>
                                            <span className={styles.spinner} />
                                            {t('checkIn.signingIn')}
                                        </span>
                                    ) : t('checkIn.signInNow')}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default CheckInModal;
