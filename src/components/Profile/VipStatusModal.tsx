import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { MembershipPlanState, MembershipState } from '../../api/account/auth.type';
import {
    formatMembershipDateTime,
    formatRemainingMembershipTime,
    resolveMembershipPlanStatus,
    type MembershipPlanDisplayStatus,
} from '../../lib/membershipStatus';
import styles from './VipStatusModal.module.css';

interface VipStatusModalProps {
    isOpen: boolean;
    membership?: MembershipState | null;
    onClose: () => void;
    onPurchase: () => void;
}

interface MembershipPlanCardConfig {
    key: 'week' | 'month';
    name: string;
    plan: MembershipPlanState | null | undefined;
    rewards: string[];
}

const STATUS_LABELS: Record<MembershipPlanDisplayStatus, string> = {
    active: '生效中',
    expired: '已到期',
    inactive: '未开通',
};

const VipStatusModal: React.FC<VipStatusModalProps> = ({
    isOpen,
    membership,
    onClose,
    onPurchase,
}) => {
    const [selectedPlanKey, setSelectedPlanKey] = React.useState<'week' | 'month'>('week');

    useEffect(() => {
        if (!isOpen) return undefined;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    const now = Date.now();
    const plans: MembershipPlanCardConfig[] = [
        {
            key: 'week',
            name: '周卡',
            plan: membership?.week,
            rewards: [
                '每日签到额外领取 77 永久KK币，第 7 天领取 78 币',
                '7 天累计可领取 540 永久KK币',
                '正式发布的 AI 文游游玩扣费享 85 折',
            ],
        },
        {
            key: 'month',
            name: '月卡',
            plan: membership?.month,
            rewards: [
                '每日签到额外领取 66 永久KK币，第 30 天领取 86 币',
                '30 天累计可领取 2,000 永久KK币',
                '正式发布的 AI 文游游玩扣费享 85 折',
            ],
        },
    ];
    const selectedPlan = plans.find((item) => item.key === selectedPlanKey) || plans[0];

    useEffect(() => {
        if (!isOpen) return;
        const currentTime = Date.now();
        if (resolveMembershipPlanStatus(membership?.week, currentTime) === 'active') {
            setSelectedPlanKey('week');
            return;
        }
        setSelectedPlanKey(
            resolveMembershipPlanStatus(membership?.month, currentTime) === 'active' ? 'month' : 'week',
        );
    }, [isOpen, membership?.month, membership?.week]);

    if (!isOpen) return null;

    return createPortal(
        <div className={styles.overlay} onClick={onClose}>
            <section
                className={styles.modal}
                role="dialog"
                aria-modal="true"
                aria-labelledby="vip-status-title"
                onClick={(event) => event.stopPropagation()}
            >
                <header className={styles.header}>
                    <div>
                        <span className={styles.vipMark}>VIP</span>
                        <h2 id="vip-status-title">我的会员</h2>
                    </div>
                    <button type="button" className={styles.closeButton} onClick={onClose} aria-label="关闭">
                        <span aria-hidden="true" />
                    </button>
                </header>

                <div className={styles.planTabs} role="group" aria-label="会员卡类型">
                    {plans.map((item) => (
                        <button
                            key={item.key}
                            type="button"
                            className={`${styles.planTab} ${selectedPlanKey === item.key ? styles.planTabSelected : ''}`}
                            aria-pressed={selectedPlanKey === item.key}
                            onClick={() => setSelectedPlanKey(item.key)}
                        >
                            {item.name}
                        </button>
                    ))}
                </div>

                {(() => {
                    const status = resolveMembershipPlanStatus(selectedPlan.plan, now);
                    return (
                        <article className={`${styles.planCard} ${status === 'active' ? styles.planCardActive : ''}`}>
                            <div className={styles.planHeader}>
                                <h3>{selectedPlan.name}</h3>
                                <span className={`${styles.statusBadge} ${styles[`status_${status}`]}`}>
                                    {STATUS_LABELS[status]}
                                </span>
                            </div>

                            <dl className={styles.timeList}>
                                <div>
                                    <dt>生效时间</dt>
                                    <dd>{formatMembershipDateTime(selectedPlan.plan?.startAt)}</dd>
                                </div>
                                <div>
                                    <dt>到期时间</dt>
                                    <dd>{formatMembershipDateTime(selectedPlan.plan?.endAt)}</dd>
                                </div>
                                <div>
                                    <dt>剩余时长</dt>
                                    <dd>{status === 'active' ? formatRemainingMembershipTime(selectedPlan.plan?.endAt, now) : '—'}</dd>
                                </div>
                            </dl>

                            <div className={styles.benefits}>
                                <strong>会员福利</strong>
                                <ul>
                                    {selectedPlan.rewards.map((reward) => <li key={reward}>{reward}</li>)}
                                </ul>
                            </div>
                        </article>
                    );
                })()}

                <p className={styles.sharedNote}>
                    周卡与月卡可同时生效并分别领取奖励；同档位重复购买会顺延有效期。
                </p>

                <button type="button" className={styles.purchaseButton} onClick={onPurchase}>
                    购买/续费会员卡
                </button>
            </section>
        </div>,
        document.body,
    );
};

export default VipStatusModal;
