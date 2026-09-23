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
                        <div className={styles.titleWrap}>
                            <div className={styles.titleSkeleton} />
                            <div className={styles.subtitleSkeleton} />
                            <div className={styles.tagSkeleton} />
                        </div>
                        {!isWorksLayout ? <div className={styles.priceSkeleton} /> : null}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default GameGridSkeleton;
