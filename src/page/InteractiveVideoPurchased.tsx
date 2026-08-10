import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { MdArrowBack, MdPlayArrow, MdRefresh, MdShoppingBag } from 'react-icons/md';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Layout/Navbar';
import MobileBottomNav from '../components/Layout/MobileBottomNav';
import FooterArea from '../components/Layout/FooterArea';
import {
    getPurchasedInteractiveVideoGames,
    toBackendAssetUrl,
    type InteractiveVideoPurchasedGame,
} from '../api/interactiveVideo';
import styles from './InteractiveVideoPurchased.module.css';

const formatPurchasedDate = (value?: string) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
};

const InteractiveVideoPurchased: React.FC = () => {
    const navigate = useNavigate();
    const [games, setGames] = useState<InteractiveVideoPurchasedGame[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');

    const loadPurchasedGames = useCallback(async () => {
        setIsLoading(true);
        setErrorMessage('');
        try {
            const response = await getPurchasedInteractiveVideoGames();
            if (!response.data?.success) {
                throw new Error('购买记录加载失败');
            }
            setGames(response.data.data || []);
        } catch (error) {
            const maybeError = error as { response?: { data?: { message?: string } }; message?: string };
            setErrorMessage(maybeError.response?.data?.message || maybeError.message || '购买记录加载失败，请稍后重试。');
            setGames([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadPurchasedGames();
    }, [loadPurchasedGames]);

    const totals = useMemo(() => games.reduce(
        (result, game) => ({
            points: result.points + Number(game.pointsSpent || 0),
            diamonds: result.diamonds + Number(game.diamondsSpent || 0),
        }),
        { points: 0, diamonds: 0 },
    ), [games]);

    return (
        <div className={styles.pageRoot}>
            <Navbar />
            <main className={styles.shell}>
                <div className={styles.toolbar}>
                    <button type="button" onClick={() => navigate('/profile')}>
                        <MdArrowBack />
                        返回个人中心
                    </button>
                    <button type="button" onClick={() => void loadPurchasedGames()} disabled={isLoading}>
                        <MdRefresh />
                        刷新
                    </button>
                </div>

                <section className={styles.headerBand}>
                    <div>
                        <span>互动影游</span>
                        <h1>我购买的游戏</h1>
                        <p>已获得的免费、目录解锁和买断权益都会在这里保留。</p>
                    </div>
                    <div className={styles.summaryGrid}>
                        <div>
                            <span>游戏数</span>
                            <strong>{games.length}</strong>
                        </div>
                        <div>
                            <span>积分消费</span>
                            <strong>{totals.points}</strong>
                        </div>
                        <div>
                            <span>钻石消费</span>
                            <strong>{totals.diamonds}</strong>
                        </div>
                    </div>
                </section>

                {isLoading ? (
                    <section className={styles.statePanel}>正在加载购买记录...</section>
                ) : errorMessage ? (
                    <section className={styles.statePanel}>
                        <h2>加载失败</h2>
                        <p>{errorMessage}</p>
                        <button type="button" onClick={() => void loadPurchasedGames()}>
                            <MdRefresh />
                            重试
                        </button>
                    </section>
                ) : games.length === 0 ? (
                    <section className={styles.statePanel}>
                        <MdShoppingBag />
                        <h2>暂无购买记录</h2>
                        <p>购买或 0 积分获得互动影游后，会自动出现在这里。</p>
                    </section>
                ) : (
                    <section className={styles.gameGrid}>
                        {games.map((game) => {
                            const coverUrl = toBackendAssetUrl(game.coverUrl);
                            const directoryCount = game.directoryIds?.length || 0;
                            return (
                                <article className={styles.gameCard} key={game.fileId}>
                                    <div className={styles.coverWrap}>
                                        {coverUrl ? (
                                            <img src={coverUrl} alt={game.title} loading="lazy" />
                                        ) : (
                                            <div className={styles.coverFallback}>{game.title.slice(0, 1) || 'F'}</div>
                                        )}
                                        {game.isPublic === false ? <span className={styles.offlineBadge}>已下架</span> : null}
                                    </div>
                                    <div className={styles.cardBody}>
                                        <div className={styles.cardTitleRow}>
                                            <h2>{game.title || '未命名互动影游'}</h2>
                                            <span>{game.hasBuyout ? '已买断' : `${directoryCount} 个目录`}</span>
                                        </div>
                                        <p>{game.authorName || 'Funloom 创作者'}</p>
                                        <dl className={styles.metaGrid}>
                                            <div>
                                                <dt>积分</dt>
                                                <dd>{game.pointsSpent || 0}</dd>
                                            </div>
                                            <div>
                                                <dt>钻石</dt>
                                                <dd>{game.diamondsSpent || 0}</dd>
                                            </div>
                                            <div>
                                                <dt>最近购买</dt>
                                                <dd>{formatPurchasedDate(game.lastPurchasedAt)}</dd>
                                            </div>
                                        </dl>
                                        <button
                                            type="button"
                                            onClick={() => navigate(`/interactive-video/${encodeURIComponent(game.fileId)}`)}
                                            disabled={game.isPublic === false}
                                        >
                                            <MdPlayArrow />
                                            {game.isPublic === false ? '暂不可访问' : '开始游玩'}
                                        </button>
                                    </div>
                                </article>
                            );
                        })}
                    </section>
                )}
            </main>
            <FooterArea />
            <MobileBottomNav />
        </div>
    );
};

export default InteractiveVideoPurchased;
