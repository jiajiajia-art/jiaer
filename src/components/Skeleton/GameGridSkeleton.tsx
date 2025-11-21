import React from 'react';
import styles from './GameGridSkeleton.module.css';

interface GameGridSkeletonProps {
    /**
     * 骨架屏卡片数量，默认 8 个
     */
    count?: number;
}

const GameGridSkeleton: React.FC<GameGridSkeletonProps> = ({ count = 8 }) => {
    return (
        <div className={styles.skeletonGrid}>
            {Array.from({ length: count }).map((_, idx) => (
                <div key={idx} className={styles.skeletonCard}>
                    <div className={styles.coverSkeleton} />
                    <div className={styles.body}>
                        <div className={styles.titleWrap}>
                            <div className={styles.titleSkeleton} />
                            <div className={styles.subtitleSkeleton} />
                        </div>
                        <div className={styles.priceSkeleton} />
                    </div>
                </div>
            ))}
        </div>
    );
};

export default GameGridSkeleton;

