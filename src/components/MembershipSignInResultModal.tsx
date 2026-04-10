import React from 'react';
import { createPortal } from 'react-dom';
import type { MembershipSignInStatus } from '../api/account/auth.type';
import styles from './MembershipSignInResultModal.module.css';

interface MembershipSignInResultModalProps {
    isOpen: boolean;
    onClose: () => void;
    status: MembershipSignInStatus | null;
    isLoading?: boolean;
}

const MembershipSignInResultModal: React.FC<MembershipSignInResultModalProps> = ({
    isOpen,
    onClose,
    status,
    isLoading = false,
}) => {
    if (!isOpen) return null;

    const streakDay = status?.streakDay ?? 0;
    const schedule = status?.displaySchedule ?? [];
    const signedInToday = status?.signedInToday ?? false;
    const todaySchedulePoints = streakDay > 0
        ? (schedule[streakDay - 1] ?? 0)
        : (schedule[0] ?? 0);

    return createPortal(
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.content} onClick={(event) => event.stopPropagation()}>
                <button type="button" className={styles.closeButton} onClick={onClose}>
                    ×
                </button>
                <h3 className={styles.title}>{signedInToday ? '今日已签到' : '每日签到'}</h3>

                {isLoading ? (
                    <div className={styles.placeholder}>正在加载...</div>
                ) : !status || schedule.length === 0 ? (
                    <div className={styles.placeholder}>暂无签到数据</div>
                ) : (
                    <div className={styles.scheduleContainer}>
                        <p className={styles.subtitle}>
                            {signedInToday
                                ? '明天继续签到可获得更多积分'
                                : `今日签到可获得 ${status.totalPointsToday} 积分`}
                        </p>
                        <div className={styles.scheduleList}>
                            {schedule.map((points, index) => {
                                const dayNum = index + 1;
                                const isToday = dayNum === streakDay;
                                const isCompleted = dayNum < streakDay || (dayNum === streakDay && signedInToday);

                                return (
                                    <div
                                        key={`${dayNum}-${points}`}
                                        className={`${styles.scheduleItem} ${isToday ? styles.scheduleItemToday : ''} ${isCompleted ? styles.scheduleItemCompleted : ''}`}
                                    >
                                        <div className={styles.dayBadge}>{isCompleted ? '✓' : dayNum}</div>
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
                            {signedInToday
                                ? `已连续签到 ${streakDay} 天`
                                : `今日签到可获 +${todaySchedulePoints} 积分`}
                        </p>
                    </div>
                )}
            </div>
        </div>,
        document.body,
    );
};

export default MembershipSignInResultModal;
