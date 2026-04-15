import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import styles from './Profile.module.css';
import MobileBottomNav from '../components/Layout/MobileBottomNav';
import { useAuthStore } from '../store/useAuthStore';
import { auth } from '../api/account/authApi';
import payApi from '../api/pay/payApi';
import Navbar from '../components/Layout/Navbar';
import RechargeModal from '../components/Purchase/RechargeModal';
import CheckInModal from '../components/CheckInModal';
import MembershipRedeemResultModal from '../components/MembershipRedeemResultModal';
import { RiCopperCoinLine, RiLogoutCircleRLine } from 'react-icons/ri';
import {
    MdCampaign,
    MdCardMembership,
    MdContentCopy,
    MdEdit,
    MdGroup,
    MdOutlineQrCodeScanner,
    MdPersonAddAlt1,
    MdPlayCircleOutline,
} from 'react-icons/md';
import toast from 'react-hot-toast';
import JoinGroupModal from '../components/JoinGroupModal';
import { getImageUrl } from '../utils/constants';
import type { SubscriptionRedeemResult, User } from '../api/account/auth.type';
import type { SubscriptionPlanId } from '../api/subscriptionKeys/subscriptionKeysApi.type';
import type { PayOrderRequest } from '../api/pay/pay.type';

const isWebViewEnv = (): boolean => {
    const win = window as any;
    return String(win.__wxjs_environment || '').toLowerCase() === 'miniprogram';
};

const maskPhoneNumber = (phone?: string): string => {
    if (!phone) return '';
    if (phone.length < 7) return phone;
    if (phone.length === 11) {
        return `${phone.slice(0, 3)}****${phone.slice(7)}`;
    }
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

    const [isRechargeModalOpen, setIsRechargeModalOpen] = useState(false);
    const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);

    const [isEditingName, setIsEditingName] = useState(false);
    const [editName, setEditName] = useState('');
    const [isUpdatingName, setIsUpdatingName] = useState(false);

    const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [isBindAccountModalOpen, setIsBindAccountModalOpen] = useState(false);
    const [bindPhone, setBindPhone] = useState('');
    const [bindPassword, setBindPassword] = useState('');
    const [bindConfirmPassword, setBindConfirmPassword] = useState('');
    const [isBindingAccount, setIsBindingAccount] = useState(false);
    const [isBindAccountStatusModalOpen, setIsBindAccountStatusModalOpen] = useState(false);

    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [searchParams, setSearchParams] = useSearchParams();

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

    useEffect(() => {
        getUserInfo();
    }, []);

    const userAvatar = getImageUrl(user?.user?.avatarUrl) || `${import.meta.env.BASE_URL}data/assets/defaultAvatar.png`;
    const userName = user?.user?.nickname || user?.user?.name || '未设置';
    const userCode = user?.user?.userCode;

    const handleCopyUserCode = async () => {
        if (!userCode) return;
        try {
            await navigator.clipboard.writeText(userCode);
            toast.success('Kuran号已复制');
        } catch (error) {
            console.error('copy Kuran code failed:', error);
            toast.error('复制失败，请稍后重试');
        }
    };

    const handleWatchAd = () => {
        toast.error('观看广告功能开发中');
    };

    const handleRedeemMembership = async () => {
        const key = redeemKey.trim().toUpperCase();
        if (!key) {
            toast.error('请输入兑换码');
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
                toast.error(response.data.message || '兑换失败');
            }
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'response' in error) {
                const axiosError = error as { response?: { data?: { message?: string } } };
                toast.error(axiosError.response?.data?.message || '兑换失败，请稍后重试');
            } else {
                toast.error('兑换失败，请稍后重试');
            }
        } finally {
            setIsRedeemingMembership(false);
        }
    };

    const handleCopyInviteCode = () => {
        if (inviteCode) {
            navigator.clipboard.writeText(inviteCode);
            toast.success('邀请码已复制');
        } else {
            toast.error('暂无邀请码');
        }
    };

    const handleSubmitInviteCode = async () => {
        if (!inputInviteCode.trim()) {
            toast.error('请输入邀请码');
            return;
        }

        try {
            const response = await auth.useInviteCode({ inviteCode: inputInviteCode });
            if (response.data.success) {
                toast.success('邀请码提交成功');
                getUserInfo();
                setShowInputInviteCode(false);
                setInputInviteCode('');
            } else {
                toast.error(response.data.message || '操作失败');
            }
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'response' in error) {
                const axiosError = error as { response?: { data?: { message?: string } } };
                const errorMessage = axiosError.response?.data?.message || '提交邀请码失败';
                toast.error(errorMessage);
            } else {
                toast.error('提交邀请码失败');
            }
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
            toast.error('请输入正确的手机号');
            return;
        }
        if (bindPassword.length < 6) {
            toast.error('密码至少需6位');
            return;
        }
        if (bindPassword !== bindConfirmPassword) {
            toast.error('两次输入的密码不一致');
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
                toast.success('绑定成功！可在浏览器用手Q号 + 密码登录');
                setIsBindAccountModalOpen(false);
                clearBindAccountDraft();
            } else {
                toast.error(response.data.message || '绑定失败，请稍后重试');
            }
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'response' in error) {
                const axiosError = error as { response?: { data?: { message?: string } } };
                const errorMessage = axiosError.response?.data?.message || '绑定失败，请稍后重试';
                toast.error(errorMessage);
            } else {
                toast.error('绑定失败，请稍后重试');
            }
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

    const handleCheckInSuccess = () => {
        updateUser({ hasSignedIn: true });
        getUserInfo();
    };

    const handleStartEditName = () => {
        if (!user) {
            toast.error('请先登录');
            return;
        }
        setEditName(userName === '未设置' ? '' : userName);
        setIsEditingName(true);
    };

    const handleCancelEditName = () => {
        setIsEditingName(false);
        setEditName('');
    };

    const handleConfirmEditName = async () => {
        const newName = editName.trim();
        if (!newName) {
            toast.error('昵称不能为空');
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
                toast.success('昵称修改成功');
                setIsEditingName(false);
            } else {
                toast.error(response.data.message || '昵称修改失败');
            }
        } catch (error) {
            console.error('update nickname failed:', error);
            toast.error('昵称修改失败，请稍后重试');
        } finally {
            setIsUpdatingName(false);
        }
    };

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error('请选择图片文件');
            return;
        }

        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            toast.error('图片大小不能超过 5MB');
            return;
        }

        try {
            setIsUpdatingAvatar(true);
            const response = await auth.updateUserAvatar(file);
            if (response.data.success && response.data.data) {
                await getUserInfo();
                toast.success('头像更新成功');
            } else {
                toast.error(response.data.message || '头像更新失败');
            }
        } catch (error) {
            console.error('update avatar failed:', error);
            toast.error('头像更新失败，请稍后重试');
        } finally {
            setIsUpdatingAvatar(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
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

        toast.error(response.data.message || '充值失败！');
        return null;
    };

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
                                    onChange={handleAvatarChange}
                                    style={{ display: 'none' }}
                                />
                                <img
                                    className={styles.userAvatar}
                                    src={userAvatar}
                                    alt={'用户头像'}
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
                                                {user?.user?.memberPlan === 'month' ? '月卡会员' :
                                                user?.user?.memberPlan === 'season' ? '季卡会员' :
                                                user?.user?.memberPlan === 'year' ? '年卡会员' : 'VIP'}
                                            </span>
                                            <span className={styles.memberExpire}>{`到期时间：${formatDate(user.user.memberEndAt)}`}</span>
                                        </div>
                                    ) : null}
                                    {userCode && (
                                        <div className={styles.userCode}>
                                            <span className={styles.userCodeText}>{`Kuran号：${userCode}`}</span>
                                            <button
                                                type="button"
                                                className={styles.userCodeCopyButton}
                                                onClick={handleCopyUserCode}
                                                title={'复制 Kuran 号'}
                                            >
                                                <MdContentCopy />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className={styles.functionList}>
                        <div className={styles.functionItem}>
                            <div className={styles.functionIcon}>
                                <RiCopperCoinLine />
                            </div>
                            <div className={styles.functionText}>
                                <div className={styles.functionTitle}>{'我的积分'}</div>
                                <div className={styles.functionDesc}>{`当前积分：${user?.user?.points ?? 0}`}</div>
                            </div>
                            <div className={styles.pointsActions}>
                                {isMobile && (
                                    <button className={styles.payButton} onClick={() => setIsRechargeModalOpen(true)}>
                                        <span>{'充值'}</span>
                                    </button>
                                )}
                                <button className={styles.functionButton} onClick={() => setIsCheckInModalOpen(true)}>
                                    {'签到'}
                                </button>
                            </div>
                        </div>

                        {/* 实现推广分享入口前移 */}
                        <div className={styles.functionItem}>
                            <div className={styles.functionIcon}>
                                <MdCampaign />
                            </div>
                            <div className={styles.functionText}>
                                <div className={styles.functionTitle}>推广分享</div>
                                {/* 实现推广文案更新 */}
                                <div className={styles.functionDesc}>参加推广活动，赚取海量积分和奖励</div>
                            </div>
                            <button className={styles.functionButton} onClick={() => navigate('/promotions')}>
                                进入
                            </button>
                        </div>

                        {/* 观看广告 */}
                        <div className={styles.functionItem}>
                            <div className={styles.functionIcon}>
                                <MdPlayCircleOutline />
                            </div>
                            <div className={styles.functionText}>
                                <div className={styles.functionTitle}>{'观看广告'}</div>
                                <div className={styles.functionDesc}>{'每看一个可获得8积分'}</div>
                            </div>
                            <button className={styles.functionButton} onClick={handleWatchAd}>
                                {'观看'}
                            </button>
                        </div>

                        <div className={styles.functionItem}>
                            <div className={styles.functionIcon}>
                                <MdOutlineQrCodeScanner />
                            </div>
                            <div className={styles.functionText}>
                                <div className={styles.functionTitle}>{`我的邀请码：${user?.user?.inviteCode ? user?.user?.inviteCode : inviteCode}`}</div>
                                <div className={styles.functionDesc}>{'朋友使用后双方+30积分'}</div>
                            </div>
                            <button className={styles.functionButton} onClick={handleCopyInviteCode}>
                                {'复制'}
                            </button>
                        </div>

                        <div className={styles.functionItem}>
                            <div className={styles.functionIcon}>
                                <MdPersonAddAlt1 />
                            </div>
                            {!showInputInviteCode ? (
                                <>
                                    <div className={styles.functionText}>
                                        <div className={styles.functionTitle}>{'输入邀请码'}</div>
                                        <div className={styles.functionDesc}>{'仅限一次，朋友使用后双方+30积分'}</div>
                                    </div>
                                    <button className={styles.functionButton} onClick={() => setShowInputInviteCode(true)}>
                                        {'输入'}
                                    </button>
                                </>
                            ) : (
                                <>
                                    <input
                                        type="text"
                                        className={styles.inviteInput}
                                        placeholder={'请输入邀请码'}
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
                                        {'提交'}
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
                                        <div className={styles.functionTitle}>{'会员卡兑换'}</div>
                                        <div className={styles.functionDesc}>{'输入兑换码可开通月卡、季卡、年卡'}</div>
                                    </div>
                                    <button className={styles.functionButton} onClick={() => setShowRedeemInput(true)}>
                                        {'兑换'}
                                    </button>
                                </>
                            ) : (
                                <>
                                    <input
                                        type="text"
                                        className={styles.inviteInput}
                                        placeholder={'请输入兑换码'}
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
                                        {isRedeemingMembership ? '兑换中...' : '兑换'}
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
                                    <div className={styles.functionTitle}>{'浏览器登录账号'}</div>
                                    <div className={styles.functionDesc}>
                                        {user?.user?.phoneNumber
                                            ? `已绑定手机号：${maskPhoneNumber(user?.user?.phoneNumber)}，可在浏览器登录`
                                            : '设置手机号和密码，用于在浏览器中登录同一账号'}
                                    </div>
                                </div>
                                <button className={styles.functionButton} onClick={handleOpenBindAccountModal}>
                                    {user?.user?.phoneNumber ? '已绑定' : '去设置'}
                                </button>
                            </div>
                        )}

                        <div className={styles.functionItem}>
                            <div className={styles.functionIcon}>
                                <MdGroup />
                            </div>
                            <div className={styles.functionText}>
                                <div className={styles.functionTitle}>{'加入用户群'}</div>
                                <div className={styles.functionDesc}>{'加群可获得20积分，及时掌握最新资讯'}</div>
                            </div>
                            <button className={styles.functionButton} onClick={handleJoinGroup}>
                                {'加入'}
                            </button>
                        </div>

                        {!isWebViewEnv() && (
                            <div className={styles.functionItem}>
                                <div className={styles.functionIcon}>
                                    <RiLogoutCircleRLine />
                                </div>
                                <div className={styles.functionText}>
                                    <div className={styles.functionTitle}>{'退出登录'}</div>
                                    <div className={styles.functionDesc}>{'退出当前账号'}</div>
                                </div>
                                <button className={styles.functionButton} onClick={handleLogout}>
                                    {'退出'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <MobileBottomNav />

            {isEditingName && (
                <div className={styles.editNameModalOverlay} onClick={handleCancelEditName}>
                    <div className={styles.editNameModal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.editNameModalHeader}>
                            <div className={styles.editNameModalTitle}>{'修改昵称'}</div>
                        </div>
                        <div className={styles.editNameModalBody}>
                            <input
                                className={styles.editNameInput}
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                placeholder={'请输入新的昵称'}
                                maxLength={20}
                                autoFocus
                            />
                            <div className={styles.editNameTips}>{'昵称长度建议 1-20 个字符，避免包含敏感或违规内容。'}</div>
                        </div>
                        <div className={styles.editNameModalActions}>
                            <button
                                type="button"
                                className={styles.editNameCancelButton}
                                onClick={handleCancelEditName}
                                disabled={isUpdatingName}
                            >
                                {'取消'}
                            </button>
                            <button
                                type="button"
                                className={styles.editNameConfirmButton}
                                onClick={handleConfirmEditName}
                                disabled={isUpdatingName}
                            >
                                {isUpdatingName ? '保存中...' : '确认'}
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
                            <div className={styles.editNameModalTitle}>{'设置浏览器登录账号'}</div>
                        </div>
                        <div className={styles.editNameModalBody}>
                            <input
                                className={styles.editNameInput}
                                placeholder={'请输入手机号'}
                                value={bindPhone}
                                onChange={(e) => setBindPhone(e.target.value)}
                                maxLength={11}
                            />
                            <input
                                type="password"
                                className={styles.editNameInput}
                                placeholder={'请设置密码（至少6位）'}
                                value={bindPassword}
                                onChange={(e) => setBindPassword(e.target.value)}
                            />
                            <input
                                type="password"
                                className={styles.editNameInput}
                                placeholder={'请再次输入密码'}
                                value={bindConfirmPassword}
                                onChange={(e) => setBindConfirmPassword(e.target.value)}
                            />
                            <div className={styles.editNameTips}>{'绑定后，可在浏览器访问本站时使用手机号 + 已设置的密码登录同一账号。'}</div>
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
                                {'取消'}
                            </button>
                            <button
                                type="button"
                                className={styles.editNameConfirmButton}
                                onClick={handleConfirmBindAccount}
                                disabled={isBindingAccount}
                            >
                                {isBindingAccount ? '绑定中...' : '确认绑定'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isBindAccountStatusModalOpen && (
                <div className={styles.editNameModalOverlay} onClick={() => setIsBindAccountStatusModalOpen(false)}>
                    <div className={styles.editNameModal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.editNameModalHeader}>
                            <div className={styles.editNameModalTitle}>{'浏览器登录账号已绑定'}</div>
                        </div>
                        <div className={styles.editNameModalBody}>
                            <div className={styles.bindAccountStatusText}>{`已绑定手机号：${maskPhoneNumber(user?.user?.phoneNumber)}`}</div>
                            <div className={styles.editNameTips}>{'你可以在浏览器端使用该手机号和已设置的密码登录同一个账号。'}</div>
                        </div>
                        <div className={styles.editNameModalActions}>
                            <button
                                type="button"
                                className={styles.editNameConfirmButton}
                                onClick={() => setIsBindAccountStatusModalOpen(false)}
                            >
                                {'我知道了'}
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

            <CheckInModal
                isOpen={isCheckInModalOpen}
                onClose={() => setIsCheckInModalOpen(false)}
                onSignInSuccess={handleCheckInSuccess}
            />

            <MembershipRedeemResultModal
                isOpen={redeemSuccessPlanId !== null}
                onClose={() => setRedeemSuccessPlanId(null)}
                planId={redeemSuccessPlanId ?? 'month'}
            />
        </div>
    );
};

export default Profile;
