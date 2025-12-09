import React from 'react';
import styles from './Sidebar.module.css';

interface SidebarProps {
    activePanel: string;
    onPanelChange: (panelId: string) => void;
    isParsing: boolean;
    isParsed: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ activePanel, onPanelChange, isParsing, isParsed }) => {
    const navItems = [
        {
            id: 'documents',
            number: '1',
            title: '文档解析',
            subtitle: '上传设定 / 自动出稿',
        },
        {
            id: 'world',
            number: '2',
            title: '世界观表单',
            subtitle: '可修改世界观设定',
        },
        {
            id: 'characters',
            number: '3',
            title: '角色档案',
            subtitle: '修改或添加角色立绘、差分',
        },
        {
            id: 'scenes',
            number: '4',
            title: '场景 / BGM',
            subtitle: '背景 + 配乐绑定',
        },
    ];

    const isItemDisabled = (itemId: string) => {
        if (itemId === 'documents') return false;
        // 如果正在解析或未解析完成，后面的项目都不可点击
        if (isParsing || !isParsed) return true;
        return false;
    };

    const getItemStatus = (itemId: string) => {
        if (itemId === 'documents') {
            if (isParsing) return 'active';
            // 如果当前面板是 documents，应该显示为 active，不管是否已解析
            if (activePanel === itemId) return 'active';
            if (isParsed) return 'done';
            return '';
        }
        // 后面的项目：如果已解析完成，都可以点击
        if (isParsed) {
            return activePanel === itemId ? 'active' : '';
        }
        return 'disabled';
    };

    return (
        <aside className={styles.sidebar}>
            <div className={styles.brand}>
                <div>
                    <img src="https://kurangames.com/images/interactive-fction-game-avatar/1/1763447440878_dfe11825de25f8a0c21c32a9f90086cd.jpg" alt="" />
                </div>
                <div>
                    <p className={styles.brandLabel}>Kuran Studio</p>
                    <p className={styles.brandDesc}>AI 视觉小说工坊</p>
                </div>
            </div>

            <nav className={styles.nav}>
                {navItems.map((item) => {
                    const status = getItemStatus(item.id);
                    const disabled = isItemDisabled(item.id);
                    
                    return (
                        <button
                            key={item.id}
                            className={`${styles.navBtn} ${status === 'active' ? styles.active : ''} ${status === 'disabled' ? styles.disabled : ''}`}
                            onClick={() => !disabled && onPanelChange(item.id)}
                            disabled={disabled}
                        >
                            <span>{item.number} · {item.title}</span>
                            <small>{item.subtitle}</small>
                        </button>
                    );
                })}
            </nav>

            {/* <div className={styles.sidebarFooter}>
                <p className={styles.footerLabel}>当前账号</p>
                <p className={styles.footerValue}>柚子 · 创作者</p>
                <button className={styles.ghostSmall}>切换作品</button>
            </div> */}
        </aside>
    );
};

export default Sidebar;

