import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import styles from '../../page/Profile.module.css';
import { authModalStore, useAuthStore } from '../../store/useAuthStore';
import { auth } from '../../api/account/authApi';
import MembershipRedeemResultModal from '../../components/MembershipRedeemResultModal';
import ConfirmModal from '../CommonModal/ConfirmModal';
import DeleteAccountModal from './DeleteAccountModal';
import { RiLogoutCircleRLine } from 'react-icons/ri';
import {
    MdOutlineCardMembership,
    MdOutlineCampaign,
    MdOutlineWarehouse,
    MdOutlineLock,
    MdOutlineManageAccounts,
    MdOutlinePersonOff,
    MdOutlinePlayCircle,
    MdOutlineReceiptLong,
} from 'react-icons/md';
import toast from 'react-hot-toast';
import type { SubscriptionRedeemResult, User } from '../../api/account/auth.type';
import type { SubscriptionPlanId } from '../../api/subscriptionKeys/subscriptionKeysApi.type';
import { getApiErrorMessage } from '../../utils/error';
import {
    hasCurrentHostLoginAgreementAccepted,
    hasCurrentLoginAgreementAccepted,
    markLoginAgreementAccepted,
    REGISTRATION_AGREEMENT_VERSION,
    REGISTRATION_PRIVACY_POLICY_VERSION,
} from '../../lib/registrationAgreement';
import { notifyMiniProgramLoginAgreementRequired } from '../../lib/miniProgramLoginAgreement';

const isWebViewEnv = (): boolean => {
    const win = window as unknown as Record<string, unknown>;
    return String(win.__wxjs_environment ?? '').toLowerCase() === 'miniprogram';
};

const maskPhoneNumber = (phone?: string): string => {
    if (!phone || phone.length < 7) return phone ?? '';
    return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
};

const ProfileFunctionPanel: React.FC = () => {
    const { t } = useTranslation();
    const { user, logout, updateUser, login } = useAuthStore();
    const navigate = useNavigate();
    const [showRedeemInput, setShowRedeemInput] = useState(false);
    const [redeemKey, setRedeemKey] = useState('');
    const [isRedeemingMembership, setIsRedeemingMembership] = useState(false);
    const [redeemSuccessPlanId, setRedeemSuccessPlanId] = useState<SubscriptionRedeemResult['planId'] | null>(null);

    const [isBindAccountModalOpen, setIsBindAccountModalOpen] = useState(false);
    const [bindPhone, setBindPhone] = useState('');
    const [bindPassword, setBindPassword] = useState('');
    const [bindConfirmPassword, setBindConfirmPassword] = useState('');
    const [isBindingAccount, setIsBindingAccount] = useState(false);
    const [isBindAccountStatusModalOpen, setIsBindAccountStatusModalOpen] = useState(false);
    // 功能注释：注销账户两步确认——先简确认，再重要提醒二次弹窗
    const [isDeleteAccountFirstOpen, setIsDeleteAccountFirstOpen] = useState(false);
    const [isDeleteAccountWarningOpen, setIsDeleteAccountWarningOpen] = useState(false);
    const [isDeletingAccount, setIsDeletingAccount] = useState(false);

    const [searchParams, setSearchParams] = useSearchParams();
    const handleLogout = () => {
        logout();
        navigate('/home');
    };

    /** 功能注释：二次确认通过后调用注销接口，成功则清本地会话并回首页 */
    const handleDeleteAccountConfirm = async () => {
        if (isDeletingAccount) return;
        setIsDeletingAccount(true);
        try {
            const response = await auth.deleteAccount();
            if (!response.data.success) {
                toast.error(response.data.message || t('profile.deleteAccount.failed'));
                return;
            }
            toast.success(t('profile.deleteAccount.success'));
            setIsDeleteAccountWarningOpen(false);
            logout();
            navigate('/home');
        } catch (error) {
            console.error('delete account failed:', error);
            toast.error(getApiErrorMessage(error, t('profile.deleteAccount.failed')));
        } finally {
            setIsDeletingAccount(false);
        }
    };

    const getUserInfo = async () => {
        try {
            const response = await auth.getUserInfo();
            if (response.data.success && response.data.data) {
                const userData: User = response.data.data;
                updateUser(userData);
            }
        } catch (error) {
            console.error('get user info failed:', error);
        }
    };

    useEffect(() => {
        void getUserInfo();
    }, []);

    const handleRedeemMembership = async () => {
        const key = redeemKey.trim().toUpperCase();
        if (!key) {
            toast.error(t('profile.enterRedeemCode'));
            return;
        }

        try {
            setIsRedeemingMembership(true);
            const response = await auth.redeemSubscriptionKey({ redeemKey: key });
            if (response.data.success && response.data.data) {
                const result = response.data.data;
                setRedeemKey('');
                setShowRedeemInput(false);
                setRedeemSuccessPlanId(result.planId as SubscriptionPlanId);
                const userRes = await auth.getUserInfo();
                if (userRes.data.success && userRes.data.data) {
                    updateUser(userRes.data.data);
                }
            } else {
                toast.error(response.data.message || t('profile.redeemFailed'));
            }
        } catch (error: unknown) {
            toast.error(getApiErrorMessage(error, t('profile.redeemFailed')));
        } finally {
            setIsRedeemingMembership(false);
        }
    };

    const clearBindAccountDraft = () => {
        setBindPhone('');
        setBindPassword('');
        setBindConfirmPassword('');
    };

    const handleOpenBindAccountModal = () => {
        if (user?.user?.phoneNumber) {
            setIsBindAccountStatusModalOpen(true);
            return;
        }
        setIsBindAccountModalOpen(true);
    };

    const handleConfirmBindAccount = async () => {
        const phone = bindPhone.trim();
        if (!/^1[0-9]{10}$/.test(phone)) {
            toast.error(t('profile.enterValidPhone'));
            return;
        }
        if (bindPassword.length < 6) {
            toast.error(t('validation.passwordMinLength'));
            return;
        }
        if (bindPassword !== bindConfirmPassword) {
            toast.error(t('profile.passwordMismatch'));
            return;
        }

        const agreementSubject = user?.user?.userId;
        if (!agreementSubject || !hasCurrentLoginAgreementAccepted(agreementSubject)) {
            if (isWebViewEnv()) {
                if (!agreementSubject || !hasCurrentHostLoginAgreementAccepted()) {
                    notifyMiniProgramLoginAgreementRequired();
                    return;
                }
                markLoginAgreementAccepted(agreementSubject);
            } else {
                const modal = authModalStore.getState();
                modal.setPendingAuthErrorCode('AGREEMENT_REQUIRED');
                modal.setAuthModalMode('login');
                modal.setIsAuthModalOpen(true);
                return;
            }
        }

        try {
            setIsBindingAccount(true);
            const response = await auth.bindAccount({
                phoneNumber: phone,
                password: bindPassword,
            });

            if (response.data.success && response.data.data) {
                toast.success(t('profile.browserAccountBound'));
                setIsBindAccountModalOpen(false);
                clearBindAccountDraft();

                logout();
                try {
                    const loginResp = await auth.login({
                        phoneNumber: phone,
                        password: bindPassword,
                        agreementAccepted: true,
                        userAgreementVersion: REGISTRATION_AGREEMENT_VERSION,
                        privacyPolicyVersion: REGISTRATION_PRIVACY_POLICY_VERSION,
                    });
                    if (loginResp.data.success && loginResp.data.data) {
                        login(loginResp.data.data);
                    }
                } catch (error) {
                    console.error('Re-login failed after bind:', error);
                }
            } else {
                toast.error(response.data.message || t('profile.operationFailed'));
            }
        } catch (error: unknown) {
            toast.error(getApiErrorMessage(error, t('profile.operationFailed')));
        } finally {
            setIsBindingAccount(false);
        }
    };

    useEffect(() => {
        if (!searchParams.get('openBrowserLoginAccount')) {
            return;
        }

        if (!isWebViewEnv()) {
            return;
        }

        if (!user?.user) {
            return;
        }

        handleOpenBindAccountModal();
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('openBrowserLoginAccount');
        setSearchParams(nextParams, { replace: true });
    }, [searchParams, setSearchParams, user?.user?.phoneNumber]);

    return (
        <div className={styles.profileFunctionPanel}>
            <div className={styles.functionList}>
                <div className={styles.functionListHeading}>{t('profile.moreServices')}</div>
                    <div className={styles.functionGrid}>
                        <button
                            type="button"
                            className={styles.functionGridItem}
                            onClick={() => navigate('/warehouse')}
                        >
                            <span className={styles.functionGridIcon} aria-hidden="true">
                                <MdOutlineWarehouse />
                            </span>
                            <span className={styles.functionGridLabel}>{t('nav.warehouse')}</span>
                        </button>

                        <button
                            type="button"
                            className={styles.functionGridItem}
                            onClick={() => navigate('/interactive-video/purchased')}
                        >
                            <span className={styles.functionGridIcon} aria-hidden="true">
                                <MdOutlinePlayCircle />
                            </span>
                            <span className={styles.functionGridLabel}>{t('profile.purchasedInteractiveVideo')}</span>
                        </button>

                        <button
                            type="button"
                            className={`${styles.functionGridItem} ${showRedeemInput ? styles.functionGridItemActive : ''}`}
                            onClick={() => {
                                setShowRedeemInput((prev) => !prev);
                            }}
                        >
                            <span className={styles.functionGridIcon} aria-hidden="true">
                                <MdOutlineCardMembership />
                            </span>
                            <span className={styles.functionGridLabel}>{t('profile.membershipRedeem')}</span>
                        </button>

                        <button
                            type="button"
                            className={styles.functionGridItem}
                            onClick={() => navigate('/asset/details')}
                        >
                            <span className={styles.functionGridIcon} aria-hidden="true">
                                <MdOutlineReceiptLong />
                            </span>
                            <span className={styles.functionGridLabel}>{t('profile.purchaseRecords')}</span>
                        </button>

                        <button
                            type="button"
                            className={styles.functionGridItem}
                            onClick={() => navigate('/promotions')}
                        >
                            <span className={styles.functionGridIcon} aria-hidden="true">
                                <MdOutlineCampaign />
                            </span>
                            <span className={styles.functionGridLabel}>{t('profile.promotionCenter')}</span>
                        </button>

                        <button
                            type="button"
                            className={styles.functionGridItem}
                            onClick={() => navigate('/account/privacy')}
                        >
                            <span className={styles.functionGridIcon} aria-hidden="true">
                                <MdOutlineLock />
                            </span>
                            <span className={styles.functionGridLabel}>{t('profile.privacySettings')}</span>
                        </button>

                        {isWebViewEnv() && (
                            <button
                                type="button"
                                className={styles.functionGridItem}
                                onClick={handleOpenBindAccountModal}
                            >
                                <span className={styles.functionGridIcon} aria-hidden="true">
                                    <MdOutlineManageAccounts />
                                </span>
                                <span className={styles.functionGridLabel}>{t('profile.accountBinding')}</span>
                            </button>
                        )}

                        {!isWebViewEnv() && (
                            <button
                                type="button"
                                className={styles.functionGridItem}
                                onClick={handleLogout}
                            >
                                <span className={styles.functionGridIcon} aria-hidden="true">
                                    <RiLogoutCircleRLine />
                                </span>
                                <span className={styles.functionGridLabel}>{t('profile.logout')}</span>
                            </button>
                        )}

                        <button
                            type="button"
                            className={styles.functionGridItem}
                            onClick={() => setIsDeleteAccountFirstOpen(true)}
                        >
                            <span className={styles.functionGridIcon} aria-hidden="true">
                                <MdOutlinePersonOff />
                            </span>
                            <span className={styles.functionGridLabel}>{t('profile.deleteAccount.title')}</span>
                        </button>
                    </div>

                    {showRedeemInput && (
                        <div className={styles.functionExpandPanel}>
                            <input
                                type="text"
                                className={styles.inviteInput}
                                placeholder={t('profile.enterRedeemCode')}
                                value={redeemKey}
                                onChange={(e) => setRedeemKey(e.target.value)}
                                autoFocus
                            />
                            <button
                                type="button"
                                className={styles.functionExpandSubmit}
                                onClick={handleRedeemMembership}
                                disabled={isRedeemingMembership}
                            >
                                {isRedeemingMembership ? t('profile.redeeming') : t('profile.redeem')}
                            </button>
                        </div>
                    )}
            </div>

            <ConfirmModal
                isOpen={isDeleteAccountFirstOpen}
                tone="dark"
                title={t('profile.deleteAccount.firstConfirmTitle')}
                message={t('profile.deleteAccount.firstConfirmMessage')}
                confirmButtonText={t('profile.confirm')}
                cancelButtonText={t('profile.cancel')}
                onCancel={() => setIsDeleteAccountFirstOpen(false)}
                onConfirm={() => {
                    setIsDeleteAccountFirstOpen(false);
                    setIsDeleteAccountWarningOpen(true);
                }}
            />

            <DeleteAccountModal
                isOpen={isDeleteAccountWarningOpen}
                isSubmitting={isDeletingAccount}
                onCancel={() => {
                    if (isDeletingAccount) return;
                    setIsDeleteAccountWarningOpen(false);
                }}
                onConfirm={() => {
                    void handleDeleteAccountConfirm();
                }}
            />

            {isBindAccountModalOpen && (
                <div
                    className={styles.editNameModalOverlay}
                    onClick={() => {
                        setIsBindAccountModalOpen(false);
                        clearBindAccountDraft();
                    }}
                >
                    <div className={styles.editNameModal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.editNameModalHeader}>
                            <div className={styles.editNameModalTitle}>{t('profile.setupBrowserLogin')}</div>
                        </div>
                        <div className={styles.editNameModalBody}>
                            <input
                                className={styles.editNameInput}
                                placeholder={t('profile.enterPhone')}
                                value={bindPhone}
                                onChange={(e) => setBindPhone(e.target.value)}
                                maxLength={11}
                            />
                            <input
                                type="password"
                                className={styles.editNameInput}
                                placeholder={t('profile.setPassword')}
                                value={bindPassword}
                                onChange={(e) => setBindPassword(e.target.value)}
                            />
                            <input
                                type="password"
                                className={styles.editNameInput}
                                placeholder={t('profile.confirmPassword')}
                                value={bindConfirmPassword}
                                onChange={(e) => setBindConfirmPassword(e.target.value)}
                            />
                            <div className={styles.editNameTips}>{t('profile.bindingTip')}</div>
                        </div>
                        <div className={styles.editNameModalActions}>
                            <button
                                type="button"
                                className={styles.editNameCancelButton}
                                onClick={() => {
                                    setIsBindAccountModalOpen(false);
                                    clearBindAccountDraft();
                                }}
                                disabled={isBindingAccount}
                            >
                                {t('profile.cancel')}
                            </button>
                            <button
                                type="button"
                                className={styles.editNameConfirmButton}
                                onClick={handleConfirmBindAccount}
                                disabled={isBindingAccount}
                            >
                                {isBindingAccount ? t('profile.binding') : t('profile.bindAccount')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isBindAccountStatusModalOpen && (
                <div className={styles.editNameModalOverlay} onClick={() => setIsBindAccountStatusModalOpen(false)}>
                    <div className={styles.editNameModal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.editNameModalHeader}>
                            <div className={styles.editNameModalTitle}>{t('profile.browserAccountBound')}</div>
                        </div>
                        <div className={styles.editNameModalBody}>
                            <div className={styles.bindAccountStatusText}>{t('profile.boundPhoneStatus', { phone: maskPhoneNumber(user?.user?.phoneNumber) })}</div>
                            <div className={styles.editNameTips}>{t('profile.browserLoginTip')}</div>
                        </div>
                        <div className={styles.editNameModalActions}>
                            <button
                                type="button"
                                className={styles.editNameConfirmButton}
                                onClick={() => setIsBindAccountStatusModalOpen(false)}
                            >
                                {t('profile.iKnow')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <MembershipRedeemResultModal
                isOpen={redeemSuccessPlanId !== null}
                onClose={() => setRedeemSuccessPlanId(null)}
                planId={redeemSuccessPlanId ?? 'month_v2'}
            />
        </div>
    );
};

export default ProfileFunctionPanel;
