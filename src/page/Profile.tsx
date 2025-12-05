import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Profile.module.css';
import MobileBottomNav from '../components/Layout/MobileBottomNav';
import { useAuthStore } from '../store/useAuthStore';
import { auth } from '../api/account/authApi';
import Navbar from '../components/Layout/Navbar';
import { RiCopperCoinLine, RiLogoutCircleRLine } from 'react-icons/ri';
import { MdPlayCircleOutline, MdPersonAddAlt1, MdOutlineQrCodeScanner, MdGroup } from 'react-icons/md';
import toast, { Toaster } from 'react-hot-toast';

const Profile: React.FC = () => {
    const { user, logout, updateUser } = useAuthStore();
    const navigate = useNavigate();
    const [inviteCode, setInviteCode] = useState('');
    const [inputInviteCode, setInputInviteCode] = useState('');
    const [showInputInviteCode, setShowInputInviteCode] = useState(false);
    const [showJoinGroupModal, setShowJoinGroupModal] = useState(false);

    const handleLogout = () => {
        logout();
        navigate('/home');
    };

    // 获取用户信息并更新
    const getUserInfo = async () => {
        try {
            const response = await auth.getUserInfo();
            if (response.data.success && response.data.data) {
                updateUser(response.data.data);
                // 假设邀请码在用户数据中
                const userData = response.data.data as any;
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

    const userAvatar = `https://kurangames.com/images/${user?.user?.avatarUrl}` || `${import.meta.env.BASE_URL}data/assets/defaultAvatar.png`;
    const userName = user?.user?.nickname || user?.user?.name || '未设置';

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
        } catch (error: any) {
            // 多种方式获取错误信息
            const errorMessage = 
                error.response?.data?.message ||
                error.data?.message ||
                error.message ||
                '提交邀请码失败';
                
            toast.error(errorMessage);
        }
    };

    const handleJoinGroup = () => {
        setShowJoinGroupModal(true);
    };

    const handleCopyGroupNumber = () => {
        const groupNumber = '905065897';
        navigator.clipboard.writeText(groupNumber);
        toast.success('QQ群号已复制');
        setTimeout(() => {
            setShowJoinGroupModal(false);
        }, 3000);
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

    return (
        <div className={styles.pageRoot}>
            <Navbar />
            <Toaster />
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
                                <img
                                    className={styles.userAvatar}
                                    src={userAvatar}
                                    alt="用户头像"
                                />
                                <div className={styles.userName}>{userName}</div>
                            </div>
                        </div>
                    </div>

                    {/* 功能列表 */}
                    <div className={styles.functionList}>
                        {/* 积分展示 */}
                        <div className={styles.functionItem}>
                            <div className={styles.functionIcon}>
                                <RiCopperCoinLine />
                            </div>
                            <div className={styles.functionText}>
                                <div className={styles.functionTitle}>我的积分</div>
                                <div className={styles.functionDesc}>当前积分：{user?.user?.points ?? 0}</div>
                            </div>
                            <button 
                                className={`${styles.functionButton} ${user?.user?.hasSignedIn ? styles.functionButtonSignedIn : styles.functionButtonCheckIn}`}
                                onClick={handleCheckIn}
                                disabled={user?.user?.hasSignedIn}
                            >
                                {user?.user?.hasSignedIn ? '已签到' : '每日签到'}
                            </button>
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
                    </div>
                </div>
            </div>
            <MobileBottomNav />

            {/* 加入用户群弹窗 */}
            {showJoinGroupModal && (
                <div className={styles.groupModalOverlay} onClick={() => setShowJoinGroupModal(false)}>
                    <div className={styles.groupModalContent} onClick={(e) => e.stopPropagation()}>
                        {/* 图片 */}
                        <div className={styles.groupModalImage}>
                            <img
                                src={`${import.meta.env.BASE_URL}data/assets/QQ1.png`}
                                alt="QQ群"
                                onError={(e) => {
                                    // 如果图片加载失败，使用默认图片
                                    (e.target as HTMLImageElement).src = `${import.meta.env.BASE_URL}data/assets/defaultAvatar.png`;
                                }}
                            />
                        </div>

                        {/* 文字内容 */}
                        <div className={styles.groupModalText}>
                            点击复制QQ群号，加入用户交流群
                            <span className={styles.groupNumber}>905065897</span>
                        </div>

                        {/* 按钮区域 */}
                        <div className={styles.groupModalButtons}>
                            <button
                                className={styles.groupModalCancelBtn}
                                onClick={() => setShowJoinGroupModal(false)}
                            >
                                取消
                            </button>
                            <button
                                className={styles.groupModalCopyBtn}
                                onClick={handleCopyGroupNumber}
                            >
                                复制
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Profile;
