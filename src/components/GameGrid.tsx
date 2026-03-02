import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './GameGrid.module.css';
import type { UserGameData } from '../api/home/getGameData.type';
import { AiOutlineLike } from 'react-icons/ai';
import { IoGameControllerOutline } from 'react-icons/io5';
import { RiMoneyCnyCircleLine } from "react-icons/ri";
import { getImageUrl } from '../utils/constants';

interface GameGridProps {
    games: UserGameData[];
    onGameClick?: (game: UserGameData) => void;
    /** 统计显示模式：'uv' 用钱币 + total_uv_count，'pv' 用游戏手柄 + total_pv_count */
    primaryStat?: 'uv' | 'pv';
    isIncentive?: boolean;
}

const 
GameGrid: React.FC<GameGridProps> = ({
    games,
    onGameClick,
    primaryStat = 'pv',
    isIncentive = false,
}) => {
    const navigate = useNavigate();

    const handleGameClick = (game: UserGameData) => {
        if (onGameClick) {
            onGameClick(game);
        } else {
            // 默认行为：导航到详情页
            const gameId = game.file_id || game.id;
            if (gameId) {
                navigate(`/game/${gameId}`, {
                    state: { source: 'main_page' },
                });
            }
        }
    };
    if (games.length === 0) {
        return (
            <div className={styles.emptyState}>
                <p></p>
            </div>
        );
    }


    return (
        <div className={styles.grid4}>
            {games.map((meta, idx) => {
                const showUvWithMoney = primaryStat === 'uv' && isIncentive;

                const primaryValue = showUvWithMoney
                    ? (meta.total_uv_count ?? 0)
                    : (meta.total_pv_count ?? 0);

                const PrimaryIcon = showUvWithMoney
                    ? RiMoneyCnyCircleLine
                    : IoGameControllerOutline;

                return (
                <div
                    className={styles.goodsCard}
                    key={meta.id}
                    onClick={() => handleGameClick(meta)}
                >
                    <div className={styles.goodsImg}>
                        <img
                            src={getImageUrl(meta.display_cover_url || meta.cover_url) || `${import.meta.env.BASE_URL}data/events/welcome.png`}
                            alt={meta.title || `剧情${idx + 1}`}
                        />
                        <div className={styles.goodsInfo}>
                            <div className={styles.goodsInfoLeft}>
                                <div className={styles.goodsInfoItem}>
                                    <PrimaryIcon />
                                    {primaryValue}
                                </div>
                                <div className={styles.goodsInfoItem}>
                                    <AiOutlineLike />
                                    {meta.like_count || 0}
                                </div>
                            </div>
                            {/* {(meta.game_tags || (meta as any).engine) && (
                                <div className={styles.goodsInfoTag} title={String(meta.game_tags || (meta as any).engine)}>
                                    {String(meta.game_tags || (meta as any).engine)}
                                </div>
                            )} */}
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

                        {/* {renderActions ? (
                            <div className={styles.gameEditBtn}>
                                {renderActions(meta)}
                            </div>
                        ) : (
                            <div className={styles.goodsPrice}>
                                <button className={styles.startGameBtn}>开始游戏</button>
                            </div>
                        )} */}
                    </div>
                </div>
            )})}
        </div>
    );
};

export default GameGrid;

