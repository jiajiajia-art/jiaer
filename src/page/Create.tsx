import React, { useEffect, useState, useMemo } from 'react';
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
import { MdContentCopy } from 'react-icons/md';
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
import ConfirmModal from '../components/CommonModal/ConfirmModal';
import PDFTemplateModal from '../components/GameSettingEditor/PDFTemplateModal';
import GameGridSkeleton from '../components/Skeleton/GameGridSkeleton';
import {
    getMiniProgramCreatorBlockedMessage,
    isMiniProgramCreatorTypeSupported,
    isMiniProgramEnv,
    MINI_PROGRAM_CREATOR_PC_URL,
    type CreatorGameType,
} from '../utils/miniProgram';

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
        totalAmount: 0, // 积分奖励总收益
        totalIncentiveAmount: 0, // 激励总收益（结算总收益-激励）
        pendingIncome: 0,
        isIncentive: false,
    });
    const [isRechargeModalOpen, setIsRechargeModalOpen] = useState(false);
    const [isCreateTypeModalOpen, setIsCreateTypeModalOpen] = useState(false);
    const [isMobileTipModalOpen, setIsMobileTipModalOpen] = useState(false);
    const [mobileTipMessage, setMobileTipMessage] = useState('');
    const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
    const [isSettling, setIsSettling] = useState(false);
    const [isPDFModalOpen, setIsPDFModalOpen] = useState(false);

    const handleOpenBindPhoneGuide = () => {
        // 实现跳转到“我的”页并拉起浏览器登录账号设置
        setIsMobileTipModalOpen(false);
        navigate('/profile?openBrowserLoginAccount=1');
    };

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
                    totalIncentiveAmount: response.data.data.totalIncentiveAmount ?? 0,
                    pendingIncome: response.data.data.pendingIncome ?? 0,
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

    const isMiniProgram = isMiniProgramEnv();

    const openMiniProgramTypeTip = (type: Extract<CreatorGameType, 'avg' | 'custom'>) => {
        // 小程序端暂不开放 AVG / 自定义编辑，统一引导去 PC 端。
        setMobileTipMessage(getMiniProgramCreatorBlockedMessage(type));
        setIsMobileTipModalOpen(true);
    };

    const handleSelectGameType = (type: CreatorGameType) => {
        // 小程序端当前只允许 TXT 模式进入创作者编辑器。
        if (isMiniProgram && !isMiniProgramCreatorTypeSupported(type)) {
            if (type === 'avg' || type === 'custom') {
                openMiniProgramTypeTip(type);
            }
            setIsCreateTypeModalOpen(false);
            return;
        }

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
                    <div className={styles.creatorHeroSection}>
                        <div className={styles.creatorHeroCard}>
                            <div className={styles.creatorHeroMain}>
                                <div className={styles.creatorHeroMeta}>
                                    <div className={styles.creatorHeroEyebrow}>Creator Studio</div>
                                    <div className={styles.creatorHeroName}>{userName}</div>
                                    <div className={styles.creatorHeroInfoRow}>
                                        <div className={styles.userCode}>
                                            <span className={styles.userCodeText}>Kuran号：{userCode || '--'}</span>
                                            {userCode && (
                                                <button
                                                    type="button"
                                                    className={styles.userCodeCopyButton}
                                                    onClick={handleCopyUserCode}
                                                    title="复制Kuran号"
                                                >
                                                    <MdContentCopy />
                                                </button>
                                            )}
                                        </div>
                                        <div className={styles.userCredit}>
                                            <span className={styles.userPoints}>
                                                <img src={`${import.meta.env.BASE_URL}data/assets/金币1.png`} alt="" className={styles.priceIcon} />
                                                积分：{user?.user?.points ?? 0}
                                            </span>
                                            <button
                                                className={`${styles.payButton} ${styles.desktopPayButton}`}
                                                onClick={() => setIsRechargeModalOpen(true)}
                                            >
                                                <span>充值</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className={styles.creatorHeroActions}>
                                    {/* 实现移动端操作按钮同行布局。 */}
                                    <div className={styles.createGameButtonRow}>
                                        <button
                                            className={`${styles.payButton} ${styles.mobilePayButton}`}
                                            onClick={() => setIsRechargeModalOpen(true)}
                                        >
                                            <span>充值</span>
                                        </button>
                                        <button
                                            className={styles.createGameButtonItem}
                                            onClick={() => {
                                                // 小程序端进入创作者首页后统一走模式选择弹窗。
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
                            <div className={`${styles.statBox} ${stats.totalAmount > 0 ? styles.statBoxWithAction : ''}`}>
                                <div className={styles.statLabel}>
                                    <img src={`${import.meta.env.BASE_URL}data/assets/金币1.png`} alt="" />
                                    <span>待结算奖励积分</span>
                                </div>
                                <div className={styles.statActionRow}>
                                    <div className={styles.statValue}>{stats.totalAmount}</div>
                                    {stats.totalAmount > 0 && (
                                        <button
                                            type="button"
                                            className={styles.settleButton}
                                            onClick={() => setIsSettleModalOpen(true)}
                                        >
                                            结算
                                        </button>
                                    )}
                                </div>
                            </div>
                            {stats.isIncentive && (
                                <div className={styles.statBox}>
                                    <div className={styles.statLabel} style={{ justifyContent: 'space-between', width: '100%' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <img src={`${import.meta.env.BASE_URL}data/assets/金币1.png`} alt="" />
                                            <span>结算总收益（激励）</span>
                                        </div>
                                    </div>
                                    <div className={styles.statValue}>{stats.totalIncentiveAmount}</div>
                                </div>
                            )}
                            {stats.isIncentive && (
                                <div className={styles.statBox}>
                                    <div className={styles.statLabel} style={{ justifyContent: 'space-between', width: '100%' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <img src={`${import.meta.env.BASE_URL}data/assets/金币1.png`} alt="" />
                                            <span>待结算激励收益</span>
                                        </div>
                                    </div>
                                    <div className={styles.statValue}>{stats.pendingIncome}</div>
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
                                primaryStat="pv"
                                isIncentive={stats.isIncentive}
                                showIncentiveUI={true}
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

            {/* 创作游戏相关弹窗 */}
            <CreateGameModals
                isCreateTypeModalOpen={isCreateTypeModalOpen}
                isMobileTipModalOpen={isMobileTipModalOpen}
                isMiniProgram={isMiniProgram}
                mobileTipTitle="请前往 PC 端操作"
                mobileTipMessage={mobileTipMessage}
                mobileTipLinkUrl={MINI_PROGRAM_CREATOR_PC_URL}
                onCloseCreateTypeModal={() => setIsCreateTypeModalOpen(false)}
                onCloseMobileTipModal={() => setIsMobileTipModalOpen(false)}
                onSelectGameType={handleSelectGameType}
                onOpenMiniProgramTip={openMiniProgramTypeTip}
                onOpenBindPhoneGuide={handleOpenBindPhoneGuide}
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
