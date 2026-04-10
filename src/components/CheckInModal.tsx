import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { auth } from '../api/account/authApi';
import type { MembershipSignInStatus } from '../api/account/auth.type';
import styles from './CheckInModal.module.css';

interface CheckInModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSignInSuccess?: () => void;
    variant?: 'full' | 'simple';
}

const CheckInModal: React.FC<CheckInModalProps> = ({
    isOpen,
    onClose,
    onSignInSuccess,
    variant = 'full',
}) => {
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

    // 修正索引：streakDay=1 时应读取 schedule[0]
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
                toast.success(`签到成功，获得${todayPoints}积分`);
                onSignInSuccess?.();
                window.setTimeout(onClose, 900);
            } else {
                toast.error(response.data.message || '签到失败');
            }
        } catch {
            toast.error('签到请求失败');
        } finally {
            setIsLoading(false);
        }
    };

    if (variant === 'simple') {
        return (
            <div className={styles.overlay} onClick={onClose}>
                <div className={`${styles.content} ${styles.simpleContent}`} onClick={(event) => event.stopPropagation()}>
                    <div className={styles.simpleIconWrapper}>
                        <img src={`${import.meta.env.BASE_URL}data/assets/金币1.png`} alt="签到" />
                    </div>

                    <h3 className={styles.simpleTitle}>每日签到</h3>

                    {isFetchingStatus && !isStatusReady ? (
                        <p className={styles.loadingText}>正在加载签到信息...</p>
                    ) : !isStatusReady ? (
                        <>
                            <p className={styles.loadingText}>签到信息加载失败，请重试</p>
                            <div className={styles.simpleButtonContainer}>
                                <button
                                    type="button"
                                    className={styles.simpleLaterButton}
                                    onClick={onClose}
                                    disabled={isLoading}
                                >
                                    稍后
                                </button>
                                <button
                                    type="button"
                                    className={styles.simpleSignInButton}
                                    onClick={() => {
                                        void fetchSignInStatus();
                                    }}
                                    disabled={isLoading || isFetchingStatus}
                                >
                                    重试
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <p className={styles.simpleDesc}>
                                签到即可获得 <span className={styles.simplePoints}>{todayPoints}积分</span>
                            </p>

                            <div className={styles.simpleButtonContainer}>
                                <button
                                    type="button"
                                    className={styles.simpleLaterButton}
                                    onClick={onClose}
                                    disabled={isLoading}
                                >
                                    稍后
                                </button>
                                <button
                                    type="button"
                                    className={styles.simpleSignInButton}
                                    onClick={handleCheckIn}
                                    disabled={isLoading || isFetchingStatus || signedInToday}
                                >
                                    {signedInToday ? '已签到' : (isLoading ? '签到中...' : '立即签到')}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.content} onClick={(event) => event.stopPropagation()}>
                <button type="button" className={styles.closeButton} onClick={onClose}>
                    ×
                </button>

                {isFetchingStatus && !isStatusReady ? (
                    <p className={styles.loadingText}>正在加载签到信息...</p>
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
                            重试
                        </button>
                    </div>
                ) : (
                    <>
                        <div className={styles.header}>
                            <h3 className={styles.title}>{signedInToday ? '今日已签到' : '每日签到'}</h3>
                            <p className={styles.subtitle}>
                                {signedInToday
                                    ? '明天继续签到可获得更多积分'
                                    : `今日签到可获得 ${todayPoints} 积分`}
                            </p>
                        </div>

                        {schedule.length > 0 && (
                            <div className={styles.scheduleContainer}>
                                <div className={styles.scheduleList}>
                                    {schedule.map((points, index) => {
                                        const dayNum = index + 1;
                                        const isToday = dayNum === streakDay;
                                        const isCompleted = dayNum < streakDay || (dayNum === streakDay && signedInToday);
                                        const isFuture = dayNum > streakDay || (!signedInToday && dayNum > streakDay);

                                        return (
                                            <div
                                                key={`${dayNum}-${points}`}
                                                className={`${styles.scheduleItem} ${isToday ? styles.scheduleItemToday : ''} ${isCompleted ? styles.scheduleItemCompleted : ''} ${isFuture ? styles.scheduleItemFuture : ''}`}
                                            >
                                                <div className={styles.dayBadge}>
                                                    {isCompleted ? <span className={styles.checkIcon}>✓</span> : <span className={styles.dayNumber}>{dayNum}</span>}
                                                </div>
                                                <div className={styles.scheduleDay}>第{dayNum}天</div>
                                                <div className={styles.schedulePoints}>+{points}</div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className={styles.progressBar}>
                                    <div
                                        className={styles.progressFill}
                                        style={{ width: `${(Math.max(streakDay, 0) / 7) * 100}%` }}
                                    />
                                </div>
                                <p className={styles.progressText}>
                                    {signedInToday ? `已连续签到 ${streakDay} 天` : `今日签到可获 +${todaySchedulePoints} 积分`}
                                </p>
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
                                    {isLoading ? '签到中...' : '立即签到'}
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
