import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { auth } from '../api/account/authApi';
import type { InviteRewardItem } from '../api/account/auth.type';
import styles from './InviteRewardModal.module.css';

interface InviteRewardModalProps {
    isOpen: boolean;
    onClose: () => void;
    onClaimSuccess?: () => void;
}

interface RewardRowModel {
    rule: InviteRewardItem;
    reached: boolean;
    hasReachedByCount: boolean;
    shouldShowAction: boolean;
    isTenStepRule: boolean;
    progress: number;
    progressNumerator: number;
}

const buildVisibleRewards = (
    sortedRewards: InviteRewardItem[],
    inviteCount: number,
    isPostThirtyStage: boolean
): InviteRewardItem[] => {
    if (!isPostThirtyStage) {
        return sortedRewards.filter((item) => item.threshold <= 30);
    }

    const pendingBaseRewards = sortedRewards.filter(
        (item) => item.threshold <= 30 && !item.claimed
    );
    const dynamicRewards = sortedRewards
        .filter((item) => item.threshold > 30 || item.isDynamic)
        .sort((left, right) => left.threshold - right.threshold);

    const reachedUnclaimedPostRewards = dynamicRewards.filter(
        (item) => !item.claimed && (item.claimable || inviteCount >= item.threshold)
    );
    const inProgressPostReward =
        dynamicRewards.find((item) => !item.claimed && !item.claimable && inviteCount < item.threshold) || null;
    let visiblePostRewards = inProgressPostReward
        ? [...reachedUnclaimedPostRewards, inProgressPostReward]
        : reachedUnclaimedPostRewards;

    // 无论是否有已达成未领取档，都确保展示“下一档进行中进度”
    const nextThreshold = 30 + (Math.floor(Math.max(inviteCount - 30, 0) / 10) + 1) * 10;
    const hasNextThresholdShown = visiblePostRewards.some((item) => item.threshold === nextThreshold);
    if (!hasNextThresholdShown) {
        const fromServerNext = dynamicRewards.find((item) => item.threshold === nextThreshold) || null;
        visiblePostRewards = [
            ...visiblePostRewards,
            fromServerNext || {
                threshold: nextThreshold,
                points: 100,
                claimed: false,
                claimable: false,
                isDynamic: true,
            },
        ];
    }

    return [...pendingBaseRewards, ...visiblePostRewards];
};

const deriveRewardMeta = (visibleRewards: InviteRewardItem[], inviteCount: number) => {
    let nextClaimableRule: InviteRewardItem | null = null;
    let nextLockedRule: InviteRewardItem | null = null;
    let activeInProgressThreshold: number | null = null;

    for (const item of visibleRewards) {
        if (item.claimed) continue;

        if (!nextClaimableRule && item.claimable) {
            nextClaimableRule = item;
        }

        if (!nextLockedRule && !item.claimable) {
            nextLockedRule = item;
        }

        if (
            activeInProgressThreshold === null
            && !item.claimable
            && inviteCount < item.threshold
        ) {
            activeInProgressThreshold = item.threshold;
        }

        if (nextClaimableRule && nextLockedRule && activeInProgressThreshold !== null) {
            break;
        }
    }

    return { nextClaimableRule, nextLockedRule, activeInProgressThreshold };
};

const buildRewardRows = (
    visibleRewards: InviteRewardItem[],
    inviteCount: number,
    isPostThirtyStage: boolean,
    activeInProgressThreshold: number | null
): RewardRowModel[] => (
    visibleRewards.map((rule) => {
        const reached = rule.claimed || rule.claimable;
        const hasReachedByCount = inviteCount >= rule.threshold;
        const isInProgressTier = activeInProgressThreshold === rule.threshold;
        const shouldShowAction = rule.claimed || rule.claimable || hasReachedByCount || isInProgressTier;
        const isTenStepRule = isPostThirtyStage && rule.threshold > 30;
        const progress = isTenStepRule
            ? Math.max(0, Math.min(1, (inviteCount - (rule.threshold - 10)) / 10))
            : Math.max(0, Math.min(1, inviteCount / Math.max(1, rule.threshold)));
        const progressNumerator = isTenStepRule
            ? Math.max(rule.threshold - 10, Math.min(inviteCount, rule.threshold))
            : Math.min(inviteCount, rule.threshold);

        return {
            rule,
            reached,
            hasReachedByCount,
            shouldShowAction,
            isTenStepRule,
            progress,
            progressNumerator,
        };
    })
);

const InviteRewardModal: React.FC<InviteRewardModalProps> = ({
    isOpen,
    onClose,
    onClaimSuccess,
}) => {
    const [isFetching, setIsFetching] = useState(false);
    const [isClaimingThreshold, setIsClaimingThreshold] = useState<number | null>(null);
    const [inviteCount, setInviteCount] = useState(0);
    const [rewards, setRewards] = useState<InviteRewardItem[]>([]);
    const fetchRequestIdRef = useRef(0);
    const isOpenRef = useRef(isOpen);

    useEffect(() => {
        isOpenRef.current = isOpen;
    }, [isOpen]);

    const fetchInviteStats = useCallback(async () => {
        const requestId = ++fetchRequestIdRef.current;
        setIsFetching(true);
        try {
            const response = await auth.getInviteStats();
            if (requestId !== fetchRequestIdRef.current || !isOpenRef.current) return;

            if (response.data.success && response.data.data) {
                setInviteCount(Math.max(0, response.data.data.inviteCount || 0));
                setRewards(response.data.data.rewards || []);
            } else {
                toast.error(response.data.message || '获取邀请进度失败');
            }
        } catch {
            if (requestId !== fetchRequestIdRef.current || !isOpenRef.current) return;
            toast.error('获取邀请进度失败，请稍后重试');
        } finally {
            if (requestId !== fetchRequestIdRef.current) return;
            setIsFetching(false);
        }
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        void fetchInviteStats();
    }, [fetchInviteStats, isOpen]);

    const earnedPoints = useMemo(
        () => rewards.filter((item) => item.claimed).reduce((sum, item) => sum + item.points, 0),
        [rewards]
    );

    const sortedRewards = useMemo(
        () => [...rewards].sort((left, right) => left.threshold - right.threshold),
        [rewards]
    );

    const isPostThirtyStage = inviteCount >= 30;

    const visibleRewards = useMemo(
        () => buildVisibleRewards(sortedRewards, inviteCount, isPostThirtyStage),
        [inviteCount, isPostThirtyStage, sortedRewards]
    );

    const { nextClaimableRule, nextLockedRule, activeInProgressThreshold } = useMemo(
        () => deriveRewardMeta(visibleRewards, inviteCount),
        [inviteCount, visibleRewards]
    );

    const rewardRows = useMemo(
        () => buildRewardRows(visibleRewards, inviteCount, isPostThirtyStage, activeInProgressThreshold),
        [activeInProgressThreshold, inviteCount, isPostThirtyStage, visibleRewards]
    );

    const handleClaimReward = async (threshold: number, claimable: boolean) => {
        if (!claimable || isClaimingThreshold !== null || isFetching) return;
        setIsClaimingThreshold(threshold);
        try {
            const response = await auth.claimInviteReward({ threshold });
            if (response.data.success && response.data.data) {
                toast.success(`领取成功，获得 ${response.data.data.pointsAwarded} 积分`);
                onClaimSuccess?.();
                await fetchInviteStats();
            } else {
                toast.error(response.data.message || '领取失败');
            }
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'response' in error) {
                const axiosError = error as { response?: { data?: { message?: string } } };
                toast.error(axiosError.response?.data?.message || '领取失败，请稍后重试');
            } else {
                toast.error('领取失败，请稍后重试');
            }
        } finally {
            setIsClaimingThreshold(null);
        }
    };

    if (!isOpen) return null;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.content} onClick={(event) => event.stopPropagation()}>
                <button type="button" className={styles.closeButton} onClick={onClose}>
                    ×
                </button>

                <div className={styles.header}>
                    <h3 className={styles.title}>邀请进度</h3>
                    <p className={styles.subtitle}>
                        已邀请 <span className={styles.highlight}>{inviteCount}</span> 人，累计已领取
                        <span className={styles.highlight}> {earnedPoints} </span>
                        积分
                    </p>
                </div>

                <div className={styles.rulesList}>
                    {!isFetching && rewardRows.map((row) => {
                        const {
                            rule,
                            reached,
                            hasReachedByCount,
                            shouldShowAction,
                            isTenStepRule,
                            progress,
                            progressNumerator,
                        } = row;

                        return (
                            <div
                                key={`${rule.threshold}-${rule.points}`}
                                className={`${styles.ruleItem} ${reached ? styles.ruleItemReached : ''}`}
                            >
                                <div className={styles.ruleMain}>
                                    {isTenStepRule ? `邀请达到 ${rule.threshold} 人` : `邀请 ${rule.threshold} 人`}
                                </div>
                                <div className={styles.ruleReward}>+{rule.points} 积分</div>
                                {shouldShowAction && (
                                    <>
                                        {rule.claimed ? (
                                            <span className={`${styles.claimBtn} ${styles.claimBtnDone}`}>已领取</span>
                                        ) : rule.claimable ? (
                                            <button
                                                type="button"
                                                className={`${styles.claimBtn} ${styles.claimBtnReady}`}
                                                disabled={isClaimingThreshold !== null}
                                                onClick={() => {
                                                    void handleClaimReward(rule.threshold, rule.claimable);
                                                }}
                                            >
                                                {isClaimingThreshold === rule.threshold ? '领取中...' : '领取奖励'}
                                            </button>
                                        ) : (
                                            <span className={styles.claimHint}>{hasReachedByCount ? '待领取' : '进行中'}</span>
                                        )}
                                        <div className={styles.ruleProgress}>
                                            <div className={styles.ruleProgressTrack}>
                                                <div
                                                    className={styles.ruleProgressFill}
                                                    style={{ width: `${Math.round(progress * 100)}%` }}
                                                />
                                            </div>
                                            <div className={styles.ruleProgressText}>
                                                {`${progressNumerator}/${rule.threshold}`}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        );
                    })}
                    {isFetching && (
                        <div className={styles.loadingText}>正在加载邀请进度...</div>
                    )}
                    {!isFetching && visibleRewards.length === 0 && (
                        <div className={styles.loadingText}>暂无邀请奖励数据</div>
                    )}
                </div>

                <p className={styles.tipText}>
                    {isPostThirtyStage
                        ? (
                            nextClaimableRule
                                ? (
                                    `已达成本档，可领取 ${nextClaimableRule.points} 积分奖励`
                                )
                                : (
                                    nextLockedRule
                                        ? `再邀请 ${Math.max(0, nextLockedRule.threshold - inviteCount)} 人可领取 +${nextLockedRule.points} 积分`
                                        : '已达成全部邀请奖励档位'
                                )
                        )
                        : (
                            nextLockedRule
                                ? `再邀请 ${Math.max(0, nextLockedRule.threshold - inviteCount)} 人可解锁下一档奖励`
                                : '已达成全部邀请奖励档位'
                        )}
                </p>
            </div>
        </div>
    );
};

export default InviteRewardModal;
