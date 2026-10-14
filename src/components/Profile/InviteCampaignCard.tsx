import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HiOutlineGift } from 'react-icons/hi';
import toast from 'react-hot-toast';
import { auth } from '../../api/account/authApi';
import { useAuthStore } from '../../store/useAuthStore';
import { getApiErrorMessage } from '../../utils/error';
import styles from './InviteCampaignCard.module.css';

const InviteCampaignCard: React.FC = () => {
    const { t } = useTranslation();
    const { user, updateUser } = useAuthStore();
    const [inputInviteCode, setInputInviteCode] = useState('');
    const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);

    const inviteDisplayCode = user?.user?.inviteCode || '002436';

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
        </section>
    );
};

export default InviteCampaignCard;
