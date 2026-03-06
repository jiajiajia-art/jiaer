import React, { useEffect, useState, useMemo, useRef } from 'react';
import styles from './Create.module.css';
import Navbar from '../components/Layout/Navbar';
import FooterArea from '../components/Layout/FooterArea';
import GameGrid from '../components/GameGrid';
import { useAuthStore } from '../store/useAuthStore';
import getGameDataApi from '../api/home/getGameData';
import type { UserGameData } from '../api/home/getGameData.type';
import { IoEye, IoStatsChartSharp } from 'react-icons/io5';
import { TbHandClick } from 'react-icons/tb';
import { HiOutlineLightBulb } from 'react-icons/hi';
import { MdEdit, MdContentCopy } from 'react-icons/md';
import { useNavigate } from 'react-router-dom';
import MobileBottomNav from '../components/Layout/MobileBottomNav';
import statisticsApi from '../api/statistics/statisticsApi';
import RechargeModal from '../components/Purchase/RechargeModal';
import CreateGameModals from '../components/CreateGame/CreateGameModals';
import toast from 'react-hot-toast';
import payApi from '../api/pay/payApi';
import { auth } from '../api/account/authApi';
import { useEditorStore } from '../store/editorStore';
import { useGameStore } from '../store/gameStore';
import { getImageUrl } from '../utils/constants';
import ConfirmModal from '../components/CommonModal/ConfirmModal';
import PDFTemplateModal from '../components/GameSettingEditor/PDFTemplateModal';
import GameGridSkeleton from '../components/Skeleton/GameGridSkeleton';

const Create: React.FC = () => {
    const { user, updateUser } = useAuthStore();
    const { clearState } = useEditorStore();
    const { clearAll } = useGameStore();
    const navigate = useNavigate();
    const [fileMetas, setFileMetas] = useState<UserGameData[]>([]);
    const [isLoadingMyGames, setIsLoadingMyGames] = useState<boolean>(true);
    const [stats, setStats] = useState({
        totalCreated: 0,
        totalViews: 0,
        totalClicks: 0,
        totalAmount: 0,
        totalSettleAmount: 0,
        isIncentive: false,
    });
    const [isRechargeModalOpen, setIsRechargeModalOpen] = useState(false);
    const [isCreateTypeModalOpen, setIsCreateTypeModalOpen] = useState(false);
    const [isMobileTipModalOpen, setIsMobileTipModalOpen] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [editName, setEditName] = useState('');
    const [isUpdatingName, setIsUpdatingName] = useState(false);
    const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);
    const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
    const [isSettling, setIsSettling] = useState(false);
    const [isPDFModalOpen, setIsPDFModalOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { publishedGames, draftGames } = useMemo(() => {
        const published: UserGameData[] = [];
        const drafts: UserGameData[] = [];

        fileMetas.forEach((game) => {
            if (game.is_public === 1) {
                published.push(game);
            } else {
                drafts.push(game);
            }
        });

        return {
            publishedGames: published,
            draftGames: drafts,
        };
    }, [fileMetas]);

    // 加载我的游戏数据
    const loadMyGames = async () => {
        if (!user?.user?.id) {
            return;
        }
        setIsLoadingMyGames(true);
        try {
            const response = await getGameDataApi.getUserData({ limit: 100 });
            if (response.data.success && response.data.data) {
                setFileMetas(response.data.data);
            } else {
                setFileMetas([]);
            }
        } catch (error) {
            console.error('获取我的游戏列表错误:', error);
            setFileMetas([]);
        } finally {
            setIsLoadingMyGames(false);
        }
    };

    const getGameTotalStats = async () => {
        if (!user?.user?.id) {
            return;
        }
        try {
            const response = await statisticsApi.getALLGameStats();
            if (response.data.success && response.data.data) {
                setStats({
                    totalCreated: response.data.data.Count ?? 0,
                    totalViews: response.data.data.pv ?? 0,
                    totalClicks: response.data.data.uv ?? 0,
                    totalAmount: response.data.data.totalAmount ?? 0,
                    totalSettleAmount: (response.data.data.uv ?? 0) * 5 || 0,
                    isIncentive: response.data.data.isIncentive ?? false,
                });
            }
        } catch (error) {
            console.error('获取我的游戏列表错误:', error);
        }
    };

    const getUserInfo = async () => {
        try {
            const response = await auth.getUserInfo();
            if (response.data.success && response.data.data) {
                updateUser(response.data.data);
            }
        } catch (error) {
            console.error('获取用户信息错误:', error);
        }
    };

    useEffect(() => {
        loadMyGames();
        getGameTotalStats();
        getUserInfo();
    }, [user?.user.id]);

    // 暂时隐藏
    // const renderGameActions = (game: UserGameData) => {
    //     const isPublic = game.is_public === 1;

    //     return (
    //         <button
    //             type="button"
    //             onClick={(e) => {
    //                 e.stopPropagation();
    //                 if (!game.file_id) return;
    //                 navigate(`/createGame?mode=stats&gameId=${game.file_id}`);
    //             }}
    //         >
    //             {isPublic ? '查看数据' : '继续编辑'}
    //         </button>
    //     );
    // };

    const userAvatar = getImageUrl(user?.user?.avatarUrl) || `${import.meta.env.BASE_URL}/data/assets/defaultAvatar.png`;
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

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // 验证文件类型
        if (!file.type.startsWith('image/')) {
            toast.error('请选择图片文件');
            return;
        }

        // 验证文件大小（例如限制为 5MB）
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            toast.error('图片大小不能超过 5MB');
            return;
        }

        try {
            setIsUpdatingAvatar(true);
            const response = await auth.updateUserAvatar(file);
            if (response.data.success && response.data.data) {
                // 更新用户信息
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
            // 清空 input，以便可以重复选择同一文件
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

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

    const handleSettle = async () => {
        if (isSettling) return;
        
        setIsSettling(true);
        try {
            const response = await auth.settlePoints();
            if (response.data.success && response.data.data) {
                const settlementAmount = response.data.data.settlementAmount || 0;
                toast.success(`结算成功！已结算 ${settlementAmount} 积分`);
                await getGameTotalStats();
                await getUserInfo();
                setIsSettleModalOpen(false);
            } else {
                toast.error(response.data.message || '结算失败，请重试');
            }
        } catch (error: any) {
            const errorMessage = error?.response?.data?.message || error?.message || '结算失败，请重试';
            toast.error(errorMessage);
        } finally {
            setIsSettling(false);
        }
    };

    const handleSelectGameType = (type: 'avg' | 'rpg' | 'txt' | 'custom') => {
        clearAll();
        if (type === 'rpg') {
            navigate('/createGame');
        } else if (type === 'txt') {
            clearState();
            navigate('/gameSettingsEditor');
        } else if (type === 'custom') {
            clearState();
            navigate('/customif/create');
        } else if (type === 'avg') {
            clearState();
            navigate('/gameSettingsEditor?mode=worldInteraction');
        }
        setIsCreateTypeModalOpen(false);
    };

    return (
        <div className={styles.pageRoot}>
            <Navbar />

            <div className={styles.mainContent}>
                <div className={styles.main}>
                    {/* 创作游戏按钮 */}
                    <div className={styles.createGameButton}>
                        <div className={styles.createGameButtonRow}>
                            <button
                                className={styles.createGameButtonItem}
                                onClick={() => {
                                    // 检测是否为移动端（断点与 CSS 保持一致：768px）
                                    const isMobile = window.innerWidth <= 768;
                                    if (isMobile) {
                                        setIsMobileTipModalOpen(true);
                                        return;
                                    }
                                    setIsCreateTypeModalOpen(true);
                                }}
                            >
                                <HiOutlineLightBulb />
                                <span>创作游戏</span>
                            </button>
                            <button
                                className={styles.helpButton}
                                onClick={() => setIsPDFModalOpen(true)}
                                title="PDF模板指引"
                            >
                                <span className={styles.helpIcon}>?</span>
                            </button>
                        </div>
                        <button
                            className={`${styles.createGameButtonItem}`}
                            onClick={() => navigate('/profile')}
                        >
                            活动获取积分
                        </button>
                    </div>

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
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                    onChange={handleAvatarChange}
                                    disabled={isUpdatingAvatar}
                                />
                                <img
                                    className={styles.userAvatar}
                                    src={userAvatar}
                                    alt="用户头像"
                                    onClick={() => fileInputRef.current?.click()}
                                    style={{ cursor: isUpdatingAvatar ? 'wait' : 'pointer' }}
                                    title={isUpdatingAvatar ? '上传中...' : '点击更换头像'}
                                />
                                <div className={styles.userNameRow}>
                                    <div className={styles.userName}>{userName}</div>
                                    <button
                                        type="button"
                                        className={styles.editNameButton}
                                        onClick={handleStartEditName}
                                        title="修改昵称"
                                    >
                                        <MdEdit />
                                    </button>
                                </div>
                                {userCode && window.innerWidth <= 768 && (
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
                                <div className={styles.userCredit}>
                                    <span className={styles.userPoints}>
                                        <img src={`${import.meta.env.BASE_URL}data/assets/金币.png`} alt="" className={styles.priceIcon} />

                                        积分：{user?.user?.points ?? 0}
                                    </span>
                                    <button
                                        className={`${styles.payButton}`}
                                        onClick={() => setIsRechargeModalOpen(true)}
                                    >
                                        <span>充值</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 我的数据模块 */}
                    <div className={styles.statsSection}>
                        <div className={styles.sectionHeader}>
                            <div className={styles.sectionTitle}>
                                <img src={`${import.meta.env.BASE_URL}data/assets/create/我的数据.png`} alt="" />
                            </div>
                            <img
                                className={styles.sectionDividerDesktop}
                                src={`${import.meta.env.BASE_URL}data/assets/home/分界线.png`}
                                alt=""
                            />
                            <img
                                className={styles.sectionDividerMobile}
                                src={`${import.meta.env.BASE_URL}data/assets/home/分界线移动端.png`}
                                alt=""
                            />
                            <button
                                type="button"
                                className={`${styles.more} ${styles.moreText}`}
                            >
                                每晚12:00更新
                                <img src={`${import.meta.env.BASE_URL}data/assets/home/箭头.png`} alt="" />                            </button>
                        </div>
                        <div className={styles.statsGrid}>
                            <div className={styles.statBox}>
                                <div className={styles.statLabel}>
                                    <IoStatsChartSharp />
                                    <span>创作总数</span>
                                </div>
                                <div className={styles.statValue}>{stats.totalCreated}</div>
                            </div>
                            <div className={styles.statBox}>
                                <div className={styles.statLabel}>
                                    <IoEye />
                                    <span>作品访问次数</span>
                                </div>
                                <div className={styles.statValue}>{stats.totalViews}</div>
                            </div>
                            <div className={styles.statBox}>
                                <div className={styles.statLabel}>
                                    <TbHandClick />
                                    <span>作品访问人数</span>
                                </div>
                                <div className={styles.statValue}>{stats.totalClicks}</div>
                            </div>
                            <div className={styles.statBox}>
                                <div className={styles.statLabel} style={{ justifyContent: 'space-between', width: '100%' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <img src={`${import.meta.env.BASE_URL}data/assets/金币1.png`} alt="" />
                                        <span>积分总收益</span>
                                    </div>
                                    {stats.totalAmount > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => setIsSettleModalOpen(true)}
                                            style={{
                                                padding: '6px 12px',
                                                backgroundColor: '#FB4655',
                                                color: '#fff',
                                                border: 'none',
                                                borderRadius: '4px',
                                                fontSize: '14px',
                                                cursor: 'pointer',
                                                fontWeight: 500,
                                            }}
                                        >
                                            结算
                                        </button>
                                    )}
                                </div>
                                <div className={styles.statValue}>{stats.totalAmount}</div>
                            </div>
                            {stats.isIncentive && (
                                <div className={styles.statBox}>
                                    <div className={styles.statLabel} style={{ justifyContent: 'space-between', width: '100%' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <img src={`${import.meta.env.BASE_URL}data/assets/金币1.png`} alt="" />
                                            <span>结算总收益</span>
                                        </div>
                                    </div>
                                    <div className={styles.statValue}>{stats.totalSettleAmount}</div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 发布作品模块 */}
                    <div className={styles.shopSection}>
                        <div className={styles.sectionHeader}>
                            <div className={styles.sectionTitle}>
                                <img src={`${import.meta.env.BASE_URL}data/assets/create/发布作品.png`} alt="" />
                            </div>
                            <img
                                className={styles.sectionDividerDesktop}
                                src={`${import.meta.env.BASE_URL}data/assets/home/分界线.png`}
                                alt=""
                            />
                            <img
                                className={styles.sectionDividerMobile}
                                src={`${import.meta.env.BASE_URL}data/assets/home/分界线移动端.png`}
                                alt=""
                            />
                            <button
                                type="button"
                                className={`${styles.more} ${styles.moreText}`}
                            >
                                更多
                                <img src={`${import.meta.env.BASE_URL}data/assets/home/箭头.png`} alt="" />
                            </button>
                        </div>

                        {isLoadingMyGames ? (
                            <GameGridSkeleton count={8} />
                        ) : publishedGames.length === 0 ? (
                            <div style={{ textAlign: 'center', color: '#999', height: '100px', lineHeight: '100px' }}>
                                暂无发布作品
                            </div>
                        ) : (
                            <GameGrid
                                games={publishedGames}
                                primaryStat="uv"
                                isIncentive={stats.isIncentive}
                                onGameClick={(game) => {
                                    const gameId = game.file_id || game.id;
                                    if (!gameId) return;
                                    navigate(`/createGame?mode=stats&gameId=${gameId}`);
                                }}
                            />
                        )}
                    </div>

                    <div className={styles.shopSection}>
                        <div className={styles.sectionHeader}>
                            <div className={styles.sectionTitle}>
                                <img src={`${import.meta.env.BASE_URL}data/assets/create/草稿箱.png`} alt="" />
                            </div>
                            <img
                                className={styles.sectionDividerDesktop}
                                src={`${import.meta.env.BASE_URL}data/assets/home/分界线.png`}
                                alt=""
                            />
                            <img
                                className={styles.sectionDividerMobile}
                                src={`${import.meta.env.BASE_URL}data/assets/home/分界线移动端.png`}
                                alt=""
                            />
                            <button
                                type="button"
                                className={`${styles.more} ${styles.moreText}`}
                            >
                                更多
                                <img src={`${import.meta.env.BASE_URL}data/assets/home/箭头.png`} alt="" />
                            </button>
                        </div>
                        {isLoadingMyGames ? (
                            <GameGridSkeleton count={8} />
                        ) : draftGames.length === 0 ? (
                            <div style={{ textAlign: 'center', color: '#999', height: '100px', lineHeight: '100px' }}>
                                开始创作你的第一个作品吧
                            </div>
                        ) : (
                            <GameGrid
                                games={draftGames}
                                onGameClick={(game) => {
                                    const gameId = game.file_id || game.id;
                                    if (!gameId) return;
                                    navigate(`/createGame?mode=stats&gameId=${gameId}`);
                                }}
                            />
                        )}
                    </div>
                </div>
            </div>
            <MobileBottomNav />

            <FooterArea />

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

            {/* 创作游戏相关弹窗 */}
            <CreateGameModals
                isCreateTypeModalOpen={isCreateTypeModalOpen}
                isMobileTipModalOpen={isMobileTipModalOpen}
                onCloseCreateTypeModal={() => setIsCreateTypeModalOpen(false)}
                onCloseMobileTipModal={() => setIsMobileTipModalOpen(false)}
                onSelectGameType={handleSelectGameType}
            />

            {/* 充值弹窗 */}
            <RechargeModal
                isOpen={isRechargeModalOpen}
                onClose={() => setIsRechargeModalOpen(false)}
                onRecharge={handleRecharge}
            />

            {/* 结算确认弹窗 */}
            <ConfirmModal
                isOpen={isSettleModalOpen}
                onConfirm={handleSettle}
                onCancel={() => setIsSettleModalOpen(false)}
                title="确认结算"
                message={`确定要结算当前总收益 ${stats.totalAmount} 积分吗？结算后积分将转入账户余额。`}
                confirmButtonText={isSettling ? "结算中..." : "确认结算"}
                cancelButtonText="取消"
            />

            {/* PDF模板指引弹窗 */}
            <PDFTemplateModal
                isOpen={isPDFModalOpen}
                onClose={() => setIsPDFModalOpen(false)}
            />
        </div>
    );
};

export default Create;
