import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import activityBannerApi from '../api/banner/activityBannerApi';
import type { ActivityBannerItem } from '../api/banner/activityBanner.type';
import { useExternalLinkCopyModal } from '../hooks/useExternalLinkCopyModal';
import { getImageUrl } from '../utils/constants';
import { openConfiguredLink } from '../utils/promotionNavigation';
import styles from './ActivityBannerCarousel.module.css';

const AUTOPLAY_MS = 7000;
const SCHEDULE_REFRESH_OFFSET_MS = 250;
const MAX_TIMEOUT_MS = 2_147_000_000;
const SWIPE_THRESHOLD = 42;
const SWIPE_CLICK_SUPPRESS_MS = 350;

const buildImageUrl = (item: ActivityBannerItem, retryCount: number): string => {
    const baseUrl = getImageUrl(item.imageUrl);
    if (!baseUrl || retryCount === 0) return baseUrl;
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}activityBannerReload=${retryCount}`;
};

const ActivityBannerCarousel: React.FC = () => {
    const navigate = useNavigate();
    const { requestCopy, modal } = useExternalLinkCopyModal();
    const [banners, setBanners] = useState<ActivityBannerItem[]>([]);
    const [nextChangeAt, setNextChangeAt] = useState<string | null>(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const [retryCounts, setRetryCounts] = useState<Record<number, number>>({});
    const [failedIds, setFailedIds] = useState<Record<number, true>>({});
    const [isPageVisible, setIsPageVisible] = useState(() => !document.hidden);
    const requestIdRef = useRef(0);
    const touchStartXRef = useRef<number | null>(null);
    const touchStartYRef = useRef<number | null>(null);
    const touchDeltaXRef = useRef(0);
    const touchDeltaYRef = useRef(0);
    const suppressClickRef = useRef(false);

    const loadData = useCallback(async () => {
        const requestId = ++requestIdRef.current;
        try {
            const response = await activityBannerApi.getLatest();
            if (requestId !== requestIdRef.current) return;
            setBanners(response.data.data?.banners || []);
            setNextChangeAt(response.data.data?.nextChangeAt || null);
            setActiveIndex(0);
            setRetryCounts({});
            setFailedIds({});
        } catch (error) {
            if (requestId !== requestIdRef.current) return;
            console.error('加载活动轮播图失败:', error);
            setBanners([]);
            setNextChangeAt(null);
        }
    }, []);

    useEffect(() => {
        void loadData();
        return () => {
            requestIdRef.current += 1;
        };
    }, [loadData]);

    useEffect(() => {
        const handleVisibilityChange = () => {
            const visible = !document.hidden;
            setIsPageVisible(visible);
            if (visible) void loadData();
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [loadData]);

    useEffect(() => {
        if (!nextChangeAt) return undefined;
        const boundaryMs = Date.parse(nextChangeAt);
        if (!Number.isFinite(boundaryMs)) return undefined;
        let timer: number | undefined;
        const scheduleRefresh = () => {
            const remaining = boundaryMs - Date.now() + SCHEDULE_REFRESH_OFFSET_MS;
            if (remaining > MAX_TIMEOUT_MS) {
                timer = window.setTimeout(scheduleRefresh, MAX_TIMEOUT_MS);
                return;
            }
            timer = window.setTimeout(
                () => void loadData(),
                Math.max(remaining, SCHEDULE_REFRESH_OFFSET_MS),
            );
        };
        scheduleRefresh();
        return () => {
            if (timer !== undefined) window.clearTimeout(timer);
        };
    }, [loadData, nextChangeAt]);

    const visibleBanners = useMemo(
        () => banners.filter((item) => !failedIds[item.id]),
        [banners, failedIds],
    );

    useEffect(() => {
        setActiveIndex((current) => {
            if (visibleBanners.length === 0) return 0;
            return Math.min(current, visibleBanners.length - 1);
        });
    }, [visibleBanners.length]);

    useEffect(() => {
        if (!isPageVisible || visibleBanners.length < 2) return undefined;
        const timer = window.setInterval(() => {
            setActiveIndex((current) => (current + 1) % visibleBanners.length);
        }, AUTOPLAY_MS);
        return () => window.clearInterval(timer);
    }, [isPageVisible, visibleBanners.length]);

    const goToPrevious = () => {
        if (visibleBanners.length < 2) return;
        setActiveIndex((current) => (current - 1 + visibleBanners.length) % visibleBanners.length);
    };

    const goToNext = () => {
        if (visibleBanners.length < 2) return;
        setActiveIndex((current) => (current + 1) % visibleBanners.length);
    };

    const handleImageError = (itemId: number) => {
        setRetryCounts((current) => {
            const count = current[itemId] || 0;
            if (count < 1) return { ...current, [itemId]: count + 1 };
            setFailedIds((failed) => ({ ...failed, [itemId]: true }));
            return current;
        });
    };

    const resetTouch = () => {
        touchStartXRef.current = null;
        touchStartYRef.current = null;
        touchDeltaXRef.current = 0;
        touchDeltaYRef.current = 0;
    };

    const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
        if (event.touches.length !== 1) return;
        touchStartXRef.current = event.touches[0].clientX;
        touchStartYRef.current = event.touches[0].clientY;
        suppressClickRef.current = false;
    };

    const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
        if (event.touches.length !== 1 || touchStartXRef.current === null || touchStartYRef.current === null) return;
        touchDeltaXRef.current = event.touches[0].clientX - touchStartXRef.current;
        touchDeltaYRef.current = event.touches[0].clientY - touchStartYRef.current;
    };

    const handleTouchEnd = () => {
        const horizontalDistance = Math.abs(touchDeltaXRef.current);
        const verticalDistance = Math.abs(touchDeltaYRef.current);
        if (horizontalDistance >= SWIPE_THRESHOLD && horizontalDistance > verticalDistance) {
            suppressClickRef.current = true;
            if (touchDeltaXRef.current > 0) goToPrevious();
            else goToNext();
            window.setTimeout(() => { suppressClickRef.current = false; }, SWIPE_CLICK_SUPPRESS_MS);
        }
        resetTouch();
    };

    const handleBannerClick = (item: ActivityBannerItem) => {
        if (suppressClickRef.current || !item.linkUrl.trim()) return;
        openConfiguredLink(item.linkUrl, { navigate, onExternalLinkCopy: requestCopy });
    };

    if (visibleBanners.length === 0) return null;

    return (
        <section className={styles.root} aria-label="活动轮播图">
            <div
                className={styles.viewport}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={resetTouch}
            >
                <div
                    className={styles.track}
                    style={{ transform: `translate3d(-${activeIndex * 100}%, 0, 0)` }}
                >
                    {visibleBanners.map((item) => {
                        const clickable = Boolean(item.linkUrl.trim());
                        const retryCount = retryCounts[item.id] || 0;
                        return (
                            <article
                                key={item.id}
                                className={`${styles.slide} ${clickable ? styles.clickable : ''}`}
                                onClick={() => handleBannerClick(item)}
                            >
                                <img
                                    key={`${item.id}-${retryCount}`}
                                    className={styles.image}
                                    src={buildImageUrl(item, retryCount)}
                                    alt={item.title || '活动轮播图'}
                                    loading="eager"
                                    decoding="async"
                                    onError={() => handleImageError(item.id)}
                                />
                                {(item.title || item.description) ? (
                                    <div className={styles.copy}>
                                        {item.title ? <h2 className={styles.title}>{item.title}</h2> : null}
                                        {item.description ? <p className={styles.description}>{item.description}</p> : null}
                                    </div>
                                ) : null}
                            </article>
                        );
                    })}
                </div>
                {visibleBanners.length > 1 ? (
                    <>
                        <button type="button" className={`${styles.navButton} ${styles.previous}`} onClick={goToPrevious} aria-label="上一张活动轮播图">‹</button>
                        <button type="button" className={`${styles.navButton} ${styles.next}`} onClick={goToNext} aria-label="下一张活动轮播图">›</button>
                        <div className={styles.indicators} aria-label="活动轮播图页码">
                            {visibleBanners.map((item, index) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    className={`${styles.indicator} ${index === activeIndex ? styles.indicatorActive : ''}`}
                                    onClick={() => setActiveIndex(index)}
                                    aria-label={`切换到第 ${index + 1} 张活动轮播图`}
                                    aria-current={index === activeIndex ? 'true' : undefined}
                                />
                            ))}
                        </div>
                    </>
                ) : null}
            </div>
            {modal}
        </section>
    );
};

export default ActivityBannerCarousel;
