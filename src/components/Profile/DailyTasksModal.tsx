import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import styles from '../../page/Profile.module.css';
import { useAuthStore } from '../../store/useAuthStore';
import { auth } from '../../api/account/authApi';
import { useDailyTaskStore } from '../../store/dailyTaskStore';
import {
    isDynamicDailyTask,
    isDynamicDurationDailyTask,
    isDynamicPromotionDailyTask,
    isDurationTaskCode,
} from '../../api/statistics/dailyTask.type';
import { buildGamePromotionLink } from '../../utils/gamePromotionLink';
import type { User } from '../../api/account/auth.type';

const formatDuration = (totalSeconds: number): string => {
    const safe = Math.max(0, Math.floor(totalSeconds));
    const minutes = Math.floor(safe / 60);
    const seconds = safe % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const getTaskActionText = (
    task: {
        code: string;
        taskKind?: string;
        gameTitle?: string;
        gameFileId?: string;
    },
    t: (key: string, options?: Record<string, unknown>) => string,
): string => {
    if (isDynamicPromotionDailyTask(task)) return '复制推广链接';
    if (task.code === 'like_once') return t('profile.taskGoLike');
    if (task.code === 'play_3_unique' || task.code === 'play_three_games') return t('profile.taskGoPlay');
    if (task.gameTitle) return t('profile.taskGoPlaySpecific', { gameTitle: task.gameTitle });
    return t('profile.taskInProgress');
};

const isTaskPlayable = (task: { code: string; taskKind?: string; gameFileId?: string }): boolean => {
    if (isDynamicPromotionDailyTask(task)) return false;
    if (task.gameFileId) return true;
    if (task.code === 'play_3_unique' || task.code === 'play_three_games') return true;
    return false;
};

const copyPromotionLink = async (link: string) => {
    try {
        await navigator.clipboard.writeText(link);
        toast.success('推广链接已复制');
    } catch (error) {
        console.error('copy promotion link failed:', error);
        toast.error('复制失败，请手动复制链接');
    }
};

type DailyTasksModalProps = {
    isOpen: boolean;
    onClose: () => void;
};

const DAILY_TASK_FOCUSABLE_SELECTOR = [
    'button:not([disabled])',
    'a[href]',
    'input:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(',');

const DailyTasksModal: React.FC<DailyTasksModalProps> = ({ isOpen, onClose }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { updateUser } = useAuthStore();
    const [, setTaskNowTick] = React.useState<number>(Date.now());
    const dailyTaskModalRef = React.useRef<HTMLDivElement | null>(null);
    const dailyTaskCloseRef = React.useRef<HTMLButtonElement | null>(null);
    const previousFocusRef = React.useRef<HTMLElement | null>(null);

    const {
        tasks: dailyTasks,
        isLoadedOnce: isTaskLoadedOnce,
        isLoading: isTaskLoading,
        errorMessage: taskErrorMessage,
        taskActionLoadingMap,
        refreshDailyTasks,
        acceptDailyTask,
        claimDailyTask,
        claimMakeupCard,
        makeupCardReward,
        isClaimingMakeupCard,
        getDisplayTotalSeconds,
    } = useDailyTaskStore(useShallow((state) => ({
        tasks: state.tasks,
        isLoadedOnce: state.isLoadedOnce,
        isLoading: state.isLoading,
        errorMessage: state.errorMessage,
        taskActionLoadingMap: state.taskActionLoadingMap,
        refreshDailyTasks: state.refreshDailyTasks,
        acceptDailyTask: state.acceptDailyTask,
        claimDailyTask: state.claimDailyTask,
        claimMakeupCard: state.claimMakeupCard,
        makeupCardReward: state.makeupCardReward,
        isClaimingMakeupCard: state.isClaimingMakeupCard,
        getDisplayTotalSeconds: state.getDisplayTotalSeconds,
    })));

    useEffect(() => {
        if (!isOpen) return;
        previousFocusRef.current = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        const frame = window.requestAnimationFrame(() => dailyTaskCloseRef.current?.focus());
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
                return;
            }
            if (event.key !== 'Tab' || !dailyTaskModalRef.current) return;
            const focusable = Array.from(
                dailyTaskModalRef.current.querySelectorAll<HTMLElement>(DAILY_TASK_FOCUSABLE_SELECTOR),
            );
            if (!focusable.length) {
                event.preventDefault();
                dailyTaskModalRef.current.focus();
                return;
            }
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            window.cancelAnimationFrame(frame);
            document.removeEventListener('keydown', handleKeyDown);
            previousFocusRef.current?.focus();
        };
    }, [isOpen, onClose]);

    useEffect(() => {
        if (!isOpen) return;
        const intervalId = window.setInterval(() => {
            setTaskNowTick(Date.now());
        }, 1000);
        return () => {
            window.clearInterval(intervalId);
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const handleVisibilityChange = () => {
            if (!document.hidden) {
                void refreshDailyTasks({ silent: true });
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [isOpen, refreshDailyTasks]);

    if (!isOpen) return null;

    const getUserInfo = async () => {
        try {
            const response = await auth.getUserInfo();
            if (response.data.success && response.data.data) {
                updateUser(response.data.data as User);
            }
        } catch (error) {
            console.error('get user info failed:', error);
        }
    };

    const handleAcceptTask = async (task: Parameters<typeof acceptDailyTask>[0]) => {
        const result = await acceptDailyTask(task);
        if (!result.success) {
            toast.error(result.message || t('profile.taskAcceptFailed'));
            return;
        }
        toast.success(t('profile.taskAcceptSuccess'));
    };

    const handleClaimTask = async (task: Parameters<typeof claimDailyTask>[0]) => {
        const result = await claimDailyTask(task);
        if (!result.success) {
            toast.error(result.message || t('profile.rewardClaimFailed'));
            return;
        }
        toast.success(t('profile.rewardClaimSuccess'));
        await getUserInfo();
    };

    const handleClaimMakeupCard = async () => {
        const result = await claimMakeupCard();
        if (!result.success) {
            toast.error(result.message || t('profile.makeupCardClaimFailed'));
            return;
        }
        toast.success(result.message || t('profile.makeupCardClaimSuccess'));
    };

    const displayTotalSeconds = getDisplayTotalSeconds();
    const durationTaskMap = new Map(
        dailyTasks.filter((task) => isDurationTaskCode(task.code)).map((task) => [task.code, task]),
    );
    const tenMinuteTask = durationTaskMap.get('online_10m');
    const thirtyMinuteTask = durationTaskMap.get('online_30m');
    const hasDurationTaskFallback = !tenMinuteTask || !thirtyMinuteTask;
    const claimableTaskCount = dailyTasks.filter(
        (task) => Boolean(task.claimRequest) && task.claimable && !task.claimed,
    ).length;
    const completedTaskCount = dailyTasks.filter((task) => task.completed || task.claimed).length;

    return (
        <div className={styles.dailyTaskModalOverlay} onClick={onClose}>
            <div
                ref={dailyTaskModalRef}
                className={styles.dailyTaskModal}
                role="dialog"
                aria-modal="true"
                aria-labelledby="daily-task-dialog-title"
                tabIndex={-1}
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    ref={dailyTaskCloseRef}
                    type="button"
                    className={styles.dailyTaskCloseBtn}
                    aria-label={t('profile.closeDailyTasks')}
                    onClick={onClose}
                >
                    <span className={styles.dailyTaskCloseIcon} aria-hidden="true" />
                </button>
                <div className={styles.dailyTaskModalHeader}>
                    <div id="daily-task-dialog-title" className={styles.dailyTaskModalTitle}>{t('profile.tasksTitle')}</div>
                    {isTaskLoadedOnce && dailyTasks.length > 0 && (
                        <p className={styles.dailyTaskSummary}>
                            {t('profile.tasksSummary', {
                                claimable: claimableTaskCount,
                                completed: completedTaskCount,
                                total: dailyTasks.length,
                            })}
                        </p>
                    )}
                </div>
                {!isTaskLoadedOnce && isTaskLoading && (
                    <div className={styles.dailyTaskLoading}>{t('profile.tasksLoading')}</div>
                )}
                {taskErrorMessage && (
                    <div className={styles.dailyTaskError}>{taskErrorMessage}</div>
                )}
                <div className={styles.dailyTaskList}>
                    {dailyTasks.map((task) => {
                        const isFixedDurationTask = isDurationTaskCode(task.code);
                        const isDynamicDurationTask = isDynamicDurationDailyTask(task);
                        const isDynamicPromotionTask = isDynamicPromotionDailyTask(task);
                        const isDynamicTask = isDynamicDailyTask(task);
                        const canCopyPromotionLink = isDynamicPromotionTask
                            && task.accepted
                            && Boolean(task.promotionCode)
                            && Boolean(task.gameFileId);
                        const isTaskActionLoading = Boolean(taskActionLoadingMap[task.key]);
                        const canClaimNow = Boolean(task.claimRequest) && task.claimable && !task.claimed;
                        const canAcceptNow = isDynamicTask && task.acceptRequired && !task.accepted && !task.claimed;
                        const effectiveProgress = isFixedDurationTask
                            ? Math.max(task.progress, displayTotalSeconds)
                            : task.progress;
                        const progressDenominator = Math.max(task.target, 1);
                        const progressRatio = Math.min(1, Math.max(0, effectiveProgress / progressDenominator));
                        const progressPercent = Math.round(progressRatio * 100);
                        const progressText = isFixedDurationTask
                            ? `${formatDuration(Math.min(effectiveProgress, task.target))} / ${formatDuration(task.target)}`
                            : isDynamicDurationTask
                                ? `${formatDuration(Math.min(effectiveProgress, task.target))} / ${formatDuration(task.target)}`
                                : `${Math.min(effectiveProgress, task.target)}/${task.target}`;
                        const showProgressBar = progressRatio > 0 && !task.claimed;

                        const itemClassName = [
                            styles.dailyTaskItem,
                            task.claimed ? styles.dailyTaskItemClaimed : '',
                        ].filter(Boolean).join(' ');

                        return (
                            <div key={task.key} className={itemClassName}>
                                <div className={styles.dailyTaskItemHeader}>
                                    <div className={styles.dailyTaskItemTitle}>
                                        {task.titleKey ? t(task.titleKey) : task.title}
                                    </div>
                                    <div className={styles.dailyTaskReward}>+{task.rewardPoints}{t('profile.points')}</div>
                                </div>
                                {task.description && (
                                    <div className={styles.dailyTaskDescription}>{task.description}</div>
                                )}
                                <div className={styles.dailyTaskFooter}>
                                    <div className={styles.dailyTaskProgressBlock}>
                                        {showProgressBar && (
                                            <div className={styles.dailyTaskProgressBar}>
                                                <div
                                                    className={styles.dailyTaskProgressFill}
                                                    style={{ width: `${progressPercent}%` }}
                                                />
                                            </div>
                                        )}
                                        <div className={styles.dailyTaskProgressText}>{progressText}</div>
                                    </div>
                                    <div className={styles.dailyTaskActionSlot}>
                                        {canCopyPromotionLink && task.promotionCode && task.gameFileId && (
                                            <button
                                                type="button"
                                                className={styles.dailyTaskSecondaryBtn}
                                                onClick={() => {
                                                    void copyPromotionLink(
                                                        buildGamePromotionLink(task.gameFileId!, task.promotionCode!),
                                                    );
                                                }}
                                            >
                                                {t('profile.copyPromotionLink')}
                                            </button>
                                        )}
                                        {canAcceptNow && (
                                            <button
                                                type="button"
                                                className={styles.dailyTaskPrimaryBtn}
                                                disabled={isTaskActionLoading}
                                                onClick={() => {
                                                    if (typeof task.taskId === 'number') {
                                                        void handleAcceptTask({
                                                            key: task.key,
                                                            taskId: task.taskId,
                                                        });
                                                    }
                                                }}
                                            >
                                                {isTaskActionLoading ? t('profile.claiming') : t('profile.taskAccept')}
                                            </button>
                                        )}
                                        {canClaimNow && (
                                            <button
                                                type="button"
                                                className={styles.dailyTaskPrimaryBtn}
                                                disabled={isTaskActionLoading}
                                                onClick={() => {
                                                    void handleClaimTask({
                                                        key: task.key,
                                                        claimRequest: task.claimRequest,
                                                    });
                                                }}
                                            >
                                                {isTaskActionLoading ? t('profile.claiming') : t('profile.taskClaimReward')}
                                            </button>
                                        )}
                                        {task.claimed && (
                                            <span className={styles.dailyTaskDoneLabel}>{t('profile.rewardClaimed')}</span>
                                        )}
                                        {!canAcceptNow && !canClaimNow && !task.claimed && !canCopyPromotionLink && (
                                            isTaskPlayable(task) ? (
                                                <button
                                                    type="button"
                                                    className={styles.dailyTaskSecondaryBtn}
                                                    onClick={() => {
                                                        if (task.code === 'play_3_unique' || task.code === 'play_three_games') {
                                                            navigate('/');
                                                            return;
                                                        }
                                                        const targetGameFileId = task.gameFileId || task.key.replace(/^(play_specific_game_\d+_|config_\d+_)/, '');
                                                        navigate(`/game/${targetGameFileId}?source=history`);
                                                    }}
                                                >
                                                    {getTaskActionText(task, t)}
                                                </button>
                                            ) : (
                                                <span className={styles.dailyTaskDoneLabel}>{getTaskActionText(task, t)}</span>
                                            )
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <section
                    className={`${styles.makeupCardReward} ${makeupCardReward.claimable ? styles.makeupCardRewardReady : ''}`}
                    aria-label={t('profile.makeupCardRewardTitle')}
                >
                    <div className={styles.makeupCardRewardHeader}>
                        <div>
                            <strong>{t('profile.makeupCardRewardTitle')}</strong>
                            <span>{t('profile.makeupCardRewardRule')}</span>
                        </div>
                        <b>{makeupCardReward.current}/{makeupCardReward.target}</b>
                    </div>
                    <div className={styles.makeupCardProgress} aria-hidden="true">
                        <span
                            style={{
                                width: `${Math.min(100, Math.round((makeupCardReward.current / makeupCardReward.target) * 100))}%`,
                            }}
                        />
                    </div>
                    <button
                        type="button"
                        className={styles.makeupCardClaimButton}
                        disabled={!makeupCardReward.claimable || makeupCardReward.claimed || isClaimingMakeupCard}
                        onClick={() => void handleClaimMakeupCard()}
                    >
                        {makeupCardReward.claimed
                            ? t('profile.makeupCardClaimed')
                            : isClaimingMakeupCard
                                ? t('profile.claiming')
                                : t('profile.makeupCardClaim')}
                    </button>
                </section>
                {hasDurationTaskFallback && (
                    <div className={styles.dailyTaskHint}>{t('profile.tasksTip')}</div>
                )}
            </div>
        </div>
    );
};

export default DailyTasksModal;
