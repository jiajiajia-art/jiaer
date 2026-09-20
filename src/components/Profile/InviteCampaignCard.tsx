import React, { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { HiOutlineGift } from 'react-icons/hi';
import toast from 'react-hot-toast';
import { auth } from '../../api/account/authApi';
import InviteRewardModal from '../InviteRewardModal';
import { useAuthStore } from '../../store/useAuthStore';
import { getApiErrorMessage } from '../../utils/error';
import styles from './InviteCampaignCard.module.css';

const EMPTY_INVITE_STATS = { inviteCount: 0, claimedPoints: 0 };

const InviteCampaignCard: React.FC = () => {
    const { t } = useTranslation();
    const { user, updateUser } = useAuthStore();
    const [isInviteRewardModalOpen, setIsInviteRewardModalOpen] = useState(false);
    const [inputInviteCode, setInputInviteCode] = useState('');
    const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);
    const [inviteStats, setInviteStats] = useState(EMPTY_INVITE_STATS);

    const inviteDisplayCode = user?.user?.inviteCode || '002436';

    const getInviteStats = async () => {
        try {
            const response = await auth.getInviteStats();
            if (response.data.success && response.data.data) {
                const claimedPoints = (response.data.data.rewards || [])
                    .filter((item) => item.claimed)
                    .reduce((sum, item) => sum + item.points, 0);
                setInviteStats({
                    inviteCount: Math.max(0, response.data.data.inviteCount || 0),
                    claimedPoints,
                });
                return;
            }
            setInviteStats(EMPTY_INVITE_STATS);
        } catch {
            setInviteStats(EMPTY_INVITE_STATS);
        }
    };

    const refreshUserInfo = async () => {
        try {
            const response = await auth.getUserInfo();
            if (response.data.success && response.data.data) {
                updateUser(response.data.data);
            }
        } catch (error) {
            console.error('get user info failed:', error);
        }
    };

    useEffect(() => {
        void getInviteStats();
    }, []);

    const handleCopyInviteCode = () => {
        if (!inviteDisplayCode) {
            toast.error(t('profile.noInviteCode'));
            return;
        }
        void navigator.clipboard.writeText(inviteDisplayCode);
        toast.success(t('profile.inviteCodeCopied'));
    };

    const handleSubmitInviteCode = async () => {
        if (!inputInviteCode.trim()) {
            toast.error(t('profile.enterInviteCode'));
            return;
        }
        if (isSubmittingInvite) return;

        try {
            setIsSubmittingInvite(true);
            const response = await auth.useInviteCode({ inviteCode: inputInviteCode });
            if (response.data.success) {
                toast.success(t('profile.inviteCodeSubmitSuccess'));
                setInputInviteCode('');
                void refreshUserInfo();
                void getInviteStats();
            } else {
                toast.error(response.data.message || t('profile.operationFailed'));
            }
        } catch (error: unknown) {
            toast.error(getApiErrorMessage(error, t('profile.submitInviteCodeFailed')));
        } finally {
            setIsSubmittingInvite(false);
        }
    };

    return (
        <>
            <section className={styles.inviteCampaignSection} aria-label={t('profile.inviteCampaignTitle')}>
                <header className={styles.inviteCampaignHeader}>
                    <span className={styles.inviteCampaignGiftIcon} aria-hidden="true">
                        <HiOutlineGift />
                    </span>
                    <h3 className={styles.inviteCampaignTitle}>{t('profile.inviteCampaignTitle')}</h3>
                </header>

                <div className={styles.inviteCampaignFields}>
                    <div className={styles.inviteCampaignCodeTray}>
                        <span className={styles.inviteCampaignCode}>{inviteDisplayCode}</span>
                        <button type="button" className={styles.inviteCampaignCopyBtn} onClick={handleCopyInviteCode}>
                            {t('profile.copyInviteCode')}
                        </button>
                    </div>

                    <div className={styles.inviteCampaignRedeemRow}>
                        <input
                            type="text"
                            className={styles.inviteCampaignRedeemInput}
                            placeholder={t('profile.fillFriendInviteCode')}
                            value={inputInviteCode}
                            onChange={(e) => setInputInviteCode(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    void handleSubmitInviteCode();
                                }
                            }}
                        />
                        <button
                            type="button"
                            className={styles.inviteCampaignRedeemSubmit}
                            onClick={() => {
                                void handleSubmitInviteCode();
                            }}
                            disabled={isSubmittingInvite}
                        >
                            {t('profile.submit')}
                        </button>
                    </div>
                </div>

                <footer className={styles.inviteCampaignFooterRow}>
                    <p className={styles.inviteCampaignMeta}>
                        <Trans
                            i18nKey="profile.inviteStatsText"
                            values={{
                                count: inviteStats.inviteCount,
                                points: inviteStats.claimedPoints,
                            }}
                            components={{
                                count: <span className={styles.inviteCampaignMetaValue} />,
                                points: <span className={styles.inviteCampaignMetaValue} />,
                            }}
                        />
                    </p>
                    <button
                        type="button"
                        className={styles.inviteCampaignRewardBtn}
                        onClick={() => setIsInviteRewardModalOpen(true)}
                    >
                        {t('profile.claimPoints')}
                    </button>
                </footer>
            </section>

            <InviteRewardModal
                isOpen={isInviteRewardModalOpen}
                onClose={() => setIsInviteRewardModalOpen(false)}
                onClaimSuccess={() => {
                    void refreshUserInfo();
                    void getInviteStats();
                }}
            />
        </>
    );
};

export default InviteCampaignCard;
