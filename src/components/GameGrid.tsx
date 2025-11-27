import React from 'react';
import styles from './GameGrid.module.css';
import type { UserGameData } from '../api/home/getGameData.type';
import { AiOutlineLike } from 'react-icons/ai';
import { IoGameControllerOutline } from 'react-icons/io5';

interface GameGridProps {
    games: UserGameData[];
    onGameClick?: (game: UserGameData) => void;
    renderActions?: (game: UserGameData) => React.ReactNode;
}

const GameGrid: React.FC<GameGridProps> = ({ games, onGameClick, renderActions }) => {
    if (games.length === 0) {
        return (
            <div className={styles.emptyState}>
                <p></p>
            </div>
        );
    }

    return (
        <div className={styles.grid4}>
            {games.map((meta, idx) => (
                <div
                    className={styles.goodsCard}
                    key={meta.id}
                    onClick={() => onGameClick?.(meta)}
                >
                    <div className={styles.goodsImg}>
                        <img
                            src={`https://kurangames.com/images/${meta.cover_url}` || `${import.meta.env.BASE_URL}data/events/welcome.png`}
                            alt={meta.title || `剧情${idx + 1}`}
                        />
                        <div className={styles.goodsInfo}>
                            <div className={styles.goodsInfoItem}>
                                <IoGameControllerOutline />
                                {meta.total_pv_count}
                            </div>
                            <div className={styles.goodsInfoItem}>
                                <AiOutlineLike />
                                {meta.like_count || 0}
                            </div>
                        </div>
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

                        {renderActions ? (
                            <div 
                                className={styles.gameEditBtn} 
                            >
                                {renderActions(meta)}
                            </div>
                        ) : (
                            <>
                                {
                                    meta.paid ? (
                                        <div className={styles.gameEditBtn}>
                                            <button className={styles.startGameBtn}>开始游戏</button>
                                        </div>
                                    ) :
                                        <div className={styles.goodsPrice}>
                                            {
                                                // meta.paid ? (
                                                //     <button className={styles.startGameBtn}>开始游戏</button>
                                                // ) : 
                                                 meta.special_price_amount!=null ? (
                                                    <>
                                                        <div className={styles.goodsPriceText}>
                                                            {meta.price_amount == 0 ? '免费' : `￥${meta.price_amount}`}
                                                        </div>
                                                        <div className={styles.specialPriceText}>
                                                            {meta.special_price_amount == 0 ? '免费' : `￥${meta.special_price_amount}`}
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className={styles.normalPriceText}>
                                                        {meta.price_amount == 0 ? '免费' : `￥${meta.price_amount}`}
                                                    </div>
                                                )
                                            }
                                        </div>
                                }
                            </>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default GameGrid;

