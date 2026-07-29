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

    return createPortal(
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.content} onClick={(event) => event.stopPropagation()}>
                <button type="button" className={styles.closeButton} onClick={onClose}>
                    ×
                </button>

                <div className={styles.header}>
                    <h3 className={styles.title}>{signedInToday ? '今日已签到' : '每日签到'}</h3>
                    <p className={styles.subtitle}>
                        {signedInToday
                            ? '明天继续签到可获得更多积分'
                            : `今日签到可获得 ${status?.totalPointsToday ?? 0} 积分`}
                    </p>
                </div>

                {isLoading ? (
                    <div className={styles.placeholder}>
                        <span className={styles.loadingSpinner} />
                        正在加载...
                    </div>
                ) : !status || schedule.length === 0 ? (
                    <div className={styles.placeholder}>暂无签到数据</div>
                ) : (
                    <div className={styles.scheduleContainer}>
                        <div className={styles.calendarWrapper}>
                            <div className={styles.scheduleList}>
                                {schedule.map((points, index) => {
                                    const dayNum = index + 1;
                                    const isToday = dayNum === streakDay && !signedInToday;
                                    const isCompleted = dayNum < streakDay || (dayNum === streakDay && signedInToday);
                                    const isFuture = dayNum > streakDay;

                                    return (
                                        <div
                                            key={`${dayNum}-${points}`}
                                            className={`
                                                ${styles.scheduleItem}
                                                ${isToday ? styles.scheduleItemToday : ''}
                                                ${isCompleted ? styles.scheduleItemCompleted : ''}
                                                ${isFuture ? styles.scheduleItemFuture : ''}
                                            `}
                                        >
                                            <span className={styles.dayBadge}>
                                                {isCompleted && !isToday ? (
                                                    <svg className={styles.checkIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                                        <polyline points="20 6 9 17 4 12"/>
                                                    </svg>
                                                ) : dayNum}
                                            </span>
                                            <span className={styles.schedulePoints}>+{points}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>,
        document.body,
    );
};

export default MembershipSignInResultModal;
