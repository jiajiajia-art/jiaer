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

const DailyTasksModal: React.FC<DailyTasksModalProps> = ({ isOpen, onClose }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { updateUser } = useAuthStore();
    const [, setTaskNowTick] = React.useState<number>(Date.now());

    const {
        tasks: dailyTasks,
        isLoadedOnce: isTaskLoadedOnce,
        isLoading: isTaskLoading,
        errorMessage: taskErrorMessage,
        taskActionLoadingMap,
        refreshDailyTasks,
        acceptDailyTask,
        claimDailyTask,
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
        getDisplayTotalSeconds: state.getDisplayTotalSeconds,
    })));

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
            <div className={styles.dailyTaskModal} onClick={(e) => e.stopPropagation()}>
                <button
                    type="button"
                    className={styles.dailyTaskCloseBtn}
                    aria-label={t('profile.closeDailyTasks')}
                    onClick={onClose}
                >
                    <span className={styles.dailyTaskCloseIcon} aria-hidden="true" />
                </button>
                <div className={styles.dailyTaskModalHeader}>
                    <div className={styles.dailyTaskModalTitle}>{t('profile.tasksTitle')}</div>
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
                {hasDurationTaskFallback && (
                    <div className={styles.dailyTaskHint}>{t('profile.tasksTip')}</div>
                )}
            </div>
        </div>
    );
};

export default DailyTasksModal;
