import React, { useEffect, useState } from 'react';
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

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

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

    const streakDay = signInStatus?.streakDay ?? 1;
    const schedule = signInStatus?.displaySchedule ?? [];
    const signedInToday = signInStatus?.signedInToday ?? false;
    const todayPoints = signInStatus?.totalPointsToday ?? 0;
    const signedDaysThisMonth = signInStatus?.signedDaysThisMonth ?? [];
    const isStatusReady = Boolean(signInStatus);

    const consecutiveDays = signedInToday
        ? streakDay
        : Math.max(0, streakDay - 1);

    const getMembershipBonusPoints = () => {
        switch (signInStatus?.planId) {
            case 'month':
                return 300;
            case 'season':
                return 350;
            case 'year':
                return 400;
            default:
                return 0;
        }
    };

    const now = new Date();
    const todayDate = now.getDate();
    const daysInCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const firstDayWeekday = new Date(now.getFullYear(), now.getMonth(), 1).getDay();

    const lastReward = schedule.length > 0 ? schedule[schedule.length - 1] : 0;

    const getStreakReward = (streakDayNum: number): number => {
        if (schedule.length === 0) return 0;
        const index = streakDayNum - 1;
        if (index < 0) return schedule[0] ?? 0;
        if (index < schedule.length) return schedule[index];
        return lastReward;
    };

    const getStreakDayAtSignedDate = (dayNum: number): number => {
        let streak = 0;
        for (let d = 1; d <= dayNum; d++) {
            if (signedDaysThisMonth.includes(d)) {
                streak += 1;
            } else {
                streak = 0;
            }
        }
        return streak;
    };

    const getDayPoints = (dayNum: number, isSigned: boolean): number | null => {
        const isTodayCell = dayNum === todayDate;
        const isUnreachable = !isSigned && dayNum < todayDate;

        if (isUnreachable) return null;

        if (isSigned) {
            return getStreakReward(getStreakDayAtSignedDate(dayNum));
        }

        if (isTodayCell && !signedInToday) {
            return getStreakReward(streakDay);
        }

        if (dayNum > todayDate) {
            const futureStreakDay = streakDay + (dayNum - todayDate);
            return getStreakReward(futureStreakDay);
        }

        return null;
    };

    const hintPoints = signedInToday
        ? getStreakReward(signInStatus?.nextStreakDay ?? streakDay + 1)
        : todayPoints;

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

    const monthDays = Array.from({ length: daysInCurrentMonth }, (_, index) => {
        const dayNum = index + 1;
        const isSigned = signedDaysThisMonth.includes(dayNum);
        return { dayNum, isSigned };
    });

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.content} onClick={(event) => event.stopPropagation()}>
                <button type="button" className={styles.closeButton} onClick={onClose} aria-label={t('common.close')}>
                    <span className={styles.closeIcon} aria-hidden="true" />
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
                            <h3 className={styles.title}>{t('checkIn.title')}</h3>
                            <p className={styles.streakLine}>
                                {t('checkIn.streakPrefix')}
                                <span className={styles.streakNum}>{consecutiveDays}</span>
                                {t('checkIn.streakSuffix')}
                            </p>
                            <p className={styles.subtitle}>
                                {signedInToday
                                    ? t('checkIn.tomorrowRewardPrefix')
                                    : t('checkIn.subtitlePointsPrefix')}
                                <span className={styles.pointsHighlight}>
                                    {t('checkIn.pointsQuote', { points: hintPoints })}
                                </span>
                            </p>
                        </div>

                        {schedule.length > 0 && (
                            <div className={styles.calendarWrapper}>
                                <div className={styles.weekdayRow}>
                                    {WEEKDAY_KEYS.map((key) => (
                                        <span key={key} className={styles.weekdayLabel}>
                                            {t(`checkIn.weekdays.${key}`)}
                                        </span>
                                    ))}
                                </div>
                                <div className={styles.monthlyGrid}>
                                    {Array.from({ length: firstDayWeekday }).map((_, idx) => (
                                        <div
                                            key={`empty-${idx}`}
                                            className={styles.emptyCell}
                                            aria-hidden="true"
                                        />
                                    ))}
                                    {monthDays.map(({ dayNum, isSigned }) => {
                                        const isTodayCell = dayNum === todayDate;
                                        const isClaimed = isTodayCell && isSigned;
                                        const isHistoricalSigned = isSigned && !isTodayCell;
                                        const isStreakActive = isTodayCell && !signedInToday;
                                        const isForecast = !isSigned && dayNum > todayDate;
                                        const isUnreachable = !isSigned && dayNum < todayDate;
                                        const points = getDayPoints(dayNum, isSigned);
                                        const showCheck = isClaimed || isHistoricalSigned;

                                        return (
                                            <div
                                                key={dayNum}
                                                className={`
                                                    ${styles.dayCell}
                                                    ${isClaimed ? styles.dayCellTodayCompleted : ''}
                                                    ${isStreakActive ? styles.dayCellToday : ''}
                                                    ${isHistoricalSigned ? styles.dayCellCompleted : ''}
                                                    ${isForecast ? styles.dayCellForecast : ''}
                                                    ${isUnreachable ? styles.dayCellFuture : ''}
                                                    ${points !== null && points > 20 ? styles.dayCellBonus : ''}
                                                `}
                                            >
                                                {showCheck ? (
                                                    <>
                                                        <span className={styles.signedCheck} aria-hidden="true">
                                                            <svg
                                                                className={styles.checkIcon}
                                                                width="10"
                                                                height="10"
                                                                viewBox="0 0 24 24"
                                                                fill="none"
                                                                stroke="currentColor"
                                                                strokeWidth="3.5"
                                                            >
                                                                <polyline points="20 6 9 17 4 12" />
                                                            </svg>
                                                        </span>
                                                        <span className={styles.signedText}>
                                                            {t('checkIn.signed')}
                                                        </span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span className={styles.dayCellNumber}>{dayNum}</span>
                                                        {points !== null && (
                                                            <span className={styles.dayCellPoints}>
                                                                {`+${points}`}
                                                            </span>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {getMembershipBonusPoints() > 0 && (
                            <p className={styles.membershipHint}>
                                {t('checkIn.membershipBonusHint', { points: getMembershipBonusPoints() })}
                            </p>
                        )}

                        <div className={styles.buttonContainer}>
                            <button
                                type="button"
                                className={`${styles.signInButton} ${signedInToday ? styles.signInButtonDone : ''}`}
                                onClick={handleCheckIn}
                                disabled={isLoading || isFetchingStatus || signedInToday}
                            >
                                {isLoading ? (
                                    <span className={styles.buttonLoading}>
                                        <span className={styles.spinner} />
                                        {t('checkIn.signingIn')}
                                    </span>
                                ) : signedInToday
                                    ? t('checkIn.titleSignedIn')
                                    : t('checkIn.signInNow')}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default CheckInModal;
