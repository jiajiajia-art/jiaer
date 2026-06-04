import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import styles from "./FloatingJoinGroup.module.css";
import { useNavigate } from "react-router-dom";
import { LANGUAGE } from "../config";

interface FloatingJoinGroupProps {
    qrSrc?: string;
    qqQrSrc?: string;
}

interface MobilePosition {
    x: number;
    y: number;
}

const MOBILE_BREAKPOINT = 768;
const MOBILE_SIDE_GAP = 8;
const MOBILE_TOP_GAP = 88;
const MOBILE_BOTTOM_GAP = 104;
const MOBILE_BUTTON_WIDTH = 72;
const MOBILE_BUTTON_HEIGHT = 88;
const MOBILE_DRAG_THRESHOLD = 6;
const MOBILE_POSITION_STORAGE_KEY = "floatingJoinGroupMobilePosition";

const getDefaultMobilePosition = (): MobilePosition => {
    if (typeof window === "undefined") {
        return {
            x: MOBILE_SIDE_GAP,
            y: MOBILE_TOP_GAP,
        };
    }

    return {
        x: Math.max(MOBILE_SIDE_GAP, window.innerWidth - MOBILE_BUTTON_WIDTH - MOBILE_SIDE_GAP),
        y: Math.max(MOBILE_TOP_GAP, window.innerHeight - MOBILE_BUTTON_HEIGHT - MOBILE_BOTTOM_GAP),
    };
};

const FloatingJoinGroup: React.FC<FloatingJoinGroupProps> = ({ qrSrc, qqQrSrc }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [isMobileViewport, setIsMobileViewport] = useState(
        () => typeof window !== "undefined" && window.innerWidth <= MOBILE_BREAKPOINT
    );
    const [mobilePosition, setMobilePosition] = useState<MobilePosition | null>(
        () => (typeof window !== "undefined" && window.innerWidth <= MOBILE_BREAKPOINT ? getDefaultMobilePosition() : null)
    );
    const [isDragging, setIsDragging] = useState(false);
    const buttonRef = useRef<HTMLButtonElement | null>(null);
    const lastDragAtRef = useRef(0);
    const dragStateRef = useRef({
        pointerId: -1,
        startX: 0,
        startY: 0,
        originX: 0,
        originY: 0,
        moved: false,
    });
    const wechatQrSrc = qrSrc || `${import.meta.env.BASE_URL}data/assets/group/qr_wx.jpeg`;
    const qqGroupQrSrc = qqQrSrc || `${import.meta.env.BASE_URL}data/assets/group/qr_qq.jpeg`;
    const fallbackSrc = `${import.meta.env.BASE_URL}data/assets/defaultAvatar.png`;

    const getButtonSize = useCallback(() => {
        const width = buttonRef.current?.offsetWidth || MOBILE_BUTTON_WIDTH;
        const height = buttonRef.current?.offsetHeight || MOBILE_BUTTON_HEIGHT;
        return { width, height };
    }, []);

    const clampMobilePosition = useCallback((position: MobilePosition): MobilePosition => {
        if (typeof window === "undefined") {
            return position;
        }

        const { width, height } = getButtonSize();
        const maxX = Math.max(MOBILE_SIDE_GAP, window.innerWidth - width - MOBILE_SIDE_GAP);
        const maxY = Math.max(MOBILE_TOP_GAP, window.innerHeight - height - MOBILE_BOTTOM_GAP);

        return {
            x: Math.min(Math.max(position.x, MOBILE_SIDE_GAP), maxX),
            y: Math.min(Math.max(position.y, MOBILE_TOP_GAP), maxY),
        };
    }, [getButtonSize]);

    const readSavedMobilePosition = useCallback((): MobilePosition | null => {
        if (typeof window === "undefined") {
            return null;
        }

        const raw = window.localStorage.getItem(MOBILE_POSITION_STORAGE_KEY);
        if (!raw) {
            return null;
        }

        try {
            const parsed = JSON.parse(raw) as Partial<MobilePosition>;
            if (typeof parsed.x !== "number" || typeof parsed.y !== "number") {
                return null;
            }

            return parsed as MobilePosition;
        } catch {
            return null;
        }
    }, []);

    const persistMobilePosition = useCallback((position: MobilePosition) => {
        if (typeof window === "undefined") {
            return;
        }

        window.localStorage.setItem(MOBILE_POSITION_STORAGE_KEY, JSON.stringify(position));
    }, []);

    useEffect(() => {
        if (!isOpen) {
            return undefined;
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setIsOpen(false);
            }
        };

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen]);

    useEffect(() => {
        if (typeof window === "undefined") {
            return undefined;
        }

        const handleViewportChange = () => {
            const nextIsMobile = window.innerWidth <= MOBILE_BREAKPOINT;
            setIsMobileViewport(nextIsMobile);

            if (!nextIsMobile) {
                setMobilePosition(null);
                setIsDragging(false);
                return;
            }

            setMobilePosition((prev) => {
                const nextPosition = prev || readSavedMobilePosition() || getDefaultMobilePosition();
                return clampMobilePosition(nextPosition);
            });
        };

        handleViewportChange();
        window.addEventListener("resize", handleViewportChange);

        return () => {
            window.removeEventListener("resize", handleViewportChange);
        };
    }, [clampMobilePosition, readSavedMobilePosition]);

    const handleMobilePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
        if (!isMobileViewport) {
            return;
        }

        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        const initialPosition = mobilePosition || clampMobilePosition(readSavedMobilePosition() || getDefaultMobilePosition());

        dragStateRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            originX: initialPosition.x,
            originY: initialPosition.y,
            moved: false,
        };
    };

    const handleMobilePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
        if (!isMobileViewport || dragStateRef.current.pointerId !== event.pointerId) {
            return;
        }

        event.preventDefault();

        const deltaX = event.clientX - dragStateRef.current.startX;
        const deltaY = event.clientY - dragStateRef.current.startY;

        if (
            !dragStateRef.current.moved &&
            (Math.abs(deltaX) >= MOBILE_DRAG_THRESHOLD || Math.abs(deltaY) >= MOBILE_DRAG_THRESHOLD)
        ) {
            dragStateRef.current.moved = true;
            setIsDragging(true);
        }

        if (!dragStateRef.current.moved) {
            return;
        }

        setMobilePosition(
            clampMobilePosition({
                x: dragStateRef.current.originX + deltaX,
                y: dragStateRef.current.originY + deltaY,
            })
        );
    };

    const handleMobilePointerEnd = (event: React.PointerEvent<HTMLButtonElement>) => {
        if (!isMobileViewport || dragStateRef.current.pointerId !== event.pointerId) {
            return;
        }

        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }

        if (dragStateRef.current.moved) {
            const deltaX = event.clientX - dragStateRef.current.startX;
            const deltaY = event.clientY - dragStateRef.current.startY;
            const finalPosition = clampMobilePosition({
                x: dragStateRef.current.originX + deltaX,
                y: dragStateRef.current.originY + deltaY,
            });

            setMobilePosition(finalPosition);
            persistMobilePosition(finalPosition);
            lastDragAtRef.current = Date.now();
        }

        setIsDragging(false);
        dragStateRef.current.pointerId = -1;
        dragStateRef.current.moved = false;
    };

    const handleButtonClick = () => {
        if (isMobileViewport && Date.now() - lastDragAtRef.current < 250) {
            return;
        }

        setIsOpen(true);
    };

    const handleNavigateToPromotions = () => {
        setIsOpen(false);
        navigate("/promotions");
    };

    const buttonStyle = isMobileViewport && mobilePosition
        ? {
            left: `${mobilePosition.x}px`,
            top: `${mobilePosition.y}px`,
            right: "auto",
            transform: "none",
        }
        : undefined;

    return (
        <>
            <button
                ref={buttonRef}
                type="button"
                className={`${styles.floatingButton} ${LANGUAGE === 'en' ? styles.floatingButtonHorizontal : ''} ${isDragging ? styles.floatingButtonDragging : ""}`}
                style={buttonStyle}
                onClick={handleButtonClick}
                onPointerDown={handleMobilePointerDown}
                onPointerMove={handleMobilePointerMove}
                onPointerUp={handleMobilePointerEnd}
                onPointerCancel={handleMobilePointerEnd}
                aria-label={t('home.joinGroup.openQrGroup')}
                aria-haspopup="dialog"
                aria-expanded={isOpen}
            >
                <span className={`${styles.iconStack} ${LANGUAGE === 'en' ? styles.iconStackHorizontal : ''}`} aria-hidden="true">
                    <span className={`${styles.iconWrap} ${LANGUAGE === 'en' ? styles.iconWrapHorizontal : ''}`}>
                        <svg viewBox="0 0 64 64" className={`${styles.wechatIcon} ${LANGUAGE === 'en' ? styles.wechatIconHorizontal : ''}`} xmlns="http://www.w3.org/2000/svg">
                            <path d="M24.31 15.55c-10.79 0-19.54 7.03-19.54 15.7 0 4.99 2.9 9.43 7.42 12.31l-2.03 6.44 7.42-3.74c2.11.59 4.38.91 6.73.91 10.79 0 19.54-7.03 19.54-15.7s-8.75-15.92-19.54-15.92Zm-7.7 12.4c-1.24 0-2.24-.99-2.24-2.24s1-2.24 2.24-2.24 2.24.99 2.24 2.24-.99 2.24-2.24 2.24Zm15.3 0c-1.24 0-2.24-.99-2.24-2.24s1-2.24 2.24-2.24 2.24.99 2.24 2.24-.99 2.24-2.24 2.24Z" />
                            <path d="M46.62 31.93c-7.01 0-12.7 4.51-12.7 10.08 0 5.58 5.69 10.08 12.7 10.08 1.52 0 3.04-.23 4.42-.7l5 2.52-1.37-4.36c3.04-1.95 4.88-4.83 4.88-7.54 0-5.58-5.68-10.08-12.92-10.08Zm-4.18 8.13c-.77 0-1.39-.61-1.39-1.38 0-.77.62-1.39 1.39-1.39.77 0 1.39.62 1.39 1.39 0 .77-.61 1.38-1.39 1.38Zm8.36 0c-.77 0-1.39-.61-1.39-1.38 0-.77.62-1.39 1.39-1.39.77 0 1.39.62 1.39 1.39 0 .77-.61 1.38-1.39 1.38Z" />
                        </svg>
                    </span>
                    <span className={`${styles.iconWrap} ${styles.qqIconWrap} ${LANGUAGE === 'en' ? styles.iconWrapHorizontal : ''}`}>
                        <svg viewBox="0 0 1024 1024" className={`${styles.qqPenguinIcon} ${LANGUAGE === 'en' ? styles.qqPenguinIconHorizontal : ''}`} xmlns="http://www.w3.org/2000/svg">
                            <path d="M666.122449 909.061224c-10.44898 0-21.420408-1.044898-31.869388-2.612244-39.183673-4.702041-74.710204-23.510204-100.832653-53.289796-13.583673 5.22449-28.212245 5.22449-41.795918 0-21.420408 28.212245-61.64898 48.065306-108.669388 53.289796-66.35102 7.314286-138.44898-11.493878-144.718367-55.379592-5.22449-34.481633 37.093878-61.126531 81.502041-75.755102-25.6-28.212245-43.363265-63.738776-51.2-101.355102l-0.522449 0.522449c-25.077551 31.346939-41.795918 50.155102-61.126531 50.155102-2.089796 0-4.179592-0.522449-6.269388-1.044898-7.314286-2.612245-13.061224-8.881633-17.240816-18.808164-16.195918-34.481633-9.404082-100.310204 15.15102-150.465306 0 0 0-0.522449 0.522449-0.522449 12.538776-22.465306 27.689796-43.363265 45.453061-62.171428-6.269388-11.493878-10.44898-24.032653-12.016326-37.093878v-3.134694c0.522449-19.330612 10.44898-37.093878 26.644898-47.542857-10.971429-73.142857 9.926531-147.330612 58.514286-203.232653 49.110204-56.946939 120.163265-88.816327 194.873469-86.204081h4.702041c65.306122 0 129.567347 26.122449 177.110204 72.097959 49.110204 47.542857 76.8 112.326531 77.844898 180.767347v7.314285c0.522449 9.926531 0 19.330612-1.044898 29.257143 14.106122 8.881633 21.420408 20.37551 21.420408 48.065306 0 13.583673-1.044898 27.689796-9.926531 36.04898 13.061224 17.763265 28.734694 42.840816 41.27347 62.693877l2.612245 4.179592c20.37551 32.391837 23.510204 74.187755 22.987755 96.130613 0 17.240816-2.089796 58.514286-18.285714 70.530612-3.657143 2.612245-7.314286 3.657143-12.016327 3.657143h-4.179592c-26.122449 0-41.273469-23.510204-57.991837-48.587755l-1.567347-2.089796c-8.881633 36.571429-26.122449 71.053061-50.677551 99.265306 27.167347 9.404082 83.069388 31.346939 75.755103 73.142857-5.746939 35.526531-55.902041 62.171429-114.416327 62.171428z m-388.702041-63.738775z m250.253061-11.493878z m276.375511-140.016326z m-47.020409-235.102041z" fill="#7BD4EF" />
                        </svg>
                    </span>
                </span>

                <span className={`${styles.label} ${LANGUAGE === 'en' ? styles.labelHorizontal : ''}`}>{t('home.joinGroup.joinGroupChat')}</span>

                <span className={styles.mobileEntryIconWrap} aria-hidden="true">
                    <svg viewBox="0 0 1024 1024" className={styles.mobileEntryIcon} xmlns="http://www.w3.org/2000/svg">
                        <path d="M217.9 356.5c-14.1 0-25.5 11.4-25.5 25.5s11.4 25.5 25.5 25.5 25.5-11.4 25.5-25.5-11.4-25.5-25.5-25.5zM217.4 433.7c-11.2 0-20.4 9.2-20.4 20.4v174.4c0 11.2 9.2 20.4 20.4 20.4s20.4-9.2 20.4-20.4V454.1c0-11.2-9.2-20.4-20.4-20.4z" fill="#6B400D" />
                        <path d="M878.7 379.5v-86c0-96.3-57.5-153.7-153.7-153.7H218c-96.3 0-153.7 57.5-153.7 153.7v320.7C64.3 710.5 121.8 768 218 768h45.8v120.4L449.9 768h11.2c17.2 11.3 39 17.5 64.6 17.5h161.6l130.7 85v-85.1h33.5c66.6 0 107.9-41.3 107.9-107.9V484.8c-0.1-56.9-30.3-95.3-80.7-105.3zM417.8 484.8v192.8c0 16.2 2.5 31 7.2 44l-106.1 70.1v-74.9h-101c-67.7-0.3-102.2-34.8-102.5-102.5V293.5c0.3-67.7 34.8-102.2 102.5-102.5H725c67.7 0.3 102.2 34.8 102.5 102.5v83.3H525.7c-66.5 0.1-107.9 41.4-107.9 108z m490.4 192.7c-0.2 38.6-18.2 56.6-56.7 56.7h-87.2v40.3l-61-40.3H525.7c-38.5-0.2-56.6-18.2-56.7-56.7V484.8c0.2-38.6 18.2-56.6 56.7-56.7h325.7c38.5 0.2 56.6 18.2 56.7 56.7v192.7z" fill="#6B400D" />
                        <path d="M851.4 428.1H525.7c-38.5 0.2-56.6 18.2-56.7 56.7v192.8c0.2 38.5 18.2 56.6 56.7 56.7h177.5l61 40.3v-40.3h87.2c38.5-0.2 56.6-18.2 56.7-56.7V484.8c-0.1-38.6-18.1-56.6-56.7-56.7zM567 627.4c-21.1 0-38.3-17.2-38.3-38.3 0-21.1 17.2-38.3 38.3-38.3 21.1 0 38.3 17.2 38.3 38.3 0 21.1-17.2 38.3-38.3 38.3z m122.2 0c-21.1 0-38.3-17.2-38.3-38.3 0-21.1 17.2-38.3 38.3-38.3 21.1 0 38.3 17.2 38.3 38.3 0 21.1-17.2 38.3-38.3 38.3z m122.3 0c-21.1 0-38.3-17.2-38.3-38.3 0-21.1 17.2-38.3 38.3-38.3 21.1 0 38.3 17.2 38.3 38.3 0 21.1-17.2 38.3-38.3 38.3z" fill="#FFD524" />
                        <path d="M567 550.8c-21.1 0-38.3 17.2-38.3 38.3 0 21.1 17.2 38.3 38.3 38.3 21.1 0 38.3-17.2 38.3-38.3 0-21.1-17.2-38.3-38.3-38.3zM689.2 550.8c-21.1 0-38.3 17.2-38.3 38.3 0 21.1 17.2 38.3 38.3 38.3 21.1 0 38.3-17.2 38.3-38.3 0-21.1-17.2-38.3-38.3-38.3zM811.5 550.8c-21.1 0-38.3 17.2-38.3 38.3 0 21.1 17.2 38.3 38.3 38.3 21.1 0 38.3-17.2 38.3-38.3 0-21.1-17.2-38.3-38.3-38.3z" fill="#6B400D" />
                    </svg>
                </span>
            </button>

            {isOpen && (
                <div
                    className={styles.overlay}
                    onClick={() => setIsOpen(false)}
                    role="presentation"
                >
                    <div
                        className={styles.modal}
                        onClick={(event) => event.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="floating-join-group-title"
                    >
                        <h3 id="floating-join-group-title" className={styles.modalTitle}>
                            {t('home.joinGroup.scanQrJoin')}
                        </h3>

                        <div className={styles.qrGrid}>
                            <div className={styles.qrFrame}>
                                <img
                                    src={qqGroupQrSrc}
                                    alt={t('home.joinGroup.qqGroupQr')}
                                    className={styles.qrImage}
                                    onError={(event) => {
                                        (event.target as HTMLImageElement).src = fallbackSrc;
                                    }}
                                />
                                <div className={styles.qrLabel}>QQ</div>
                            </div>

                            <div className={styles.qrFrame}>
                                <img
                                    src={wechatQrSrc}
                                    alt={t('home.joinGroup.wechatGroupQr')}
                                    className={styles.qrImage}
                                    onError={(event) => {
                                        (event.target as HTMLImageElement).src = fallbackSrc;
                                    }}
                                />
                                <div className={styles.qrLabel}>{t('home.wechat') || 'WeChat'}</div>
                            </div>
                        </div>

                        <button
                            type="button"
                            className={styles.promotionHintButton}
                            onClick={handleNavigateToPromotions}
                        >
                            {t('home.joinGroup.goToPromotionGroup')}
                        </button>

                        <button
                            type="button"
                            className={styles.closeButton}
                            onClick={() => setIsOpen(false)}
                        >
                            {t('home.joinGroup.close')}
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

export default FloatingJoinGroup;
