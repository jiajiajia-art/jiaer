import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { useTranslation } from 'react-i18next';
import styles from '../../page/Profile.module.css';
import { useAuthStore } from '../../store/useAuthStore';
import { auth } from '../../api/account/authApi';
import MembershipRedeemResultModal from '../../components/MembershipRedeemResultModal';
import InviteRewardModal from '../../components/InviteRewardModal';
import ConfirmModal from '../CommonModal/ConfirmModal';
import DeleteAccountModal from './DeleteAccountModal';
import CreatorProfile, { type CreatorProfileFormData } from '../../components/CreatorProfile.tsx';
import { RiCopperCoinLine, RiLogoutCircleRLine } from 'react-icons/ri';
import {
    MdCardMembership,
    MdPlayCircleOutline,
    MdAccountBalanceWallet,
    MdOutlinePersonOff,
} from 'react-icons/md';
import { HiChevronRight } from 'react-icons/hi';
import toast from 'react-hot-toast';
import JoinGroupModal from '../../components/JoinGroupModal';
import type { SubscriptionRedeemResult, User } from '../../api/account/auth.type';
import type { SubscriptionPlanId } from '../../api/subscriptionKeys/subscriptionKeysApi.type';
import { useDailyTaskStore } from '../../store/dailyTaskStore';
import {
    isDynamicDailyTask,
    isDynamicDurationDailyTask,
    isDynamicPromotionDailyTask,
    isDurationTaskCode,
} from '../../api/statistics/dailyTask.type';
import { getCreatorProfile, saveCreatorProfile } from '../../api/incentive/creatorProfileApi';
import type { CreatorProfileData } from '../../components/CreatorProfile.tsx';
import { buildGamePromotionLink } from '../../utils/gamePromotionLink';
import { getApiErrorMessage } from '../../utils/error';

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
    if (isDynamicPromotionDailyTask(task)) return '复制推广链接'; // 推广任务不走「去游玩」
    if (task.code === 'like_once') return t('profile.taskGoLike');
    if (task.code === 'play_3_unique' || task.code === 'play_three_games') return t('profile.taskGoPlay');
    if (task.gameTitle) return t('profile.taskGoPlaySpecific', { gameTitle: task.gameTitle });
    return t('profile.taskInProgress');
};

const isTaskPlayable = (task: { code: string; taskKind?: string; gameFileId?: string }): boolean => {
    if (isDynamicPromotionDailyTask(task)) return false; // 推广任务用复制链接，不跳转游玩
    if (task.gameFileId) return true;
    if (task.code === 'play_3_unique' || task.code === 'play_three_games') return true;
    return false;
};

/** 用户领取 game_promotion 任务后，复制带 ?promo= 的分享链接 */
const copyPromotionLink = async (link: string) => {
    try {
        await navigator.clipboard.writeText(link);
        toast.success('推广链接已复制');
    } catch (error) {
        console.error('copy promotion link failed:', error);
        toast.error('复制失败，请手动复制链接');
    }
};

const isWebViewEnv = (): boolean => {
    const win = window as unknown as Record<string, unknown>;
    return String(win.__wxjs_environment ?? '').toLowerCase() === 'miniprogram';
};

const maskPhoneNumber = (phone?: string): string => {
    if (!phone || phone.length < 7) return phone ?? '';
    return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
};

const personalAsset = (name: string) =>
    `${import.meta.env.BASE_URL}data/assetsv2/personal/${name}.svg`;

const ProfileFunctionPanel: React.FC = () => {
    const { t } = useTranslation();
    const { user, logout, updateUser, login } = useAuthStore();
    const navigate = useNavigate();
    const [inviteCode, setInviteCode] = useState('');
    const [inputInviteCode, setInputInviteCode] = useState('');
    const [showInputInviteCode, setShowInputInviteCode] = useState(false);
    const [showJoinGroupModal, setShowJoinGroupModal] = useState(false);
    const [showRedeemInput, setShowRedeemInput] = useState(false);
    const [redeemKey, setRedeemKey] = useState('');
    const [isRedeemingMembership, setIsRedeemingMembership] = useState(false);
    const [redeemSuccessPlanId, setRedeemSuccessPlanId] = useState<SubscriptionRedeemResult['planId'] | null>(null);

    // 创作者资料 Tab 状态
    const [profileTab, setProfileTab] = useState<'function' | 'creator'>('function');
    const [creatorProfileData, setCreatorProfileData] = useState<CreatorProfileData>({
        groupNo: '',
        realName: '',
        idCard: '',
        bankCard: '',
        bankBranch: '',
    });

    // 判断是否为创作者（基于 userSegment 是否为 incentive）
    const isCreator = user?.user?.userSegment !== 'normal';

    const [isDailyTaskModalOpen, setIsDailyTaskModalOpen] = useState(false);
    const [isInviteRewardModalOpen, setIsInviteRewardModalOpen] = useState(false);
    const [inviteStats, setInviteStats] = useState<{ inviteCount: number; claimedPoints: number }>({
        inviteCount: 0,
        claimedPoints: 0,
    });

    const [isBindAccountModalOpen, setIsBindAccountModalOpen] = useState(false);
    const [bindPhone, setBindPhone] = useState('');
    const [bindPassword, setBindPassword] = useState('');
    const [bindConfirmPassword, setBindConfirmPassword] = useState('');
    const [isBindingAccount, setIsBindingAccount] = useState(false);
    const [isBindAccountStatusModalOpen, setIsBindAccountStatusModalOpen] = useState(false);
    const [, setTaskNowTick] = useState<number>(Date.now());
    // 功能注释：注销账户两步确认——先简确认，再重要提醒二次弹窗
    const [isDeleteAccountFirstOpen, setIsDeleteAccountFirstOpen] = useState(false);
    const [isDeleteAccountWarningOpen, setIsDeleteAccountWarningOpen] = useState(false);
    const [isDeletingAccount, setIsDeletingAccount] = useState(false);

    const [searchParams, setSearchParams] = useSearchParams();

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
                if (userData.inviteCode) {
                    setInviteCode(userData.inviteCode);
                }
            }
        } catch (error) {
            console.error('get user info failed:', error);
        }
    };

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
            setInviteStats({ inviteCount: 0, claimedPoints: 0 });
        } catch {
            setInviteStats({ inviteCount: 0, claimedPoints: 0 });
        }
    };

    useEffect(() => {
        getUserInfo();
        void getInviteStats();
        void refreshDailyTasks();
        if (isCreator) {
            void fetchCreatorProfile();
        }
    }, [refreshDailyTasks, isCreator]);

    const fetchCreatorProfile = async () => {
        try {
            const data = await getCreatorProfile();
            setCreatorProfileData(data);
        } catch (error) {
            console.error('Fetch creator profile failed:', error);
        }
    };

    useEffect(() => {
        const intervalId = window.setInterval(() => {
            setTaskNowTick(Date.now());
        }, 1000);
        return () => {
            window.clearInterval(intervalId);
        };
    }, []);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (!document.hidden) {
                void refreshDailyTasks({ silent: true });
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [refreshDailyTasks]);

    const inviteDisplayCode = user?.user?.inviteCode || inviteCode || '002436';

    const handleWatchAd = () => {
        toast.error(t('profile.adFeatureDeveloping'));
    };

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

    const handleCopyInviteCode = () => {
        if (inviteDisplayCode) {
            navigator.clipboard.writeText(inviteDisplayCode);
            toast.success(t('profile.inviteCodeCopied'));
        } else {
            toast.error(t('profile.noInviteCode'));
        }
    };

    const handleSubmitInviteCode = async () => {
        if (!inputInviteCode.trim()) {
            toast.error(t('profile.enterInviteCode'));
            return;
        }

        try {
            const response = await auth.useInviteCode({ inviteCode: inputInviteCode });
            if (response.data.success) {
                toast.success(t('profile.inviteCodeSubmitSuccess'));
                getUserInfo();
                setShowInputInviteCode(false);
                setInputInviteCode('');
            } else {
                toast.error(response.data.message || t('profile.operationFailed'));
            }
        } catch (error: unknown) {
            toast.error(getApiErrorMessage(error, t('profile.submitInviteCodeFailed')));
        }
    };

    const handleJoinGroup = () => {
        setShowJoinGroupModal(true);
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
                    const loginResp = await auth.login({ phoneNumber: phone, password: bindPassword });
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

    useEffect(() => {
        if (searchParams.get('openDailyTasks') !== '1') {
            return;
        }

        setIsDailyTaskModalOpen(true);
        void refreshDailyTasks({ silent: true });

        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('openDailyTasks');
        setSearchParams(nextParams, { replace: true });
    }, [refreshDailyTasks, searchParams, setSearchParams]);

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
    const durationTaskMap = new Map(dailyTasks.filter((task) => isDurationTaskCode(task.code)).map((task) => [task.code, task]));
    const tenMinuteTask = durationTaskMap.get('online_10m');
    const thirtyMinuteTask = durationTaskMap.get('online_30m');
    const hasDurationTaskFallback = !tenMinuteTask || !thirtyMinuteTask;
    const claimableTaskCount = dailyTasks.filter((task) => Boolean(task.claimRequest) && task.claimable && !task.claimed).length;
    const completedTaskCount = dailyTasks.filter((task) => task.completed || task.claimed).length;

    return (
        <div className={styles.profileFunctionPanel}>
            <div className={styles.functionList}>
                {isCreator ? (
                    <div className={styles.profileTabContainer} role="tablist">
                        <button
                            type="button"
                            role="tab"
                            aria-selected={profileTab === 'function'}
                            className={`${styles.profileTab} ${profileTab === 'function' ? styles.profileTabActive : ''}`}
                            onClick={() => setProfileTab('function')}
                        >
                            {t('profile.moreServices')}
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={profileTab === 'creator'}
                            className={`${styles.profileTab} ${profileTab === 'creator' ? styles.profileTabActive : ''}`}
                            onClick={() => setProfileTab('creator')}
                        >
                            <MdAccountBalanceWallet />
                            {t('profile.creatorProfile')}
                        </button>
                    </div>
                ) : (
                    <div className={styles.functionListHeading}>{t('profile.moreServices')}</div>
                )}

                {profileTab === 'creator' ? (
                    <div className={styles.creatorProfileSlot}>
                        <CreatorProfile
                            data={creatorProfileData}
                            onSave={async (data: CreatorProfileFormData) => {
                                await saveCreatorProfile(data);
                                setCreatorProfileData(data);
                            }}
                        />
                    </div>
                ) : (
                    <>
                    <div className={styles.inviteCampaignSection}>
                        <div className={styles.inviteCampaignHeader}>
                            <div className={styles.inviteCampaignIcon}>
                                <img src={personalAsset('invite')} alt="" />
                            </div>
                            <div className={styles.inviteCampaignTitle}>{t('profile.inviteCampaignTitle')}</div>
                        </div>
                        <div className={styles.inviteCampaignCodeRow}>
                            <div className={styles.inviteCampaignCode}>{inviteDisplayCode}</div>
                            <button type="button" className={styles.inviteCampaignCopyBtn} onClick={handleCopyInviteCode}>
                                {t('profile.copyInviteCode')}
                            </button>
                        </div>
                        <button
                            type="button"
                            className={styles.inviteCampaignRewardBtn}
                            onClick={() => setIsInviteRewardModalOpen(true)}
                        >
                            {t('profile.claimPoints')}
                        </button>
                        <div className={styles.inviteCampaignMeta}>
                            <span>{t('profile.inviteStatsText', { count: inviteStats.inviteCount })}</span>
                        </div>
                    </div>

                    <div
                        className={`${styles.functionItem} ${showInputInviteCode ? styles.functionItemExpanded : ''}`}
                        role={showInputInviteCode ? undefined : 'button'}
                        tabIndex={showInputInviteCode ? undefined : 0}
                        onClick={showInputInviteCode ? undefined : () => setShowInputInviteCode(true)}
                        onKeyDown={
                            showInputInviteCode
                                ? undefined
                                : (e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        setShowInputInviteCode(true);
                                    }
                                }
                        }
                    >
                        <span className={styles.functionIcon}>
                            <img src={personalAsset('exchange')} alt="" />
                        </span>
                        <span className={styles.functionTitle}>{t('profile.redeemInviteCode')}</span>
                        {!showInputInviteCode ? (
                            <span className={styles.functionMeta}>
                                <span className={styles.functionHint}>{t('profile.enterRedeemCodeHint')}</span>
                                <HiChevronRight className={styles.functionChevron} />
                            </span>
                        ) : (
                            <div className={styles.functionExpandRow} onClick={(e) => e.stopPropagation()}>
                                <input
                                    type="text"
                                    className={styles.inviteInput}
                                    placeholder={t('profile.enterInviteCode')}
                                    value={inputInviteCode}
                                    onChange={(e) => setInputInviteCode(e.target.value)}
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    className={styles.functionExpandSubmit}
                                    onClick={handleSubmitInviteCode}
                                >
                                    {t('profile.submit')}
                                </button>
                            </div>
                        )}
                    </div>

                    <button type="button" className={styles.functionItem} onClick={() => navigate('/promotions')}>
                        <span className={styles.functionIcon}>
                            <img src={personalAsset('promote')} alt="" />
                        </span>
                        <span className={styles.functionTitle}>{t('profile.promotionCenter')}</span>
                        <span className={styles.functionMeta}>
                            <span className={styles.functionHint}>{t('profile.shareEarnPoints')}</span>
                            <HiChevronRight className={styles.functionChevron} />
                        </span>
                    </button>

                    <button type="button" className={styles.functionItem} onClick={handleJoinGroup}>
                        <span className={styles.functionIcon}>
                            <img src={personalAsset('group')} alt="" />
                        </span>
                        <span className={styles.functionTitle}>{t('profile.joinOfficialQQGroup')}</span>
                        <span className={styles.functionMeta}>
                            <span className={styles.functionHint}>{t('profile.joinGroupChat')}</span>
                            <HiChevronRight className={styles.functionChevron} />
                        </span>
                    </button>

                    {isWebViewEnv() && (
                        <button type="button" className={styles.functionItem} onClick={handleOpenBindAccountModal}>
                            <span className={styles.functionIcon}>
                                <img src={personalAsset('account')} alt="" />
                            </span>
                            <span className={styles.functionTitle}>{t('profile.accountBinding')}</span>
                            <span className={styles.functionMeta}>
                                <span className={styles.functionHint}>
                                    {user?.user?.phoneNumber ? t('profile.phoneBound') : t('profile.goSetup')}
                                </span>
                                <HiChevronRight className={styles.functionChevron} />
                            </span>
                        </button>
                    )}

                    <button type="button" className={styles.functionItem} onClick={() => navigate('/warehouse/history')}>
                        <span className={styles.functionIcon}>
                            <img src={personalAsset('history')} alt="" />
                        </span>
                        <span className={styles.functionTitle}>{t('profile.browsingHistory')}</span>
                        <span className={styles.functionMeta}>
                            <HiChevronRight className={styles.functionChevron} />
                        </span>
                    </button>

                    <button type="button" className={styles.functionItem} onClick={() => navigate('/messages')}>
                        <span className={styles.functionIcon}>
                            <img src={personalAsset('notice')} alt="" />
                        </span>
                        <span className={styles.functionTitle}>{t('profile.messageCenter')}</span>
                        <span className={styles.functionMeta}>
                            <HiChevronRight className={styles.functionChevron} />
                        </span>
                    </button>

                    <button
                        type="button"
                        className={styles.functionItem}
                        onClick={() => navigate('/interactive-video/purchased')}
                    >
                        <span className={styles.functionIcon}>
                            <MdPlayCircleOutline />
                        </span>
                        <span className={styles.functionTitle}>{t('profile.purchasedInteractiveVideo')}</span>
                        <span className={styles.functionMeta}>
                            <span className={styles.functionHint}>{t('profile.view')}</span>
                            <HiChevronRight className={styles.functionChevron} />
                        </span>
                    </button>

                    <button
                        type="button"
                        className={styles.functionItem}
                        onClick={() => {
                            setIsDailyTaskModalOpen(true);
                            void refreshDailyTasks({ silent: true });
                        }}
                    >
                        <span className={styles.functionIcon}>
                            <RiCopperCoinLine />
                        </span>
                        <span className={styles.functionTitle}>{t('profile.dailyTasks')}</span>
                        <span className={styles.functionMeta}>
                            <span className={styles.functionHint}>{t('profile.claimPoints')}</span>
                            <HiChevronRight className={styles.functionChevron} />
                        </span>
                    </button>

                    <button type="button" className={styles.functionItem} onClick={handleWatchAd}>
                        <span className={styles.functionIcon}>
                            <MdPlayCircleOutline />
                        </span>
                        <span className={styles.functionTitle}>{t('profile.watchAd')}</span>
                        <span className={styles.functionMeta}>
                            <span className={styles.functionHint}>{t('profile.watch')}</span>
                            <HiChevronRight className={styles.functionChevron} />
                        </span>
                    </button>

                    <div
                        className={`${styles.functionItem} ${showRedeemInput ? styles.functionItemExpanded : ''}`}
                        role={showRedeemInput ? undefined : 'button'}
                        tabIndex={showRedeemInput ? undefined : 0}
                        onClick={showRedeemInput ? undefined : () => setShowRedeemInput(true)}
                        onKeyDown={
                            showRedeemInput
                                ? undefined
                                : (e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        setShowRedeemInput(true);
                                    }
                                }
                        }
                    >
                        <span className={styles.functionIcon}>
                            <MdCardMembership />
                        </span>
                        <span className={styles.functionTitle}>{t('profile.membershipRedeem')}</span>
                        {!showRedeemInput ? (
                            <span className={styles.functionMeta}>
                                <span className={styles.functionHint}>{t('profile.redeem')}</span>
                                <HiChevronRight className={styles.functionChevron} />
                            </span>
                        ) : (
                            <div className={styles.functionExpandRow} onClick={(e) => e.stopPropagation()}>
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

                    {!isWebViewEnv() && (
                        <button type="button" className={styles.functionItem} onClick={handleLogout}>
                            <span className={styles.functionIcon}>
                                <RiLogoutCircleRLine />
                            </span>
                            <span className={styles.functionTitle}>{t('profile.logout')}</span>
                            <span className={styles.functionMeta}>
                                <span className={styles.functionHint}>{t('profile.exit')}</span>
                                <HiChevronRight className={styles.functionChevron} />
                            </span>
                        </button>
                    )}

                    {/* 功能注释：个人中心注销入口；先简确认，再打开重要提醒二次弹窗 */}
                    <button
                        type="button"
                        className={styles.functionItem}
                        onClick={() => setIsDeleteAccountFirstOpen(true)}
                    >
                        <span className={styles.functionIcon}>
                            <MdOutlinePersonOff />
                        </span>
                        <span className={styles.functionTitle}>{t('profile.deleteAccount.title')}</span>
                        <span className={styles.functionMeta}>
                            <span className={styles.functionHint}>{t('profile.deleteAccount.hint')}</span>
                            <HiChevronRight className={styles.functionChevron} />
                        </span>
                    </button>
                    </>
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

            <JoinGroupModal isOpen={showJoinGroupModal} onClose={() => setShowJoinGroupModal(false)} />

            <InviteRewardModal
                isOpen={isInviteRewardModalOpen}
                onClose={() => setIsInviteRewardModalOpen(false)}
                onClaimSuccess={() => {
                    void getUserInfo();
                    void getInviteStats();
                }}
            />

            <MembershipRedeemResultModal
                isOpen={redeemSuccessPlanId !== null}
                onClose={() => setRedeemSuccessPlanId(null)}
                planId={redeemSuccessPlanId ?? 'creator_month'}
            />

            {isDailyTaskModalOpen && (
                <div
                    className={styles.dailyTaskModalOverlay}
                    onClick={() => setIsDailyTaskModalOpen(false)}
                >
                    <div className={styles.dailyTaskModal} onClick={(e) => e.stopPropagation()}>
                        <button
                            type="button"
                            className={styles.dailyTaskCloseBtn}
                            aria-label={t('profile.closeDailyTasks')}
                            onClick={() => setIsDailyTaskModalOpen(false)}
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
                                // accept 后才有 promotionCode；复制链路由 buildGamePromotionLink 生成
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
            )}
        </div>
    );
};

export default ProfileFunctionPanel;
