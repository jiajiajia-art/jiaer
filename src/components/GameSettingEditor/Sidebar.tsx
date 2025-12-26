import React, { useState } from 'react';
import styles from './Sidebar.module.css';
import { getImageUrl } from '../../config';
import PDFTemplateModal from './PDFTemplateModal';

interface SidebarProps {
    activePanel: string;
    onPanelChange: (panelId: string) => void;
    isParsing: boolean;
    isParsed: boolean;
    mode?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ activePanel, onPanelChange, isParsing, isParsed, mode = 'visual' }) => {
    const [isPDFModalOpen, setIsPDFModalOpen] = useState(false);
    const baseNavItems = [
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

    // 只在 worldInteraction 模式下添加地图编辑模块
    const navItems = mode === 'worldInteraction' 
        ? [
            ...baseNavItems,
            {
                id: 'mapEdit',
                number: '5',
                title: '地图编辑',
                subtitle: '子场景 / 场景 / 地图',
            },
        ]
        : baseNavItems;

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
                    <img src={getImageUrl('interactive-fction-game-avatar/1/1763447440878_dfe11825de25f8a0c21c32a9f90086cd.jpg')} alt="" />
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
            
            {/* 问号帮助按钮 */}
            <div className={styles.helpButtonContainer}>
                <button
                    className={styles.helpButton}
                    onClick={() => setIsPDFModalOpen(true)}
                    title="PDF模板指引"
                >
                    <span className={styles.helpIcon}>?</span>
                </button>
            </div>

            {/* PDF模板指引弹窗 */}
            <PDFTemplateModal
                isOpen={isPDFModalOpen}
                onClose={() => setIsPDFModalOpen(false)}
            />
        </aside>
    );
};

export default Sidebar;

