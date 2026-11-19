import React, { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
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
    tagline: string;
    total: string;
    rewards: string[];
}

const VipStatusModal: React.FC<VipStatusModalProps> = ({
    isOpen,
    membership,
    onClose,
    onPurchase,
}) => {
    const { t, i18n } = useTranslation();
    const [selectedPlanKey, setSelectedPlanKey] = React.useState<'week' | 'month'>('week');
    const locale = i18n.resolvedLanguage || i18n.language || 'zh';

    useEffect(() => {
        if (!isOpen) return undefined;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    const now = Date.now();
    const statusLabels = useMemo<Record<MembershipPlanDisplayStatus, string>>(() => ({
        active: t('profile.vipStatus.statusActive'),
        expired: t('profile.vipStatus.statusExpired'),
        inactive: t('profile.vipStatus.statusInactive'),
    }), [t]);

    const plans: MembershipPlanCardConfig[] = useMemo(() => ([
        {
            key: 'week',
            name: t('profile.vipStatus.week'),
            plan: membership?.week,
            tagline: t('profile.vipStatus.weekTagline'),
            total: '540',
            rewards: [
                t('profile.vipStatus.weekReward1'),
                t('profile.vipStatus.weekReward2'),
                t('profile.vipStatus.weekReward3'),
            ],
        },
        {
            key: 'month',
            name: t('profile.vipStatus.month'),
            plan: membership?.month,
            tagline: t('profile.vipStatus.monthTagline'),
            total: '2,000',
            rewards: [
                t('profile.vipStatus.monthReward1'),
                t('profile.vipStatus.monthReward2'),
                t('profile.vipStatus.monthReward3'),
            ],
        },
    ]), [membership?.month, membership?.week, t]);
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
                        <span className={styles.vipMark}>{t('profile.vip')}</span>
                        <h2 id="vip-status-title">{t('profile.vipStatus.title')}</h2>
                    </div>
                    <button
                        type="button"
                        className={styles.closeButton}
                        onClick={onClose}
                        aria-label={t('common.close')}
                    >
                        <span aria-hidden="true" />
                    </button>
                </header>

                <div className={styles.planTabs} role="group" aria-label={t('profile.vipStatus.planTypeAria')}>
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
                        <>
                            <article className={`${styles.hero} ${status === 'active' ? styles.heroActive : ''}`}>
                                <div className={styles.heroTop}>
                                    <div>
                                        <p className={styles.heroEyebrow}>{selectedPlan.tagline}</p>
                                        <h3>{t('profile.vipStatus.memberTitle', { name: selectedPlan.name })}</h3>
                                    </div>
                                    <span className={`${styles.statusBadge} ${styles[`status_${status}`]}`}>
                                        <i aria-hidden="true" />
                                        {statusLabels[status]}
                                    </span>
                                </div>
                                <p className={styles.heroValue}>
                                    {t('profile.vipStatus.totalClaimablePrefix')}{' '}
                                    <strong>{selectedPlan.total}</strong>{' '}
                                    {t('profile.vipStatus.totalClaimableSuffix')}
                                </p>
                                <dl className={styles.timeGrid}>
                                    <div>
                                        <dt>{t('profile.vipStatus.effectiveTime')}</dt>
                                        <dd>{formatMembershipDateTime(selectedPlan.plan?.startAt, locale)}</dd>
                                    </div>
                                    <div>
                                        <dt>{t('profile.vipStatus.expiryTime')}</dt>
                                        <dd>{formatMembershipDateTime(selectedPlan.plan?.endAt, locale)}</dd>
                                    </div>
                                    <div>
                                        <dt>{t('profile.vipStatus.remainingTime')}</dt>
                                        <dd>
                                            {status === 'active'
                                                ? formatRemainingMembershipTime(selectedPlan.plan?.endAt, now, {
                                                    zero: t('profile.vipStatus.remainingZero'),
                                                    lessThanHour: t('profile.vipStatus.remainingLessThanHour'),
                                                    daysHours: (days, hours) => t('profile.vipStatus.remainingDaysHours', { days, hours }),
                                                })
                                                : t('profile.vipStatus.emDash')}
                                        </dd>
                                    </div>
                                </dl>
                            </article>

                            <section className={styles.benefits}>
                                <h4>{t('profile.vipStatus.benefits')}</h4>
                                <ul>
                                    {selectedPlan.rewards.map((reward) => (
                                        <li key={reward}>
                                            <span className={styles.check} aria-hidden="true">
                                                <svg viewBox="0 0 16 16" width="12" height="12"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                            </span>
                                            {reward}
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        </>
                    );
                })()}

                <p className={styles.sharedNote}>
                    {t('profile.vipStatus.sharedNote')}
                </p>

                <button type="button" className={styles.purchaseButton} onClick={onPurchase}>
                    {resolveMembershipPlanStatus(selectedPlan.plan, now) === 'active'
                        ? t('profile.vipStatus.renew', { name: selectedPlan.name })
                        : t('profile.vipStatus.activate', { name: selectedPlan.name })}
                </button>
            </section>
        </div>,
        document.body,
    );
};

export default VipStatusModal;
