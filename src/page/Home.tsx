import React, { useState, useEffect } from 'react';
import styles from './Home.module.css';
import { useGameStore } from '../store/gameStore';
import { useNavigate } from 'react-router-dom';
import { HOST_ADDRESS } from '../config';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';

const Home: React.FC = () => {
    const [showGameModal, setShowGameModal] = useState(false);
    const [fileMetas, setFileMetas] = useState<any[]>([]);
    const [selectedGameMeta, setSelectedGameMeta] = useState<any | null>(null);

    const { setPdfFileId, setSessionId } = useGameStore();
    const navigator = useNavigate();

    // 硬编码的文件ID列表（从Home.tsx复制）
    const fileId = [
        {
            id: '0f3f4e7539179b8896606b3212f660d9',
            img: `${import.meta.env.BASE_URL}data/gameCover/img1.png`
        },
        {
            id: '6fae713d4a501003654a1973fd854895',
            img: `${import.meta.env.BASE_URL}data/gameCover/img2.png`,
            title: '明末风华录'
        },
        {
            id:'53275c6d2dc88e87f74cda72888967ed',
            img: `${HOST_ADDRESS}/api/backend/saves/53275c6d2dc88e87f74cda72888967ed/scenes/convenience_store_53275c6d2dc88e87f74cda72888967ed.png`
        },
        {
            id:'14793e6656c9ca9ba35183416c93e6e6',
            img:`${import.meta.env.BASE_URL}data/gameCover/img4.png`
        }
    ];


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
        if (!selectedGameMeta?.id) {
            alert('游戏信息错误，请重试');
            return;
        }
        // 同时更新 store 和直接传递给 createSession，确保立即生效
        setPdfFileId(selectedGameMeta.id);
        const sessionId = await createSession(selectedGameMeta.id);
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
            const response = await fetch(`${HOST_ADDRESS}/api/backend/game/session/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fileId: targetFileId,
                    playerName: '玩家'
                })
            });

            if (response.ok) {
                const data = await response.json();
                console.log('✅ Session 创建成功:', data);
                return data.sessionId || data.id;
            } else {
                console.error('❌ Session 创建失败:', response.statusText);
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

    // 首页加载每个 fileId 后端元信息
    useEffect(() => {
        Promise.all(
            fileId.map(async f => {
                try {
                    const res = await fetch(`${HOST_ADDRESS}/api/backend/saves/${f.id}/files`);
                    if (res.ok) {                        
                        const data = await res.json();
                        return { id: f.id,img: f.img, title: f.title, ...data.files };
                    }                    
                } catch { }
                return { id: f.id };
            })
        ).then(data => {
            setFileMetas(data);
        });
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

                {/* 右侧商城内容 */}
                <div className={styles.main}>
                    <div className={styles.todayWrap}>
                        <div className={styles.todayHeader}>
                            <img src={`${import.meta.env.BASE_URL}data/asset/首页/字样.png`} alt="今日推荐" />
                        </div>
                        <div className={styles.todayScroller}>
                            <img src={`${import.meta.env.BASE_URL}data/gameCover/image.png`} alt="今日推荐" />
                        </div>
                    </div>

                    <div className={styles.shopSection}>
                        <div className={styles.sectionHeader}>
                            <div className={styles.sectionTitle}>限时优惠!</div>
                            <div className={styles.more} onClick={() => {
                                navigator('/home/library');
                            }}></div>
                        </div>
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
                                                alt={meta.lore?.worldBackground?.title || `剧情${idx + 1}`}
                                            />
                                        </div>
                                        <div className={styles.goodsBody}>
                                            <div className={styles.goodsTitle}>
                                                {meta.title || meta.lore?.worldBackground?.title || `剧情${idx + 1}`}
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
                                    {selectedGameMeta.lore?.worldBackground?.title?.toUpperCase() || '未命名游戏'}
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
                                    {selectedGameMeta.lore?.worldBackground?.content && (
                                        Array.isArray(selectedGameMeta.lore.worldBackground.content) ? (
                                            selectedGameMeta.lore.worldBackground.content.map((para: string, idx: number) => (
                                                <p key={idx}>{para}</p>
                                            ))
                                        ) : (
                                            <p>{selectedGameMeta.lore.worldBackground.content}</p>
                                        )
                                    )}
                                </div>
                                
                                {/* 作者名称 */}
                                <div className={styles.detailAuthor}>
                                    作者：{selectedGameMeta.author || '未知作者'}
                                </div>
                            </div>
                            
                            {/* 右侧：特惠价格和开始游戏 */}
                            <div className={styles.detailRightColumn}>
                                {/* 特惠价格模块 */}
                                <div className={styles.priceSection}>
                                    <div className={styles.priceTitle}>特惠价格</div>
                                    <div className={styles.priceValue}>￥1.0</div>
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
                                            9.0
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
                                        <div className={styles.ratingScore}>2934人评价</div>
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

export default Home;


