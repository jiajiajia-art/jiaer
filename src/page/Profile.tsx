import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { useTranslation } from 'react-i18next';
import styles from './Profile.module.css';
import MobileBottomNav from '../components/Layout/MobileBottomNav';
import { useAuthStore } from '../store/useAuthStore';
import { auth } from '../api/account/authApi';
import payApi from '../api/pay/payApi';
import Navbar from '../components/Layout/Navbar';
import RechargeModal from '../components/Purchase/RechargeModal';
import CheckInModal from '../components/CheckInModal';
import MembershipRedeemResultModal from '../components/MembershipRedeemResultModal';
import InviteRewardModal from '../components/InviteRewardModal';
import ExchangeModal from '../components/Purchase/ExchangeModal';
import CreatorProfile, { type CreatorProfileFormData } from '../components/CreatorProfile.tsx';
import { RiCopperCoinLine, RiLogoutCircleRLine } from 'react-icons/ri';
import {
    MdCampaign,
    MdCardMembership,
    MdContentCopy,
    MdEdit,
    MdGroup,
    MdPersonAddAlt1,
    MdPlayCircleOutline,
    MdAccountBalanceWallet,
} from 'react-icons/md';
import toast from 'react-hot-toast';
import JoinGroupModal from '../components/JoinGroupModal';
import { getImageUrl } from '../utils/constants';
import type { SubscriptionRedeemResult, User } from '../api/account/auth.type';
import type { SubscriptionPlanId } from '../api/subscriptionKeys/subscriptionKeysApi.type';
import type { PayOrderRequest } from '../api/pay/pay.type';
import { useImageCropper } from '../hooks/useImageCropper';
import ImageCropModal from '../components/CommonModal/ImageCropModal';
import { useDailyTaskStore } from '../store/dailyTaskStore';
import {
    isDurationTaskCode,
    type DailyTaskClaimType,
} from '../api/statistics/dailyTask.type';
import { getCreatorProfile, saveCreatorProfile } from '../api/incentive/creatorProfileApi';
import type { CreatorProfileData } from '../components/CreatorProfile.tsx';
import { getApiErrorMessage } from '../utils/error';

const formatDuration = (totalSeconds: number): string => {
    const safe = Math.max(0, Math.floor(totalSeconds));
    const minutes = Math.floor(safe / 60);
    const seconds = safe % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const getTaskActionText = (code: string, t: (key: string) => string): string => {
    if (code === 'like_once') return t('profile.taskGoLike');
    if (code === 'play_3_unique' || code === 'play_three_games') return t('profile.taskGoPlay');
    return t('profile.taskInProgress');
};
const isWebViewEnv = (): boolean => {
    const win = window as unknown as Record<string, unknown>;
    return String(win.__wxjs_environment ?? '').toLowerCase() === 'miniprogram';
};

const maskPhoneNumber = (phone?: string): string => {
    if (!phone || phone.length < 7) return phone ?? '';
    return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
};

const formatDate = (value?: string | null): string => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const Profile: React.FC = () => {
    const { t } = useTranslation();
    const { user, logout, updateUser } = useAuthStore();
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

    const [isRechargeModalOpen, setIsRechargeModalOpen] = useState(false);
    const [isMembershipRechargeModalOpen, setIsMembershipRechargeModalOpen] = useState(false);
    const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);
    const [isDailyTaskModalOpen, setIsDailyTaskModalOpen] = useState(false);
    const [isInviteRewardModalOpen, setIsInviteRewardModalOpen] = useState(false);
    const [isExchangeModalOpen, setIsExchangeModalOpen] = useState(false);
    const [inviteStats, setInviteStats] = useState<{ inviteCount: number; claimedPoints: number }>({
        inviteCount: 0,
        claimedPoints: 0,
    });

    const [isEditingName, setIsEditingName] = useState(false);
    const [editName, setEditName] = useState('');
    const [isUpdatingName, setIsUpdatingName] = useState(false);

    const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const {
        cropPreset,
        pendingCropFile,
        openCropper,
        closeCropper,
        handleCropComplete,
    } = useImageCropper({
        preset: 'avatar',
        onCropped: async (croppedFile) => {
            try {
                setIsUpdatingAvatar(true);
                const response = await auth.updateUserAvatar(croppedFile);
                if (response.data.success && response.data.data) {
                    await getUserInfo();
                    toast.success(t('profile.avatarUpdated'));
                } else {
                    toast.error(response.data.message || t('profile.avatarUpdateFailed'));
                }
            } catch (error) {
                console.error('update avatar failed:', error);
                toast.error(t('profile.avatarUpdateFailed'));
            } finally {
                setIsUpdatingAvatar(false);
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            }
        },
    });

    const [isBindAccountModalOpen, setIsBindAccountModalOpen] = useState(false);
    const [bindPhone, setBindPhone] = useState('');
    const [bindPassword, setBindPassword] = useState('');
    const [bindConfirmPassword, setBindConfirmPassword] = useState('');
    const [isBindingAccount, setIsBindingAccount] = useState(false);
    const [isBindAccountStatusModalOpen, setIsBindAccountStatusModalOpen] = useState(false);
    const [, setTaskNowTick] = useState<number>(Date.now());

    const [, setIsMobile] = useState(window.innerWidth <= 768);
    const [searchParams, setSearchParams] = useSearchParams();

    const {
        tasks: dailyTasks,
        isLoadedOnce: isTaskLoadedOnce,
        isLoading: isTaskLoading,
        errorMessage: taskErrorMessage,
        claimingTaskMap,
        refreshDailyTasks,
        claimDailyTask,
        getDisplayTotalSeconds,
    } = useDailyTaskStore(useShallow((state) => ({
        tasks: state.tasks,
        isLoadedOnce: state.isLoadedOnce,
        isLoading: state.isLoading,
        errorMessage: state.errorMessage,
        claimingTaskMap: state.claimingTaskMap,
        refreshDailyTasks: state.refreshDailyTasks,
        claimDailyTask: state.claimDailyTask,
        getDisplayTotalSeconds: state.getDisplayTotalSeconds,
    })));
    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleLogout = () => {
        logout();
        navigate('/home');
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

    const userAvatar = getImageUrl(user?.user?.avatarUrl) || `${import.meta.env.BASE_URL}data/assets/defaultAvatar.png`;
    const userName = user?.user?.nickname || user?.user?.name || t('profile.userNameDefault');
    const userCode = user?.user?.userCode;
    const inviteDisplayCode = user?.user?.inviteCode || inviteCode || '002436';

    const handleCopyUserCode = async () => {
        if (!userCode) return;
        try {
            await navigator.clipboard.writeText(userCode);
            toast.success(t('create.kuranIdCopied'));
        } catch (error) {
            console.error('copy Kuran code failed:', error);
            toast.error(t('create.copyFailed'));
        }
    };

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
                updateUser(response.data.data);
                toast.success(t('profile.browserAccountBound'));
                setIsBindAccountModalOpen(false);
                clearBindAccountDraft();
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

    const handleCheckInSuccess = () => {
        updateUser({ hasSignedIn: true });
        getUserInfo();
    };

    const handleStartEditName = () => {
        if (!user) {
            toast.error(t('profile.pleaseLogin'));
            return;
        }
        setEditName(userName === t('profile.userNameDefault') ? '' : userName);
        setIsEditingName(true);
    };

    const handleCancelEditName = () => {
        setIsEditingName(false);
        setEditName('');
    };

    const handleConfirmEditName = async () => {
        const newName = editName.trim();
        if (!newName) {
            toast.error(t('profile.nicknameEmpty'));
            return;
        }
        if (newName === userName) {
            setIsEditingName(false);
            return;
        }

        try {
            setIsUpdatingName(true);
            const response = await auth.updateUserInfo(newName);
            if (response.data.success && response.data.data) {
                updateUser(response.data.data);
                toast.success(t('profile.nicknameUpdateSuccess'));
                setIsEditingName(false);
            } else {
                toast.error(response.data.message || t('profile.nicknameUpdateFailed'));
            }
        } catch (error) {
            console.error('update nickname failed:', error);
            toast.error(t('profile.nicknameUpdateFailed'));
        } finally {
            setIsUpdatingName(false);
        }
    };

    const handleAvatarChangeForCrop = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error(t('profile.selectImageFile'));
            return;
        }

        void openCropper(file).catch((error) => {
            console.error('open avatar cropper failed:', error);
            toast.error(t('profile.avatarUpdateFailed'));
        });
    };

    const handleRecharge = async (order: PayOrderRequest) => {
        const response = await payApi.getPayQrCode(order);
        if (response.data.code === 200 && response.data.data) {
            getUserInfo();
            return {
                qrDataUrl: response.data.data.qrDataUrl,
                outTradeNo: response.data.data.outTradeNo,
            };
        }

            toast.error(response.data.message || t('create.rechargeFailed'));
        return null;
    };

    const handleClaimTask = async (taskType: DailyTaskClaimType) => {
        const result = await claimDailyTask(taskType);
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

    return (
        <div className={styles.pageRoot}>
            <Navbar />
            <div className={styles.mainContent}>
                <div className={styles.main}>
                    <div className={styles.userProfileSection}>
                        <div className={styles.userProfileBackground}>
                            <div
                                className={styles.userProfileBlur}
                                style={{
                                    backgroundImage: `url(${userAvatar})`,
                                }}
                            />
                            <div className={styles.userProfileContent}>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    accept="image/*"
                                    onChange={handleAvatarChangeForCrop}
                                    style={{ display: 'none' }}
                                />
                                <img
                                    className={styles.userAvatar}
                                    src={userAvatar}
                                    alt={'avatar'}
                                    onClick={() => !isUpdatingAvatar && fileInputRef.current?.click()}
                                    style={{ cursor: !isUpdatingAvatar ? 'pointer' : 'default' }}
                                />
                                <div className={styles.userNameWrapper}>
                                    <div className={styles.userName}>{userName}</div>
                                    <MdEdit className={styles.editNameIcon} onClick={handleStartEditName} />
                                </div>
                                <div className={styles.memberCodeWrapper}>
                                    {user?.user?.isMember && user?.user?.memberEndAt ? (
                                        <div className={styles.memberInfo}>
                                            <span className={styles.memberBadge}>
                                                {user?.user?.memberPlan === 'month' ? t('profile.monthlyMember') :
                                                user?.user?.memberPlan === 'season' ? t('profile.seasonalMember') :
                                                user?.user?.memberPlan === 'year' ? t('profile.yearlyMember') : t('profile.vip')}
                                            </span>
                                            <span className={styles.memberExpire}>{t('profile.memberExpireDate', { date: formatDate(user.user.memberEndAt) })}</span>
                                        </div>
                                    ) : null}
                                    {userCode && (
                                        <div className={styles.userCode}>
                                            <span className={styles.userCodeText}>{t('profile.kuranIdLabel', { code: userCode })}</span>
                                            <button
                                                type="button"
                                                className={styles.userCodeCopyButton}
                                                onClick={handleCopyUserCode}
                                                title={t('profile.copyKuranId')}
                                            >
                                                <MdContentCopy />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tab 切换 - 功能列表 / 创作者资料 */}
                    {isCreator && (
                        <div className={styles.profileTabContainer}>
                            <button
                                type="button"
                                className={`${styles.profileTab} ${profileTab === 'function' ? styles.profileTabActive : ''}`}
                                onClick={() => setProfileTab('function')}
                            >
                                {t('profile.functionListTitle')}
                            </button>
                            <button
                                type="button"
                                className={`${styles.profileTab} ${profileTab === 'creator' ? styles.profileTabActive : ''}`}
                                onClick={() => setProfileTab('creator')}
                            >
                                <MdAccountBalanceWallet />
                                {t('profile.creatorProfile')}
                            </button>
                        </div>
                    )}

                    {profileTab === 'creator' ? (
                        <CreatorProfile
                            data={creatorProfileData}
                            onSave={async (data: CreatorProfileFormData) => {
                                await saveCreatorProfile(data);
                                setCreatorProfileData(data);
                            }}
                        />
                    ) : (
                    <div className={styles.functionList}>
                        <div className={styles.functionItem} onClick={() => navigate('/asset/details')}>
                            <div className={styles.functionIcon}>
                                <RiCopperCoinLine />
                            </div>
                            <div className={styles.functionText}>
                                <div className={styles.functionTitle}>{t('profile.myPoints')}</div>
                                <div className={styles.functionDesc}>{t('profile.currentPoints', { points: user?.user?.points ?? 0 })}</div>
                            </div>
                            <div className={styles.pointsActions}>
                                <button className={styles.payButton} onClick={(e) => { e.stopPropagation(); setIsRechargeModalOpen(true); }}>
                                    <span>{t('profile.recharge')}</span>
                                </button>
                                <button className={styles.functionButton} onClick={(e) => { e.stopPropagation(); setIsCheckInModalOpen(true); }}>
                                    {t('profile.checkIn')}
                                </button>
                            </div>
                        </div>

                        {user?.user?.diamonds !== undefined && (
                            <div className={styles.functionItem} onClick={() => navigate('/asset/details')}>
                                <div className={styles.functionIcon}>
                                    <svg className={styles.creatorAssetIconDiamond} viewBox="0 0 1024 1024" width="18" height="18">
                                        <path d="M296.42524445 392.80526222H50.38421333L216.76942222 148.46179555h246.03875556zM798.02823111 149.81233778H551.98833778l166.38520889 244.34232889h246.03989333zM403.65169778 392.80526222L511.19786667 226.41777778l106.40611555 166.38748444zM617.75075555 487.09859555L511.34350222 1000.40248889 407.21066667 487.09859555zM300.18901333 487.09859555l211.90883556 531.02364445-454.30670222-531.02364445zM719.77642667 487.09859555l-207.35658667 531.02364445 449.75559111-531.02364445z" fill="#ffffff"/>
                                    </svg>
                                </div>
                                <div className={styles.functionText}>
                                    <div className={styles.functionTitle}>{t('profile.myDiamonds')}</div>
                                    <div className={styles.functionDesc}>{t('profile.currentDiamonds', { diamonds: user?.user?.diamonds ?? 0 })}</div>
                                </div>
                                <button
                                    className={styles.exchangeButton}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsExchangeModalOpen(true);
                                    }}
                                >
                                    {t('profile.exchange')}
                                </button>
                            </div>
                        )}

                        <div className={styles.functionItem}>
                            <div className={styles.functionIcon}>
                                <RiCopperCoinLine />
                            </div>
                            <div className={styles.functionText}>
                                <div className={styles.functionTitle}>{t('profile.dailyTasks')}</div>
                                <div className={styles.functionDesc}>
                                    {t('profile.dailyTasksDesc')}
                                </div>
                            </div>
                            <button
                                className={styles.functionButton}
                                onClick={() => {
                                    setIsDailyTaskModalOpen(true);
                                    void refreshDailyTasks({ silent: true });
                                }}
                            >
                                {t('profile.claimPoints')}
                            </button>
                        </div>

                        <div className={styles.inviteCampaignSection}>
                            <div className={styles.inviteCampaignHeader}>
                                <div className={styles.inviteCampaignIcon}>
                                    <MdCampaign />
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
                                <span>
                                    {t('profile.inviteStatsText', { count: inviteStats.inviteCount })}
                                </span>
                            </div>
                        </div>

                        <div className={styles.functionItem}>
                            <div className={styles.functionIcon}>
                                <MdCardMembership />
                            </div>
                            <div className={styles.functionText}>
                                <div className={styles.functionTitle}>{t('profile.subscribeMembership')}</div>
                                <div className={styles.functionDesc}>{t('profile.subscribeMembershipDesc')}</div>
                            </div>
                            <button className={styles.functionButton} onClick={() => setIsMembershipRechargeModalOpen(true)}>
                                                                {t('profile.subscribe')}
                            </button>
                        </div>

                        {/* 实现推广分享入口前移 */}
                        <div className={styles.functionItem}>
                            <div className={styles.functionIcon}>
                                <MdCampaign />
                            </div>
                            <div className={styles.functionText}>
                                <div className={styles.functionTitle}>{t('profile.promotionActivities')}</div>
                                {/* 实现推广文案更新 */}
                                <div className={styles.functionDesc}>{t('profile.promotionActivitiesDesc')}</div>
                            </div>
                            <button className={styles.functionButton} onClick={() => navigate('/promotions')}>
                                                                {t('profile.enter')}
                            </button>
                        </div>

                        {/* 观看广告 */}
                        <div className={styles.functionItem}>
                            <div className={styles.functionIcon}>
                                <MdPlayCircleOutline />
                            </div>
                            <div className={styles.functionText}>
                                <div className={styles.functionTitle}>{t('profile.watchAd')}</div>
                                <div className={styles.functionDesc}>{t('profile.watchAdDesc')}</div>
                            </div>
                            <button className={styles.functionButton} onClick={handleWatchAd}>
                                {t('profile.watch')}
                            </button>
                        </div>

                        {/* <div className={styles.functionItem}>
                            <div className={styles.functionIcon}>
                                <MdOutlineQrCodeScanner />
                            </div>
                            <div className={styles.functionText}>
                                <div className={styles.functionTitle}>{t('profile.myInviteCode', { code: user?.user?.inviteCode ? user?.user?.inviteCode : inviteCode })}</div>
                                <div className={styles.functionDesc}>{t('profile.inviteCodeAfterUse')}</div>
                            </div>
                            <button className={styles.functionButton} onClick={handleCopyInviteCode}>
                                {t('profile.copy')}
                            </button>
                        </div> */}

                        <div className={styles.functionItem}>
                            <div className={styles.functionIcon}>
                                <MdPersonAddAlt1 />
                            </div>
                            {!showInputInviteCode ? (
                                <>
                                    <div className={styles.functionText}>
                                        <div className={styles.functionTitle}>{t('profile.enterInviteCode')}</div>
                                        <div className={styles.functionDesc}>{t('profile.inviteCodeOneTimeUse')}</div>
                                    </div>
                                    <button className={styles.functionButton} onClick={() => setShowInputInviteCode(true)}>
                                        {t('profile.enter')}
                                    </button>
                                </>
                            ) : (
                                <>
                                    <input
                                        type="text"
                                        className={styles.inviteInput}
                                        placeholder={t('profile.enterInviteCode')}
                                        value={inputInviteCode}
                                        onChange={(e) => setInputInviteCode(e.target.value)}
                                        onBlur={(e) => {
                                            const relatedTarget = e.relatedTarget as HTMLElement;
                                            if (!relatedTarget || !relatedTarget.closest('button')) {
                                                setTimeout(() => {
                                                    setShowInputInviteCode(false);
                                                    setInputInviteCode('');
                                                }, 200);
                                            }
                                        }}
                                        autoFocus
                                    />
                                    <button
                                        className={styles.functionButton}
                                        onClick={handleSubmitInviteCode}
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                        }}
                                    >
                                        {t('profile.submit')}
                                    </button>
                                </>
                            )}
                        </div>

                        <div className={styles.functionItem}>
                            <div className={styles.functionIcon}>
                                <MdCardMembership />
                            </div>
                            {!showRedeemInput ? (
                                <>
                                    <div className={styles.functionText}>
                                        <div className={styles.functionTitle}>{t('profile.membershipRedeem')}</div>
                                        <div className={styles.functionDesc}>{t('profile.membershipRedeemDesc')}</div>
                                    </div>
                                    <button className={styles.functionButton} onClick={() => setShowRedeemInput(true)}>
                                        {t('profile.redeem')}
                                    </button>
                                </>
                            ) : (
                                <>
                                    <input
                                        type="text"
                                        className={styles.inviteInput}
                                        placeholder={t('profile.enterRedeemCode')}
                                        value={redeemKey}
                                        onChange={(e) => setRedeemKey(e.target.value)}
                                        onBlur={(e) => {
                                            const relatedTarget = e.relatedTarget as HTMLElement;
                                            if (!relatedTarget || !relatedTarget.closest('button')) {
                                                setTimeout(() => {
                                                    setShowRedeemInput(false);
                                                    setRedeemKey('');
                                                }, 200);
                                            }
                                        }}
                                        autoFocus
                                    />
                                    <button
                                        className={styles.functionButton}
                                        onClick={handleRedeemMembership}
                                        disabled={isRedeemingMembership}
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                        }}
                                    >
                                        {isRedeemingMembership ? t('profile.redeeming') : t('profile.redeem')}
                                    </button>
                                </>
                            )}
                        </div>

                        {isWebViewEnv() && (
                            <div className={styles.functionItem}>
                                <div className={styles.functionIcon}>
                                    <MdPersonAddAlt1 />
                                </div>
                                <div className={styles.functionText}>
                                    <div className={styles.functionTitle}>{t('profile.browserLoginAccount')}</div>
                                    <div className={styles.functionDesc}>
                                        {user?.user?.phoneNumber
                                            ? t('profile.boundPhoneDesc', { phone: maskPhoneNumber(user?.user?.phoneNumber) })
                                            : t('profile.setupPhoneDesc')}
                                    </div>
                                </div>
                                <button className={styles.functionButton} onClick={handleOpenBindAccountModal}>
                                    {user?.user?.phoneNumber ? t('profile.phoneBound') : t('profile.goSetup')}
                                </button>
                            </div>
                        )}

                        <div className={styles.functionItem}>
                            <div className={styles.functionIcon}>
                                <MdGroup />
                            </div>
                            <div className={styles.functionText}>
                                <div className={styles.functionTitle}>{t('profile.joinUserGroup')}</div>
                                <div className={styles.functionDesc}>{t('profile.joinUserGroupDesc')}</div>
                            </div>
                            <button className={styles.functionButton} onClick={handleJoinGroup}>
                                {t('profile.join')}
                            </button>
                        </div>

                        {!isWebViewEnv() && (
                            <div className={styles.functionItem}>
                                <div className={styles.functionIcon}>
                                    <RiLogoutCircleRLine />
                                </div>
                                <div className={styles.functionText}>
                                    <div className={styles.functionTitle}>{t('profile.logout')}</div>
                                    <div className={styles.functionDesc}>{t('profile.logoutDesc')}</div>
                                </div>
                                <button className={styles.functionButton} onClick={handleLogout}>
                                    {t('profile.exit')}
                                </button>
                            </div>
                        )}
                    </div>
                    )}
                </div>
            </div>
            <MobileBottomNav />

            {isEditingName && (
                <div className={styles.editNameModalOverlay} onClick={handleCancelEditName}>
                    <div className={styles.editNameModal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.editNameModalHeader}>
                            <div className={styles.editNameModalTitle}>{t('profile.editNickname')}</div>
                        </div>
                        <div className={styles.editNameModalBody}>
                            <input
                                className={styles.editNameInput}
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                placeholder={t('profile.enterNewNickname')}
                                maxLength={20}
                                autoFocus
                            />
                            <div className={styles.editNameTips}>{t('profile.nicknameTip')}</div>
                        </div>
                        <div className={styles.editNameModalActions}>
                            <button
                                type="button"
                                className={styles.editNameCancelButton}
                                onClick={handleCancelEditName}
                                disabled={isUpdatingName}
                            >
                                {t('profile.cancel')}
                            </button>
                            <button
                                type="button"
                                className={styles.editNameConfirmButton}
                                onClick={handleConfirmEditName}
                                disabled={isUpdatingName}
                            >
                                {isUpdatingName ? t('profile.saving') : t('profile.confirm')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

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

            <RechargeModal
                isOpen={isRechargeModalOpen}
                onClose={() => setIsRechargeModalOpen(false)}
                onRecharge={handleRecharge}
                isFirstCharge={user?.user?.firstCharge}
            />

            <RechargeModal
                isOpen={isMembershipRechargeModalOpen}
                onClose={() => setIsMembershipRechargeModalOpen(false)}
                onRecharge={handleRecharge}
                fixedTab="membership"
            />

            <CheckInModal
                isOpen={isCheckInModalOpen}
                onClose={() => setIsCheckInModalOpen(false)}
                onSignInSuccess={handleCheckInSuccess}
            />

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
                planId={redeemSuccessPlanId ?? 'month'}
            />

            <ExchangeModal
                isOpen={isExchangeModalOpen}
                onClose={() => setIsExchangeModalOpen(false)}
                onSuccess={() => {
                    void getUserInfo();
                }}
            />

            {isDailyTaskModalOpen && (
                <div
                    className={styles.dailyTaskModalOverlay}
                    onClick={() => setIsDailyTaskModalOpen(false)}
                >
                    <div className={styles.dailyTaskModal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.dailyTaskModalHeader}>
                            <div className={styles.dailyTaskModalTitle}>{t('profile.tasksTitle')}</div>
                            <button
                                type="button"
                                className={styles.dailyTaskCloseBtn}
                                aria-label={t('profile.closeDailyTasks')}
                                onClick={() => setIsDailyTaskModalOpen(false)}
                            >
                                ×
                            </button>
                        </div>
                        {/* <div className={styles.dailyTaskSummary}>
                            {t('profile.todayOnline', { time: formatDuration(displayTotalSeconds) })}
                            <span className={styles.dailyTaskSummaryMeta}>
                                {t('profile.synced', { time: formatDuration(dailyTaskSummary.totalSeconds) })} / {t('profile.pendingSync', { seconds: pendingPlatformSeconds + pendingGameSeconds })}
                            </span>
                        </div> */}
                        {!isTaskLoadedOnce && isTaskLoading && (
                            <div className={styles.dailyTaskLoading}>{t('profile.tasksLoading')}</div>
                        )}
                        {taskErrorMessage && (
                            <div className={styles.dailyTaskError}>{taskErrorMessage}</div>
                        )}
                        <div className={styles.dailyTaskList}>
                            {dailyTasks.map((task) => {
                                const isDurationTask = isDurationTaskCode(task.code);
                                const claimTaskType = task.taskType;
                                const isClaimingTask = claimTaskType ? claimingTaskMap[claimTaskType] : false;
                                const canClaimNow = Boolean(claimTaskType) && task.claimable && !task.claimed;
                                const effectiveProgress = isDurationTask
                                    ? Math.max(task.progress, displayTotalSeconds)
                                    : task.progress;
                                const progressDenominator = Math.max(task.target, 1);
                                const progressRatio = Math.min(1, Math.max(0, effectiveProgress / progressDenominator));
                                const progressPercent = Math.round(progressRatio * 100);
                                const progressText = isDurationTask
                                    ? `${formatDuration(Math.min(effectiveProgress, task.target))} / ${formatDuration(task.target)}`
                                    : `${Math.min(effectiveProgress, task.target)}/${task.target}`;

                                let statusText = task.statusText;
                                if (task.claimed) {
                                    statusText = t('profile.rewardClaimed');
                                } else if (canClaimNow) {
                                    statusText = t('profile.claim');
                                } else if (task.completed) {
                                    statusText = t('profile.taskCompleted');
                                } else if (!statusText) {
                                    statusText = t('profile.taskInProgress');
                                }

                                return (
                                    <div key={task.code} className={styles.dailyTaskItem}>
                                        <div className={styles.dailyTaskItemHeader}>
                                            <div className={styles.dailyTaskItemTitle}>
                                                {task.titleKey ? t(task.titleKey) : task.title}
                                            </div>
                                            <div className={styles.dailyTaskReward}>+{task.rewardPoints}{t('profile.points')}</div>
                                        </div>
                                        <div className={styles.dailyTaskProgressRow}>
                                            <div className={styles.dailyTaskProgressBar}>
                                                <div
                                                    className={`${styles.dailyTaskProgressFill} ${task.completed ? styles.dailyTaskProgressFillDone : ''}`}
                                                    style={{ width: `${progressPercent}%` }}
                                                />
                                            </div>
                                            <div className={styles.dailyTaskProgressText}>{progressText}</div>
                                        </div>
                                        <div className={styles.dailyTaskStatusRow}>
                                            <span className={`${styles.dailyTaskStatus} ${task.completed ? styles.dailyTaskStatusDone : ''}`}>
                                                {statusText}
                                            </span>
                                            {canClaimNow && claimTaskType && (
                                                <button
                                                    type="button"
                                                    className={styles.dailyTaskClaimBtn}
                                                    disabled={isClaimingTask}
                                                    onClick={() => {
                                                        void handleClaimTask(claimTaskType);
                                                    }}
                                                >
                                                    {isClaimingTask ? t('profile.claiming') : t('profile.claim')}
                                                </button>
                                            )}
                                            {!canClaimNow && claimTaskType && !task.claimed && (
                                                <span className={styles.dailyTaskActionText}>{getTaskActionText(task.code, t)}</span>
                                            )}
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
            {pendingCropFile ? (
                <ImageCropModal
                    isOpen
                    imageSrc={pendingCropFile.imageSrc}
                    title={cropPreset.title}
                    description={cropPreset.description}
                    aspectRatio={cropPreset.aspectRatio}
                    aspectLabel={cropPreset.aspectLabel}
                    defaultCropScale={cropPreset.defaultCropScale}
                    mimeType={pendingCropFile.mimeType}
                    onClose={closeCropper}
                    onCropComplete={handleCropComplete}
                />
            ) : null}
        </div>
    );
};

export default Profile;



