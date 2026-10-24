import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HiOutlineGift } from 'react-icons/hi';
import { MdHelpOutline } from 'react-icons/md';
import toast from 'react-hot-toast';
import { auth } from '../../api/account/authApi';
import { useAuthStore } from '../../store/useAuthStore';
import { copyTextToClipboard } from '../../utils/clipboard';
import { getApiErrorMessage } from '../../utils/error';
import { formatKk } from '../../utils/kkMoney';
import InviteInstructionsModal from './InviteInstructionsModal';
import styles from './InviteCampaignCard.module.css';

const InviteCampaignCard: React.FC = () => {
    const { t } = useTranslation();
    const { user, updateUser } = useAuthStore();
    const [inputInviteCode, setInputInviteCode] = useState('');
    const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);
    const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);

    const inviteCode = user?.user?.inviteCode || '';
    const inviteDisplayCode = inviteCode || '--';
    const inviteCount = user?.user?.inviteStats?.inviteCount ?? 0;
    const rewardedLimitedKk = user?.user?.inviteStats?.rewardedLimitedKk ?? 0;
    const inviteRewardKk = user?.user?.platformBenefits?.inviteRewardKk ?? 15;

    const refreshUserInfo = useCallback(async () => {
        try {
            const response = await auth.getUserInfo();
            if (response.data.success && response.data.data) {
                updateUser(response.data.data);
            }
        } catch (error) {
            console.error('get user info failed:', error);
        }
    }, [updateUser]);

    useEffect(() => {
        void refreshUserInfo();
    }, [refreshUserInfo]);

    const handleCopyInviteCode = async () => {
        if (!inviteCode) {
            toast.error(t('profile.noInviteCode'));
            return;
        }
        try {
            await copyTextToClipboard(inviteCode);
            toast.success(t('profile.inviteCodeCopied'));
        } catch (error) {
            console.error('copy invite code failed:', error);
            toast.error(t('profile.copyFailed'));
        }
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
                const awardedAmount = response.data.data?.diamondsAdded ?? inviteRewardKk;
                toast.success(t('profile.inviteCodeSubmitSuccess', { amount: formatKk(awardedAmount) }));
                setInputInviteCode('');
                void refreshUserInfo();
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
        <section
            className={styles.inviteCampaignSection}
            aria-label={t('profile.inviteCampaignTitle', { amount: formatKk(inviteRewardKk) })}
        >
            <header className={styles.inviteCampaignHeader}>
                <span className={styles.inviteCampaignGiftIcon} aria-hidden="true">
                    <HiOutlineGift />
                </span>
                <h3 className={styles.inviteCampaignTitle}>
                    {t('profile.inviteCampaignTitle', { amount: formatKk(inviteRewardKk) })}
                </h3>
                <button
                    type="button"
                    className={styles.inviteCampaignHelpButton}
                    onClick={() => setIsInstructionsOpen(true)}
                    aria-label={t('profile.inviteInstructionsTitle')}
                >
                    <MdHelpOutline aria-hidden="true" />
                </button>
            </header>

            <div className={styles.inviteCampaignFields}>
                <div className={styles.inviteCampaignCodeTray}>
                    <div className={styles.inviteCampaignCodeContent}>
                        <span className={styles.inviteCampaignFieldLabel}>{t('profile.myInviteCodeLabel')}</span>
                        <span className={styles.inviteCampaignCode}>{inviteDisplayCode}</span>
                    </div>
                    <button type="button" className={styles.inviteCampaignCopyBtn} onClick={handleCopyInviteCode}>
                        {t('profile.copyInviteCode')}
                    </button>
                </div>

                <div className={styles.inviteCampaignRedeemRow}>
                    <label className={styles.inviteCampaignInputContent}>
                        <span className={styles.inviteCampaignFieldLabel}>{t('profile.friendInviteCodeLabel')}</span>
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
                    </label>
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

            <div className={styles.inviteCampaignStats}>
                <span>{t('profile.invitedPrefix')}</span>
                <strong>{inviteCount}</strong>
                <span>{t('profile.peopleUnit')}</span>
                <span className={styles.inviteCampaignStatsDivider}>·</span>
                <span>{t('profile.rewardedPrefix')}</span>
                <strong>{formatKk(rewardedLimitedKk)}</strong>
                <span>{t('profile.limitedKkRewardSuffix')}</span>
            </div>

            <InviteInstructionsModal
                isOpen={isInstructionsOpen}
                onClose={() => setIsInstructionsOpen(false)}
                inviteRewardKk={inviteRewardKk}
            />
        </section>
    );
};

export default InviteCampaignCard;
