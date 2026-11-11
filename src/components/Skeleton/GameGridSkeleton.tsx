import React from 'react';
import styles from './GameGridSkeleton.module.css';

type GameGridSkeletonLayoutVariant = 'default' | 'homeWide' | 'works';

interface GameGridSkeletonProps {
    count?: number;
    layoutVariant?: GameGridSkeletonLayoutVariant;
}

const GameGridSkeleton: React.FC<GameGridSkeletonProps> = ({
    count = 8,
    layoutVariant = 'default',
}) => {
    const isWorksLayout = layoutVariant === 'works';
    const skeletonGridClassName = [
        styles.skeletonGrid,
        layoutVariant === 'homeWide' ? styles.skeletonGridHomeWide : '',
        isWorksLayout ? styles.skeletonGridWorks : '',
    ].filter(Boolean).join(' ');
    const skeletonCardClassName = [
        styles.skeletonCard,
        layoutVariant === 'homeWide' ? styles.skeletonCardHomeWide : '',
        isWorksLayout ? styles.skeletonCardWorks : '',
    ].filter(Boolean).join(' ');

    return (
        <div className={skeletonGridClassName}>
            {Array.from({ length: count }).map((_, idx) => (
                <div key={idx} className={skeletonCardClassName}>
                    <div className={styles.coverSkeleton} />
                    <div className={styles.body}>
                        {/* 功能注释：骨架与真实卡片同结构：两行标题 / 作者行 / 标签行 */}
                        <div className={styles.cardTitleLine} />
                        <div className={`${styles.cardTitleLine} ${styles.cardTitleLineShort}`} />
                        <div className={styles.cardAuthorRow}>
                            <span className={styles.cardAvatar} />
                            <span className={styles.cardAuthorName} />
                        </div>
                        <div className={styles.cardTagRow}>
                            <span className={styles.cardTag} />
                            <span className={styles.cardTag} />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default GameGridSkeleton;
