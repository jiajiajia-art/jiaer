import React from 'react';
import styles from './GameGridSkeleton.module.css';

type GameGridSkeletonLayoutVariant = 'default' | 'homeWide';

interface GameGridSkeletonProps {
    count?: number;
    layoutVariant?: GameGridSkeletonLayoutVariant;
}

const GameGridSkeleton: React.FC<GameGridSkeletonProps> = ({
    count = 8,
    layoutVariant = 'default',
}) => {
    const skeletonGridClassName = [
        styles.skeletonGrid,
        layoutVariant === 'homeWide' ? styles.skeletonGridHomeWide : '',
    ].filter(Boolean).join(' ');
    const skeletonCardClassName = [
        styles.skeletonCard,
        layoutVariant === 'homeWide' ? styles.skeletonCardHomeWide : '',
    ].filter(Boolean).join(' ');

    return (
        <div className={skeletonGridClassName}>
            {Array.from({ length: count }).map((_, idx) => (
                <div key={idx} className={skeletonCardClassName}>
                    <div className={styles.coverSkeleton} />
                    <div className={styles.body}>
                        <div className={styles.titleWrap}>
                            <div className={styles.titleSkeleton} />
                            <div className={styles.subtitleSkeleton} />
                            <div className={styles.tagSkeleton} />
                        </div>
                        <div className={styles.priceSkeleton} />
                    </div>
                </div>
            ))}
        </div>
    );
};

export default GameGridSkeleton;
