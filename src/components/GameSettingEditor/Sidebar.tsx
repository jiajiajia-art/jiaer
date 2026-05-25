import React, { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './Sidebar.module.css';

interface SidebarProps {
    activePanel: string;
    onPanelChange: (panelId: string) => void;
    isParsing: boolean;
    isParsed: boolean;
    mode?: string;
}

interface NavItem {
    id: string;
    i18nKey: string;
}

const BRAND_IMAGE_URL = 'https://api.kurangames.com/interactive-fiction-game-avatar/1/1763447440878_dfe11825de25f8a0c21c32a9f90086cd.jpg';

const modeConfigs: Record<string, NavItem[]> = {
    visual: [
        { id: 'documents', i18nKey: 'documents' },
        { id: 'world', i18nKey: 'world' },
        { id: 'characters', i18nKey: 'characters' },
        { id: 'scenes', i18nKey: 'scenes' },
    ],
    worldInteraction: [
        { id: 'documents', i18nKey: 'documents' },
        { id: 'world', i18nKey: 'world' },
        { id: 'attributeGrowth', i18nKey: 'attributeGrowth' },
        { id: 'characters', i18nKey: 'characters' },
        { id: 'scenes', i18nKey: 'scenes' },
        { id: 'functionalNPCs', i18nKey: 'functionalNPCs' },
        { id: 'mapEdit', i18nKey: 'mapEdit' },
    ],
};

const Sidebar: React.FC<SidebarProps> = ({ activePanel, onPanelChange, isParsing, isParsed, mode = 'visual' }) => {
    const { t } = useTranslation();
    const navItems = modeConfigs[mode] || modeConfigs.visual;
    const navRef = useRef<HTMLElement | null>(null);
    const navButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

    const isItemDisabled = (itemId: string) => {
        if (itemId === 'documents') return false;
        if (isParsing || !isParsed) return true;
        return false;
    };

    const getItemStatus = (itemId: string) => {
        if (itemId === 'documents') {
            if (isParsing) return 'active';
            if (activePanel === itemId) return 'active';
            if (isParsed) return 'done';
            return '';
        }
        if (isParsed) {
            return activePanel === itemId ? 'active' : '';
        }
        return 'disabled';
    };

    const currentIndex = useMemo(() => {
        const matchedIndex = navItems.findIndex((item) => item.id === activePanel);
        return matchedIndex >= 0 ? matchedIndex : 0;
    }, [activePanel, navItems]);

    const currentItem = navItems[currentIndex];
    const currentStatus = currentItem ? getItemStatus(currentItem.id) : '';
    const progressLabel = `${currentIndex + 1} / ${navItems.length}`;
    const progressStateLabel = isParsing ? t('createGame.sidebar.parsing') : currentStatus === 'done' ? t('createGame.sidebar.completed') : t('createGame.sidebar.inProgress');
    const mobileSummaryText = `${t('createGame.sidebar.step')} ${progressLabel} · ${t(`createGame.sidebar.${currentItem?.i18nKey}Short` as const)}：${t(`createGame.sidebar.${currentItem?.i18nKey}Subtitle` as const)}`;

    useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia('(max-width: 768px)').matches) {
            return;
        }

        const container = navRef.current;
        const activeButton = currentItem ? navButtonRefs.current[currentItem.id] : null;
        if (!container || !activeButton) {
            return;
        }

        const scrollLeft = activeButton.offsetLeft - (container.clientWidth - activeButton.clientWidth) / 2;
        window.requestAnimationFrame(() => {
            container.scrollTo({
                left: Math.max(0, scrollLeft),
                behavior: 'smooth',
            });
        });
    }, [currentItem]);

    return (
        <aside className={styles.sidebar}>
            <div className={styles.brand}>
                <div className={styles.brandAvatarWrap}>
                    <img
                        className={styles.brandAvatar}
                        src={BRAND_IMAGE_URL}
                        alt=""
                    />
                </div>
                <div>
                    <p className={styles.brandLabel}>{t('createGame.kuranStudio')}</p>
                    <p className={styles.brandDesc}>{t('createGame.aiVisualNovelWorkshop')}</p>
                </div>
            </div>

            <div className={styles.mobileProgressCard}>
                <p className={styles.mobileProgressTitle}>{mobileSummaryText}</p>
                <span className={styles.mobileProgressStatus}>{progressStateLabel}</span>
            </div>

            <nav ref={navRef} className={styles.nav}>
                {navItems.map((item, index) => {
                    const status = getItemStatus(item.id);
                    const disabled = isItemDisabled(item.id);

                    return (
                        <button
                            key={item.id}
                            ref={(node) => {
                                navButtonRefs.current[item.id] = node;
                            }}
                            className={`${styles.navBtn} ${status === 'active' ? styles.active : ''} ${status === 'disabled' ? styles.disabled : ''} ${status === 'done' ? styles.done : ''}`}
                            onClick={() => !disabled && onPanelChange(item.id)}
                            disabled={disabled}
                            aria-current={status === 'active' ? 'step' : undefined}
                        >
                            <span className={styles.navBadge}>{index + 1}</span>
                            <span className={styles.navText}>
                                <span className={styles.navTitleDesktop}>{index + 1} · {t(`createGame.sidebar.${item.i18nKey}` as const)}</span>
                                <span className={styles.navTitleMobile}>{t(`createGame.sidebar.${item.i18nKey}Short` as const)}</span>
                                <small>{t(`createGame.sidebar.${item.i18nKey}Subtitle` as const)}</small>
                            </span>
                        </button>
                    );
                })}
            </nav>
        </aside>
    );
};

export default Sidebar;
