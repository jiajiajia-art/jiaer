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
    /** 是否展示激励相关 UI（标签、金额替换等） */
    showIncentiveUI?: boolean;
}

const 
GameGrid: React.FC<GameGridProps> = ({
    games,
    onGameClick,
    primaryStat = 'pv',
    showIncentiveUI = false,
}) => {
    const navigate = useNavigate();

    const getTypeLabel = (meta: UserGameData): string => {
        const raw = String(meta.game_tags || (meta as any).engine || '').toUpperCase();
        switch (raw) {
            case 'TXT': return 'Galgame';
            case 'AVG': return 'World';
            case 'RPG': return 'Story';
            case 'CUSTOM': return '自定义';
            default: return raw || '';
        }
    };

    // 计算作品激励状态（优先使用后端字段，其次用开始/结束时间推断，最后用账号级标记兜底）
    const getIncentiveStatus = (meta: UserGameData): 'none' | 'running' | 'finished' => {
        const raw = (meta as any).incentiveStatus || (meta as any).incentive_status;
        if (raw) {
            const val = String(raw).toLowerCase();
            if (val === 'running') return 'running';
            if (val === 'finished') return 'finished';
            return 'none';
        }

        const startStr = (meta as any).incentiveStartTime as string | undefined;
        const endStr = (meta as any).incentiveEndTime as string | undefined;
        if (!startStr) return 'none';
        // 简单的前端时间判断（以本地时间为准）；如果有服务端时间请优先用服务端计算好的状态
        const now = Date.now();
        const start = Date.parse(startStr);
        const end = endStr ? Date.parse(endStr) : NaN;
        if (isNaN(start)) return 'none';
        if (now > start && (isNaN(end) || now < end)) return 'running';
        if (!isNaN(end) && now > end) return 'finished';
        return 'none';
    };

    // 获取展示的激励金额，优先后端给的金额，缺省时用 UV×5 做兜底
    const getIncentiveAmount = (meta: UserGameData): number => {
        const amount = (meta as any).incentiveAmount ?? (meta as any).incentive_amount;
        if (typeof amount === 'number') return amount;
        const uv = meta.total_uv_count ?? 0;
        return uv * 5;
    };

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
                const status = getIncentiveStatus(meta);
                // 仅在作品具备明确的激励状态/时间时展示激励；不要因为作者参与而对全部作品生效
                const effectiveStatus: 'none' | 'running' | 'finished' = status;
                const showIncentive = showIncentiveUI && effectiveStatus !== 'none';

                const primaryValue = showIncentive
                    ? getIncentiveAmount(meta)
                    : (primaryStat === 'uv' ? (meta.total_uv_count ?? 0) : (meta.total_pv_count ?? 0));

                const PrimaryIcon = showIncentive
                    ? RiMoneyCnyCircleLine
                    : IoGameControllerOutline;

                return (
                <div
                    className={styles.goodsCard}
                    key={meta.file_id || meta.id || String(idx)}
                    onClick={() => handleGameClick(meta)}
                >
                    <div className={styles.goodsImg}>
                        <img
                            src={getImageUrl(meta.display_cover_url || meta.cover_url) || `${import.meta.env.BASE_URL}data/events/welcome.png`}
                            alt={meta.title || `剧情${idx + 1}`}
                        />
                        {showIncentive && (
                            <div
                                className={`${styles.incentiveTag} ${effectiveStatus === 'finished' ? styles.incentiveFinished : ''}`}
                                title={effectiveStatus === 'finished' ? '激励已结算' : '激励计划'}
                            >
                                {effectiveStatus === 'finished' ? '激励已结算' : '激励计划'}
                            </div>
                        )}
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
                            {(meta.game_tags || (meta as any).engine) && (
                                <div className={styles.goodsInfoTag} title={getTypeLabel(meta)}>
                                    {getTypeLabel(meta)}
                                </div>
                            )}
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
