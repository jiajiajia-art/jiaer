import React, { useState, useEffect } from 'react';
import styles from './Library.module.css';
import { useGameStore } from '../store/gameStore';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import createSessionApi from '../api/createGame/createSession.type';
import libraryDataApi from '../api/home/libraryData';

const Library: React.FC = () => {
    const [showGameModal, setShowGameModal] = useState(false);
    const [fileMetas, setFileMetas] = useState<any[]>([]);
    const [selectedGameMeta, setSelectedGameMeta] = useState<any | null>(null);

    const { setPdfFileId, setSessionId } = useGameStore();
    const navigator = useNavigate();


    /**
     * 显示游戏详情（从后端数据）
     */
    const showGameDetail = (meta: any) => {
        setSelectedGameMeta(meta);
        setShowGameModal(true);
    };

    /**
     * 从详情弹窗创建游戏
     */
    const handleCreateGameFromDetail = async () => {
        // 使用 file_id 或 id
        const fileId = selectedGameMeta?.file_id || selectedGameMeta?.id;
        if (!fileId) {
            alert('游戏信息错误，请重试');
            return;
        }
        // 同时更新 store 和直接传递给 createSession，确保立即生效
        setPdfFileId(fileId);
        const sessionId = await createSession(fileId);
        setSessionId(sessionId);
        if (sessionId) {
            navigator('/newmain');
        } else {
            alert('创建游戏失败，请重试');
        }
    };

    /**
     * 关闭弹窗
     */
    const closeModal = () => {
        setShowGameModal(false);
        setSelectedGameMeta(null);
    };

    /**
     * 创建会话
     */
    const createSession = async (fileIdParam?: string): Promise<string | null> => {
        // 优先使用传入的参数，否则从 store 读取
        const targetFileId = fileIdParam || useGameStore.getState().pdfFileId;

        if (!targetFileId) {
            console.error('没有 pdfFileId，无法创建 session');
            return null;
        }

        try {
            const response = await createSessionApi.createSession({
                fileId: targetFileId,
                playerName: '玩家'
            });

            if (response.data.success) {                
                const data = response.data;
                return data.sessionId;
            } else {
                alert(response.data.message);
                return null;
            }
        } catch (error) {
            console.error('❌ Session 创建错误:', error);
            return null;
        }
    };

    // ESC键关闭弹窗
    useEffect(() => {
        const handleEscKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (showGameModal) setShowGameModal(false);
            }
        };

        document.addEventListener('keydown', handleEscKey);
        return () => {
            document.removeEventListener('keydown', handleEscKey);
        };
    }, [showGameModal]);

    // 使用 libraryDataApi 获取游戏列表数据
    useEffect(() => {
        const loadLibraryData = async () => {
            try {
                const response = await libraryDataApi.getLibraryData({ limit: 10 });
                
                if (response.data.success && response.data.data) {
                    // 直接使用返回的数据，转换为组件需要的格式
                    const formattedData = response.data.data.map((item) => {
                        return {
                            id: item.file_id, // 使用 file_id 作为 id
                            file_id: item.file_id,
                            img: item.cover_url || `${import.meta.env.BASE_URL}data/events/welcome.png`,
                            title: item.subtitle || item.description || '未命名游戏',
                            subtitle: item.subtitle,
                            description: item.description,
                            authorName: item.authorName || '未知作者',
                            price: item.special_price_amount || item.price_amount,
                            rating: item.rating_avg,
                            ratingCount: item.rating_count,
                        };
                    });
                    
                    setFileMetas(formattedData);
                } else {
                    console.error('获取游戏列表失败:', response.data);
                    setFileMetas([]);
                }
            } catch (error) {
                console.error('获取游戏列表错误:', error);
                setFileMetas([]);
            }
        };

        loadLibraryData();
    }, []);

    return (
        <div className={styles.pageRoot}>
            {/* 顶部固定导航 */}
            <Navbar />

            {/* 主体 */}
            <div className={styles.mainContent}>
                {/* 左侧侧边栏 */}
                <Sidebar
                    items={[
                        {
                            id: 'home',
                            label: '首页',
                            icon: 'data/asset/首页/homeIcon.png',
                            route: '/home',
                        },
                        {
                            id: 'library',
                            label: '全部',
                            route: '/home/library',
                        }
                    ]}
                />

                {/* 右侧内容区域 - Library 特有的内容 */}
                <div className={styles.main}>
                    <div className={styles.libraryContent}>
                        <div className={styles.grid4}>
                            {fileMetas.length === 0 ? (
                                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '50px', color: '#5E4630' }}>
                                    <h2 style={{ fontSize: '24px', marginBottom: '10px' }}>⏳ 加载中...</h2>
                                    <p style={{ fontSize: '16px', opacity: 0.9 }}>正在加载剧情文件信息</p>
                                </div>
                            ) : (
                                fileMetas.map((meta, idx) => (
                                    <div
                                        className={styles.goodsCard}
                                        key={meta.id}
                                        onClick={() => {
                                            showGameDetail(meta);
                                        }}
                                    >
                                        <div className={styles.goodsImg}>
                                            <img
                                                src={meta.img || `${import.meta.env.BASE_URL}data/events/welcome.png`}
                                                alt={meta.title || `剧情${idx + 1}`}
                                            />
                                        </div>
                                        <div className={styles.goodsBody}>
                                            <div className={styles.goodsTitle}>
                                                {meta.title || `剧情${idx + 1}`}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* 游戏详情弹窗（三栏布局） */}
            {showGameModal && selectedGameMeta && (
                <div
                    className={`${styles.modal} ${styles.modalShow}`}
                >
                    <button className={styles.detailModalClose} onClick={closeModal}>
                        <img src={`${import.meta.env.BASE_URL}data/asset/关闭按钮.png`} alt="" />
                    </button>
                    <div className={styles.gameDetailModal}>

                        {/* 大标题 */}
                        <h2 className={styles.detailMainTitle}>剧本详情</h2>

                        {/* 三栏主体内容 */}
                        <div className={styles.detailThreeColumns}>
                            {/* 左侧：图片 */}
                            <div className={styles.detailLeftColumn}>
                                {selectedGameMeta.img && (
                                    <img
                                        className={styles.detailLeftImage}
                                        src={selectedGameMeta.img}
                                        alt="游戏封面"
                                    />
                                )}
                            </div>

                            {/* 中间：标题、属性、描述、作者 */}
                            <div className={styles.detailMiddleColumn}>
                                {/* 标题（大写） */}
                                <h3 className={styles.detailGameTitle}>
                                    {(selectedGameMeta.title || '未命名游戏').toUpperCase()}
                                </h3>

                                {/* 游戏属性type */}
                                <div className={styles.detailGameType}>
                                    {Array.isArray(selectedGameMeta.tags) && selectedGameMeta.tags.length > 0 ? (
                                        selectedGameMeta.tags.join(' / ')
                                    ) : (
                                        selectedGameMeta.type || 'RPG'
                                    )}
                                </div>

                                {/* 描述模块（占据2/3高度） */}
                                <div className={styles.detailDescription}>
                                    {selectedGameMeta.description ? (
                                        <p>{selectedGameMeta.description}</p>
                                    ) : (
                                        <p>暂无描述</p>
                                    )}
                                </div>

                                {/* 作者名称 */}
                                <div className={styles.detailAuthor}>
                                    作者：{selectedGameMeta.authorName || '未知作者'}
                                </div>
                            </div>

                            {/* 右侧：特惠价格和开始游戏 */}
                            <div className={styles.detailRightColumn}>
                                {/* 特惠价格模块 */}
                                <div className={styles.priceSection}>
                                    <div className={styles.priceTitle}>特惠价格</div>
                                    <div className={styles.priceValue}>
                                        ￥{selectedGameMeta.price ? selectedGameMeta.price.toFixed(1) : '1.0'}
                                    </div>
                                    <div className={styles.priceCurrency}>CNY</div>
                                    <button className={styles.unlockBtn}>
                                        <img src={`${import.meta.env.BASE_URL}data/asset/剧本详情页/解锁剧本按钮.png`} alt="解锁剧本" />
                                    </button>
                                </div>

                                {/* 开始游戏模块 */}
                                <div className={styles.startGameSection}>
                                    {/* 游戏评分 */}
                                    <div className={styles.gameRating}>
                                        <div className={styles.ratingLabel}>
                                            {selectedGameMeta.rating ? parseFloat(selectedGameMeta.rating).toFixed(1) : '9.0'}
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
                                            {selectedGameMeta.ratingCount ? `${selectedGameMeta.ratingCount}人评价` : '2934人评价'}
                                        </div>
                                    </div>

                                    {/* 开始游戏按钮 */}
                                    <button
                                        className={styles.startGameBtn}
                                        onClick={handleCreateGameFromDetail}
                                    >
                                        <img src={`${import.meta.env.BASE_URL}data/asset/剧本详情页/开始游戏按钮.png`} alt="开始游戏" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Library;
