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

    // 核心数据
    const streakDay = signInStatus?.streakDay ?? 1; // 今天该签第几天
    const schedule = signInStatus?.displaySchedule ?? []; // 奖励表
    const signedInToday = signInStatus?.signedInToday ?? false; // 今天是否已签
    const todayPoints = signInStatus?.totalPointsToday ?? 0; // 今天可得积分
    const signedDaysThisMonth = signInStatus?.signedDaysThisMonth ?? []; // 本月已签到天数

    const isStatusReady = Boolean(signInStatus);

    // 根据会员等级获取额外奖励点数
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

    // 当月天数
    const now = new Date();
    const todayDate = now.getDate(); // 今天是这个月的几号
    const daysInCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    // 当月 1 号是星期几 (0 = 周日, 用于月初占位)
    const firstDayWeekday = new Date(now.getFullYear(), now.getMonth(), 1).getDay();

    // 补齐 schedule 不足当月天数的情况
    const lastReward = schedule.length > 0 ? schedule[schedule.length - 1] : 0;
    const paddedSchedule = schedule.length >= daysInCurrentMonth
        ? schedule.slice(0, daysInCurrentMonth)
        : [...schedule, ...Array(daysInCurrentMonth - schedule.length).fill(lastReward)];

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

    // 构建当月每一天的显示数据
    // 核心逻辑：按连续签到段计算，每段内 dayNum - startDay = scheduleIndex
    const monthDays = Array.from({ length: daysInCurrentMonth }, (_, index) => {
        const dayNum = index + 1;
        const isSigned = signedDaysThisMonth.includes(dayNum);
        return { dayNum, isSigned };
    });

    // 当月每一天的奖励值：固定对应 displaySchedule[dayNum - 1]
    const getDayDisplay = (dayNum: number) => {
        return paddedSchedule[dayNum - 1] ?? lastReward;
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
                                    ? t('checkIn.subtitleTomorrow', { streakDay: streakDay + 1 })
                                    : t('checkIn.subtitlePoints', { points: todayPoints })}
                            </p>
                        </div>

                        {paddedSchedule.length > 0 && (
                            <div className={styles.calendarWrapper}>
                                <div className={styles.weekdayRow}>
                                    {['日', '一', '二', '三', '四', '五', '六'].map((label, idx) => (
                                        <span
                                            key={`${label}-${idx}`}
                                            className={styles.weekdayLabel}
                                        >
                                            {label}
                                        </span>
                                    ))}
                                </div>
                                <div className={styles.monthlyGrid}>
                                    {/* 月初占位 */}
                                    {Array.from({ length: firstDayWeekday }).map((_, idx) => (
                                        <div
                                            key={`empty-${idx}`}
                                            className={styles.emptyCell}
                                            aria-hidden="true"
                                        />
                                    ))}
                                    {monthDays.map(({ dayNum, isSigned }) => {
                                        // 今天的签到格（按日历今天几号）
                                        const isTodayCell = dayNum === todayDate;
                                        // 今天已签到：今天 + 已签到
                                        const isClaimed = isTodayCell && isSigned;
                                        // 历史已签到天（除今天外）
                                        const isHistoricalSigned = isSigned && !isTodayCell;
                                        // 今天待签到：今天 + 未签到
                                        const isStreakActive = isTodayCell && !signedInToday;
                                        // 预测可签到：今天之后 + 未签到
                                        const isForecast = !isSigned && dayNum > todayDate;
                                        // 不可签到（历史断签）：今天之前 + 未签到
                                        const isUnreachable = !isSigned && dayNum < todayDate;
                                        // 当前天应显示的奖励值
                                        const points = getDayDisplay(dayNum);
                                        // 是否展示对勾（已签到）
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
                                                    ${points > 9 ? styles.dayCellBonus : ''}
                                                `}
                                            >
                                                <span className={styles.dayCellNumber}>
                                                    {showCheck ? (
                                                        <svg
                                                            className={styles.checkIcon}
                                                            width="16"
                                                            height="16"
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            strokeWidth="3"
                                                        >
                                                            <polyline points="20 6 9 17 4 12" />
                                                        </svg>
                                                    ) : (
                                                        dayNum
                                                    )}
                                                </span>
                                                <span className={styles.dayCellPoints}>
                                                    {`+${points}`}
                                                </span>
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
