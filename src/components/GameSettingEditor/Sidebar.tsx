import React, { useEffect, useMemo, useRef } from 'react';
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
    title: string;
    shortTitle: string;
    subtitle: string;
}

const BRAND_IMAGE_URL = 'https://api.kurangames.com/interactive-fiction-game-avatar/1/1763447440878_dfe11825de25f8a0c21c32a9f90086cd.jpg';

const modeConfigs: Record<string, NavItem[]> = {
    visual: [
        { id: 'documents', title: '文档解析', shortTitle: '文档', subtitle: '上传设定 / 自动出稿' },
        { id: 'world', title: '世界观表单', shortTitle: '世界观', subtitle: '可修改世界观设定' },
        { id: 'characters', title: '角色档案', shortTitle: '角色', subtitle: '修改或添加角色立绘、差分' },
        { id: 'scenes', title: '场景 / BGM', shortTitle: '场景', subtitle: '背景 + 配乐绑定' },
    ],
    worldInteraction: [
        { id: 'documents', title: '文档解析', shortTitle: '文档', subtitle: '上传设定 / 自动出稿' },
        { id: 'world', title: '世界观表单', shortTitle: '世界观', subtitle: '可修改世界观设定' },
        { id: 'attributeGrowth', title: '属性 · 养成培养插件', shortTitle: '养成', subtitle: '属性养成培养' },
        { id: 'characters', title: '角色档案', shortTitle: '角色', subtitle: '修改或添加角色立绘、差分' },
        { id: 'scenes', title: '场景 / BGM', shortTitle: '场景', subtitle: '背景 + 配乐绑定' },
        { id: 'functionalNPCs', title: '剧情事件插件', shortTitle: '事件', subtitle: '功能性 NPC 管理' },
        { id: 'mapEdit', title: '地图编辑', shortTitle: '地图', subtitle: '子场景 / 场景 / 地图' },
    ],
};

const Sidebar: React.FC<SidebarProps> = ({ activePanel, onPanelChange, isParsing, isParsed, mode = 'visual' }) => {
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
    const progressStateLabel = isParsing ? '解析中' : currentStatus === 'done' ? '已完成' : '进行中';
    const mobileSummaryText = `Step ${progressLabel} · ${currentItem.shortTitle}：${currentItem.subtitle}`;

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
                    <p className={styles.brandLabel}>Kuran Studio</p>
                    <p className={styles.brandDesc}>AI 视觉小说工坊</p>
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
                                <span className={styles.navTitleDesktop}>{index + 1} · {item.title}</span>
                                <span className={styles.navTitleMobile}>{item.shortTitle}</span>
                                <small>{item.subtitle}</small>
                            </span>
                        </button>
                    );
                })}
            </nav>
        </aside>
    );
};

export default Sidebar;
