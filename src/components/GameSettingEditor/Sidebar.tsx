import React from 'react';
import styles from './Sidebar.module.css';
import { getImageUrl } from '../../utils/constants';

interface SidebarProps {
    activePanel: string;
    onPanelChange: (panelId: string) => void;
    isParsing: boolean;
    isParsed: boolean;
    mode?: string;
}

// 定义各模式的导航配置
const modeConfigs = {
    visual: [
        { id: 'documents', title: '文档解析', subtitle: '上传设定 / 自动出稿' },
        { id: 'world', title: '世界观表单', subtitle: '可修改世界观设定' },
        { id: 'characters', title: '角色档案', subtitle: '修改或添加角色立绘、差分' },
        { id: 'scenes', title: '场景 / BGM', subtitle: '背景 + 配乐绑定' },
    ],
    worldInteraction: [
        { id: 'documents', title: '文档解析', subtitle: '上传设定 / 自动出稿' },
        { id: 'world', title: '世界观表单', subtitle: '可修改世界观设定' },
        { id: 'attributeGrowth', title: '属性 · 养成培养插件（开发中）', subtitle: '属性养成培养' },
        { id: 'characters', title: '角色档案', subtitle: '修改或添加角色立绘、差分' },
        { id: 'scenes', title: '场景 / BGM', subtitle: '背景 + 配乐绑定' },
        { id: 'functionalNPCs', title: '剧情事件插件（开发中）', subtitle: '功能性NPC管理' },
        { id: 'mapEdit', title: '地图编辑', subtitle: '子场景 / 场景 / 地图' },
        { id: 'objects', title: '物品编辑', subtitle: '管理游戏中所有物品' },
    ]
};

const Sidebar: React.FC<SidebarProps> = ({ activePanel, onPanelChange, isParsing, isParsed, mode = 'visual' }) => {
    // 根据模式获取对应的导航项
    const navItems = modeConfigs[mode as keyof typeof modeConfigs] || modeConfigs.visual;

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

    return (
        <aside className={styles.sidebar}>
            <div className={styles.brand}>
                <div>
                    <img src={getImageUrl('/interactive-fiction-game-avatar/1/1763447440878_dfe11825de25f8a0c21c32a9f90086cd.jpg')} alt="" />
                </div>
                <div>
                    <p className={styles.brandLabel}>Kuran Studio</p>
                    <p className={styles.brandDesc}>AI 视觉小说工坊</p>
                </div>
            </div>

            <nav className={styles.nav}>
                {navItems.map((item, index) => {
                    const status = getItemStatus(item.id);
                    const disabled = isItemDisabled(item.id);
                    
                    return (
                        <button
                            key={item.id}
                            className={`${styles.navBtn} ${status === 'active' ? styles.active : ''} ${status === 'disabled' ? styles.disabled : ''}`}
                            onClick={() => !disabled && onPanelChange(item.id)}
                            disabled={disabled}
                        >
                            <span>{index + 1} · {item.title}</span>
                            <small>{item.subtitle}</small>
                        </button>
                    );
                })}
            </nav>
        </aside>
    );
};

export default Sidebar;