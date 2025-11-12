import React, { useEffect, useRef, useState } from 'react';
import styles from './GameDetailModal.module.css';
import type { LibraryData } from '../api/home/libraryData.type';
import { useAuthStore, authModalStore } from '../store/useAuthStore';
import { useGameStore } from '../store/gameStore';
import { useNavigate } from 'react-router-dom';
import statisticsApi from '../api/statistics/statisticsApi';
import createSessionApi from '../api/createGame/createSessionApi';

interface GameDetailModalProps {
    isOpen: boolean;
    game: LibraryData;
    onClose: () => void;
}

const GameDetailModal: React.FC<GameDetailModalProps> = ({
    isOpen,
    game,
    onClose,
}) => {
    const { user } = useAuthStore();
    const { setPdfFileId, setSessionId } = useGameStore();
    const navigate = useNavigate();
    // 跟踪上一次的打开状态，用于检测弹窗从关闭到打开的变化
    const prevIsOpenRef = useRef(false);
    const [isLoading, setIsLoading] = useState(false);

    // 当弹窗打开时记录统计（每次打开都记录一次）
    useEffect(() => {
        // 检测弹窗从关闭到打开的状态变化
        const wasClosed = !prevIsOpenRef.current;
        const isNowOpen = isOpen;
        const justOpened = wasClosed && isNowOpen;

        // 更新状态
        prevIsOpenRef.current = isOpen;

        // 只有在弹窗刚打开时（从关闭到打开）才记录
        if (!justOpened) {
            return;
        }

        // 检查必要的数据
        if (!game || !game.file_id) {
            return;
        }

        // 检查用户是否登录
        if (!user?.user?.id) {
            return;
        }

        // 记录统计
        console.log('记录查看统计:', game.file_id);
        statisticsApi.addView({
            fileId: game.file_id,
            userId: String(user.user.id),
        }).catch((error) => {
            console.error('记录查看统计失败:', error);
        });
    }, [isOpen, game, user]);

    /**
     * 创建会话
     */
    const createSession = async (fileId: string): Promise<string | null> => {
        if (!fileId) {
            console.error('没有 fileId，无法创建 session');
            return null;
        }

        if (!user?.user?.userId || !user?.user?.id) {
            alert('用户信息错误，无法创建 session');
            return null;
        }

        console.log('创建会话', fileId, user.user.userId);
        setIsLoading(true);
        try {
            const response = await createSessionApi.getSession({
                fileId: fileId,
                userId: user.user.id
            });

            if (response.data.success) {
                const data = response.data.data;
                return data?.session.session_id || null;
            } else {
                alert(response.data.message || '创建游戏失败，请重试');
                return null;
            }
        } catch (error) {
            console.error('❌ Session 创建错误:', error);
            alert('创建游戏失败，请稍后重试');
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * 处理开始游戏按钮点击
     */
    const handleStartGame = async () => {
        // 检查用户是否登录
        if (!user?.user?.userId || !user?.user?.id) {
            // 打开登录弹窗
            authModalStore.getState().setIsAuthModalOpen(true);
            return;
        }

        const fileId = game?.file_id || game?.id;
        if (!fileId) {
            alert('游戏信息错误，请重试');
            return;
        }

        // 更新 store
        setPdfFileId(fileId);

        // 创建会话
        const sessionId = await createSession(fileId);

        if (sessionId) {
            setSessionId(sessionId);
            navigate('/newmain');
        }
    };

    if (!isOpen || !game) return null;

    return (
        <div className={`${styles.modal} ${styles.modalShow}`}>
            <div className={styles.gameDetailModal}>
                <button className={styles.detailModalClose} onClick={onClose}>
                    <img src={`${import.meta.env.BASE_URL}data/asset/关闭按钮.png`} alt="关闭" />
                </button>
                <h2 className={styles.detailMainTitle}>剧本详情</h2>

                <div className={styles.detailThreeColumns}>
                    <div className={styles.detailLeftColumn}>
                        {game.cover_url && (
                            <img
                                className={styles.detailLeftImage}
                                src={game.cover_url}
                                alt="游戏封面"
                            />
                        )}
                    </div>

                    <div className={styles.detailMiddleColumn}>
                        <h3 className={styles.detailGameTitle}>
                            {(game.title || '未命名游戏').toUpperCase()}
                        </h3>

                        <div className={styles.detailGameType}>
                            RPG
                        </div>

                        <div className={styles.detailDescription}>
                            {game.description ? <p>{game.description}</p> : <p>暂无描述</p>}
                        </div>

                        <div className={styles.detailAuthor}>
                            作者：{game.author_name || '未知作者'}
                        </div>
                    </div>

                    <div className={styles.detailRightColumn}>
                        <div className={styles.priceSection}>
                            <div className={styles.priceTitle}>特惠价格</div>
                            <div className={styles.priceValue}>
                                ￥{game.special_price_amount ?? game.price_amount ?? 0}
                            </div>
                            <button className={styles.unlockBtn}>
                                <img
                                    src={`${import.meta.env.BASE_URL}data/asset/剧本详情页/解锁剧本按钮.png`}
                                    alt="解锁剧本"
                                />
                            </button>
                        </div>

                        <div className={styles.startGameSection}>
                            <div className={styles.gameRating}>
                                <div className={styles.ratingLabel}>
                                    {(game.rating_avg ?? '9.0')}
                                    <span className={styles.ratingLabelUnit}>分</span>
                                </div>
                                <div className={styles.ratingStars}>
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <img
                                            key={star}
                                            src={`${import.meta.env.BASE_URL}data/asset/剧本详情页/星星.png`}
                                            alt="星星"
                                            className={styles.starIcon}
                                        />
                                    ))}
                                </div>
                                <div className={styles.ratingScore}>
                                    {(game.rating_count ?? 0)}人评价
                                </div>
                            </div>
                            <button className={styles.startGameBtn} onClick={handleStartGame} disabled={isLoading}>
                                {isLoading ? (
                                    <div className={styles.loading}>
                                        <span className={styles.loadingDot}></span>
                                        <span className={styles.loadingDot}></span>
                                        <span className={styles.loadingDot}></span>
                                    </div>
                                ) : (
                                    <img
                                        src={`${import.meta.env.BASE_URL}data/asset/剧本详情页/开始游戏按钮.png`}
                                        alt="开始游戏"
                                    />
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GameDetailModal;

