import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Profile.module.css';
import MobileBottomNav from '../components/Layout/MobileBottomNav';
import { useAuthStore } from '../store/useAuthStore';
import { auth } from '../api/account/authApi';
import payApi from '../api/pay/payApi';
import Navbar from '../components/Layout/Navbar';
import RechargeModal from '../components/Purchase/RechargeModal';
import { RiCopperCoinLine, RiLogoutCircleRLine } from 'react-icons/ri';
import { MdPlayCircleOutline, MdPersonAddAlt1, MdOutlineQrCodeScanner, MdGroup, MdEdit, MdContentCopy } from 'react-icons/md';
import toast from 'react-hot-toast';
import JoinGroupModal from '../components/JoinGroupModal';
import { getImageUrl } from '../utils/constants';
import type { User } from '../api/account/auth.type';

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

const Profile: React.FC = () => {
    const { user, logout, updateUser } = useAuthStore();
    const navigate = useNavigate();
    const [inviteCode, setInviteCode] = useState('');
    const [inputInviteCode, setInputInviteCode] = useState('');
    const [showInputInviteCode, setShowInputInviteCode] = useState(false);
    const [showJoinGroupModal, setShowJoinGroupModal] = useState(false);

    // 积分充值相关状态
    const [isRechargeModalOpen, setIsRechargeModalOpen] = useState(false);

    // 昵称编辑相关状态
    const [isEditingName, setIsEditingName] = useState(false);
    const [editName, setEditName] = useState('');
    const [isUpdatingName, setIsUpdatingName] = useState(false);

    // 头像上传相关状态
    const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 浏览器登录账号绑定相关状态
    const [isBindAccountModalOpen, setIsBindAccountModalOpen] = useState(false);
    const [bindPhone, setBindPhone] = useState('');
    const [bindPassword, setBindPassword] = useState('');
    const [bindConfirmPassword, setBindConfirmPassword] = useState('');
    const [isBindingAccount, setIsBindingAccount] = useState(false);

    // 移动端判断
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    // 监听窗口大小变化
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

    // 获取用户信息并更新
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
            console.error('获取用户信息失败:', error);
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
            console.error('复制 Kuran号 失败:', error);
            toast.error('复制失败，请稍后重试');
        }
    };

    const handleWatchAd = () => {
        // TODO: 实现观看广告逻辑
        toast.error('观看广告功能开发中');
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

        console.log('提交邀请码:', inputInviteCode);

        try {
            const response = await auth.useInviteCode({ inviteCode: inputInviteCode });
            console.log('完整响应:', response);
            console.log('响应数据:', response.data);

            if (response.data.success) {
                toast.success('邀请码提交成功');
                getUserInfo();
                // 提交成功后隐藏输入框
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

    // 浏览器登录账号绑定相关函数
    const handleOpenBindAccountModal = () => {
        if (user?.user?.phoneNumber) {
            toast.success('已绑定浏览器登录账号，可在浏览器用手机号 + 密码登录');
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
            toast.error('密码至少需要6位');
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
                toast.success('绑定成功！可在浏览器用手机号 + 密码登录');
                setIsBindAccountModalOpen(false);
                setBindPhone('');
                setBindPassword('');
                setBindConfirmPassword('');
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


    const handleCheckIn = async () => {
        console.log("user?.hasSignedIn", user?.user?.hasSignedIn);

        if (user?.user?.hasSignedIn) {
            toast.error('今日已签到');
            return;
        }
        const response = await auth.checkIn();
        if (response.data.success) {
            toast.success('签到成功，获得9积分');
            getUserInfo();
        }
    };

    // 昵称编辑相关函数
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
            console.error('修改昵称失败:', error);
            toast.error('昵称修改失败，请稍后重试');
        } finally {
            setIsUpdatingName(false);
        }
    };

    // 头像上传相关函数
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
            console.error('更新头像失败:', error);
            toast.error('头像更新失败，请稍后重试');
        } finally {
            setIsUpdatingAvatar(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    // 积分充值相关函数
    const handleRecharge = async (amount: number) => {
        const response = await payApi.getPayQrCode({
            amount: amount,
        });
        if (response.data.code === 200 && response.data.data) {
            getUserInfo();
            return {
                qrDataUrl: response.data.data.qrDataUrl,
                outTradeNo: response.data.data.outTradeNo
            };
        } else {
            toast.error('充值失败！');
            return null;
        }
    };

    return (
        <div className={styles.pageRoot}>
            <Navbar />
            <div className={styles.mainContent}>
                <div className={styles.main}>
                    {/* 用户信息展示区域 */}
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
                                    alt="用户头像"
                                    onClick={() => !isUpdatingAvatar && fileInputRef.current?.click()}
                                    style={{ cursor: !isUpdatingAvatar ? 'pointer' : 'default' }}
                                />
                                <div className={styles.userNameWrapper}>
                                    <div className={styles.userName}>{userName}</div>
                                    <MdEdit
                                        className={styles.editNameIcon}
                                        onClick={handleStartEditName}
                                    />
                                </div>
                                {userCode && (
                                    <div className={styles.userCode}>
                                        <span className={styles.userCodeText}>Kuran号：{userCode}</span>
                                        <button
                                            type="button"
                                            className={styles.userCodeCopyButton}
                                            onClick={handleCopyUserCode}
                                            title="复制Kuran号"
                                        >
                                            <MdContentCopy />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 功能列表 */}
                    <div className={styles.functionList}>
                        {/* 积分展示与充值 */}
                        <div className={styles.functionItem}>
                            <div className={styles.functionIcon}>
                                <RiCopperCoinLine />
                            </div>
                            <div className={styles.functionText}>
                                <div className={styles.functionTitle}>我的积分</div>
                                <div className={styles.functionDesc}>当前积分：{user?.user?.points ?? 0}</div>
                            </div>
                            <div className={styles.pointsActions}>
                                {isMobile && (
                                    <button
                                        className={styles.payButton}
                                        onClick={() => setIsRechargeModalOpen(true)}
                                    >
                                        <span>充值</span>
                                    </button>
                                )}
                                <button
                                    className={`${styles.functionButton} ${user?.user?.hasSignedIn ? styles.functionButtonSignedIn : styles.functionButtonCheckIn}`}
                                    onClick={handleCheckIn}
                                    disabled={user?.user?.hasSignedIn}
                                >
                                    {user?.user?.hasSignedIn ? '已签到' : '每日签到'}
                                </button>
                            </div>
                        </div>

                        {/* 观看广告 */}
                        <div className={styles.functionItem}>
                            <div className={styles.functionIcon}>
                                <MdPlayCircleOutline />
                            </div>
                            <div className={styles.functionText}>
                                <div className={styles.functionTitle}>观看广告</div>
                                <div className={styles.functionDesc}>每看完一个可获得8积分</div>
                            </div>
                            <button className={styles.functionButton} onClick={handleWatchAd}>
                                观看
                            </button>
                        </div>

                        {/* 我的邀请码 */}
                        <div className={styles.functionItem}>
                            <div className={styles.functionIcon}>
                                <MdOutlineQrCodeScanner />
                            </div>
                            <div className={styles.functionText}>
                                <div className={styles.functionTitle}>
                                    我的邀请码： <span>{user?.user?.inviteCode ? user?.user?.inviteCode : inviteCode}</span>
                                </div>
                                <div className={styles.functionDesc}>
                                    朋友使用后双方+30积分
                                </div>
                            </div>
                            <button className={styles.functionButton} onClick={handleCopyInviteCode}>
                                复制
                            </button>
                        </div>

                        {/* 输入邀请码 */}
                        <div className={styles.functionItem}>
                            <div className={styles.functionIcon}>
                                <MdPersonAddAlt1 />
                            </div>
                            {!showInputInviteCode ? (
                                <>
                                    <div className={styles.functionText}>
                                        <div className={styles.functionTitle}>输入邀请码</div>
                                        <div className={styles.functionDesc}>
                                            仅限一次，朋友使用后双方+30积分
                                        </div>
                                    </div>
                                    <button className={styles.functionButton} onClick={() => setShowInputInviteCode(true)}>
                                        输入
                                    </button>
                                </>
                            ) : (
                                <>
                                    <input
                                        type="text"
                                        className={styles.inviteInput}
                                        placeholder="请输入邀请码"
                                        value={inputInviteCode}
                                        onChange={(e) => setInputInviteCode(e.target.value)}
                                        onBlur={(e) => {
                                            // 检查失去焦点的目标是否是提交按钮
                                            const relatedTarget = e.relatedTarget as HTMLElement;
                                            if (!relatedTarget || !relatedTarget.closest('button')) {
                                                // 延迟处理，避免与提交按钮点击冲突
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
                                        提交
                                    </button>
                                </>)}

                        </div>

                        {/* 浏览器登录账号绑定 */}
                        {isWebViewEnv() && (
                            <div className={styles.functionItem}>
                                <div className={styles.functionIcon}>
                                    <MdPersonAddAlt1 />
                                </div>
                                <div className={styles.functionText}>
                                    <div className={styles.functionTitle}>浏览器登录账号</div>
                                    <div className={styles.functionDesc}>
                                        {user?.user?.phoneNumber
                                            ? `已绑定手机号：${maskPhoneNumber(user?.user?.phoneNumber)}，可在浏览器登录`
                                            : '设置手机号和密码，用于在浏览器中登录同一账号'}
                                    </div>
                                </div>
                                <button
                                    className={styles.functionButton}
                                    onClick={handleOpenBindAccountModal}
                                >
                                    {user?.user?.phoneNumber ? '已绑定' : '去设置'}
                                </button>
                            </div>
                        )}

                        {/* 加入用户群 */}
                        <div className={styles.functionItem}>
                            <div className={styles.functionIcon}>
                                <MdGroup />
                            </div>
                            <div className={styles.functionText}>
                                <div className={styles.functionTitle}>加入用户群</div>
                                <div className={styles.functionDesc}>加群获取20积分，掌握最新资讯</div>
                            </div>
                            <button className={styles.functionButton} onClick={handleJoinGroup}>
                                加入
                            </button>
                        </div>

                        {/* 退出登录 */}
                        {
                            !isWebViewEnv() && (

                                <div className={styles.functionItem}>
                                    <div className={styles.functionIcon}>
                                        <RiLogoutCircleRLine />
                                    </div>
                                    <div className={styles.functionText}>
                                        <div className={styles.functionTitle}>退出登录</div>
                                        <div className={styles.functionDesc}>退出当前账号</div>
                                    </div>
                                    <button className={styles.functionButton} onClick={handleLogout}>
                                        退出
                                    </button>
                                </div>
                            )
                        }
                    </div>
                </div>
            </div>
            <MobileBottomNav />

            {/* 修改昵称弹窗 */}
            {isEditingName && (
                <div
                    className={styles.editNameModalOverlay}
                    onClick={handleCancelEditName}
                >
                    <div
                        className={styles.editNameModal}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className={styles.editNameModalHeader}>
                            <div className={styles.editNameModalTitle}>修改昵称</div>
                        </div>
                        <div className={styles.editNameModalBody}>
                            <input
                                className={styles.editNameInput}
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                placeholder="请输入新的昵称"
                                maxLength={20}
                                autoFocus
                            />
                            <div className={styles.editNameTips}>
                                昵称长度建议 1-20 个字符，避免包含敏感或违规内容。
                            </div>
                        </div>
                        <div className={styles.editNameModalActions}>
                            <button
                                type="button"
                                className={styles.editNameCancelButton}
                                onClick={handleCancelEditName}
                                disabled={isUpdatingName}
                            >
                                取消
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

            {/* 浏览器登录账号绑定弹窗 */}
            {isBindAccountModalOpen && (
                <div
                    className={styles.editNameModalOverlay}
                    onClick={() => setIsBindAccountModalOpen(false)}
                >
                    <div
                        className={styles.editNameModal}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className={styles.editNameModalHeader}>
                            <div className={styles.editNameModalTitle}>设置浏览器登录账号</div>
                        </div>
                        <div className={styles.editNameModalBody}>
                            <input
                                className={styles.editNameInput}
                                placeholder="请输入手机号"
                                value={bindPhone}
                                onChange={(e) => setBindPhone(e.target.value)}
                                maxLength={11}
                            />
                            <input
                                type="password"
                                className={styles.editNameInput}
                                placeholder="请设置密码（至少6位）"
                                value={bindPassword}
                                onChange={(e) => setBindPassword(e.target.value)}
                            />
                            <input
                                type="password"
                                className={styles.editNameInput}
                                placeholder="请再次输入密码"
                                value={bindConfirmPassword}
                                onChange={(e) => setBindConfirmPassword(e.target.value)}
                            />
                            <div className={styles.editNameTips}>
                                绑定后，可在浏览器访问本站时使用手机号 + 密码登录同一账号。
                            </div>
                        </div>
                        <div className={styles.editNameModalActions}>
                            <button
                                type="button"
                                className={styles.editNameCancelButton}
                                onClick={() => setIsBindAccountModalOpen(false)}
                                disabled={isBindingAccount}
                            >
                                取消
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

            {/* 加入用户群弹窗（复用组件，双二维码、仅取消按钮） */}
            <JoinGroupModal isOpen={showJoinGroupModal} onClose={() => setShowJoinGroupModal(false)} />

            {/* 积分充值弹窗 */}
            <RechargeModal
                isOpen={isRechargeModalOpen}
                onClose={() => setIsRechargeModalOpen(false)}
                onRecharge={handleRecharge}
            />
        </div>
    );
};

export default Profile;
