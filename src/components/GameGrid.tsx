import React from 'react';
import styles from './GameGrid.module.css';
import type { UserGameData } from '../api/home/getGameData.type';

interface GameGridProps {
    games: UserGameData[];
    showSpecialPrice?: boolean;
    onGameClick: (game: UserGameData) => void;
}

const GameGrid: React.FC<GameGridProps> = ({ games, showSpecialPrice = false, onGameClick }) => {
    if (games.length === 0) {
        return (
            <div className={styles.emptyState}>
                <h2>⏳ 加载中...</h2>
                <p>正在加载剧情文件信息</p>
            </div>
        );
    }

    return (
        <div className={styles.grid4}>
            {games.map((meta, idx) => (
                <div
                    className={styles.goodsCard}
                    key={meta.id}
                    onClick={() => onGameClick(meta)}
                >
                    <div className={styles.goodsImg}>
                        <img
                            src={meta.cover_url || `${import.meta.env.BASE_URL}data/events/welcome.png`}
                            alt={meta.title || `剧情${idx + 1}`}
                        />
                    </div>
                    <div className={styles.goodsBody}>
                        <div className={styles.goodsTitleWrap}>
                            <div className={styles.goodsTitle}>
                                {meta.title || `剧情${idx + 1}`}
                            </div>
                            {meta.subtitle && (
                                <div className={styles.goodsSubtitle}>{meta.subtitle}</div>
                            )}
                        </div>

                        <div className={styles.goodsPrice}>
                            {showSpecialPrice && meta.special_price_amount ? (
                                <>
                                    <div className={styles.goodsPriceText}>￥{meta.price_amount || 100}</div>
                                    <div className={styles.specialPriceText}>￥{meta.special_price_amount}</div>
                                </>
                            ) : (
                                <div className={styles.normalPriceText}>￥{meta.price_amount || 100}</div>
                            )}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default GameGrid;

