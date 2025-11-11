import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import styles from './Sidebar.module.css';

export interface SidebarItem {
    id: string;
    label: string;
    icon?: string;
    route: string;
}

interface SidebarProps {
    items: SidebarItem[];
}

const Sidebar: React.FC<SidebarProps> = ({ items }) => {
    const navigate = useNavigate();
    const location = useLocation();

    // 获取当前激活的项ID（根据当前路径判断，支持嵌套路由）
    const getActiveId = (): string | undefined => {
        // location.pathname 已经包含了 basename（如 /funloom/home）
        // 但我们的 route 配置是相对于 basename 的（如 /home）
        // 所以需要从 location.pathname 中移除 basename 部分
        let currentPath = location.pathname;
        
        // 移除 basename（如果存在）
        const basename = '/funloom';
        if (currentPath.startsWith(basename)) {
            currentPath = currentPath.slice(basename.length) || '/';
        }
        
        // 规范化当前路径（移除末尾斜杠）
        const normalizedCurrent = currentPath.endsWith('/') && currentPath.length > 1 
            ? currentPath.slice(0, -1) 
            : currentPath;
        
        // 先尝试精确匹配（最优先）
        for (const item of items) {
            const itemPath = item.route.startsWith('/') ? item.route : `/${item.route}`;
            const normalizedItemPath = itemPath.endsWith('/') && itemPath.length > 1 
                ? itemPath.slice(0, -1) 
                : itemPath;
            
            // 精确匹配：路径完全相同
            if (normalizedItemPath === normalizedCurrent) {
                return item.id;
            }
        }
        
        // 如果没有精确匹配，才进行前缀匹配
        // 找到所有前缀匹配的项，选择最长的（最具体的匹配）
        let bestMatch: SidebarItem | undefined;
        let bestMatchLength = 0;
        
        for (const item of items) {
            const itemPath = item.route.startsWith('/') ? item.route : `/${item.route}`;
            const normalizedItemPath = itemPath.endsWith('/') && itemPath.length > 1 
                ? itemPath.slice(0, -1) 
                : itemPath;
            
            // 前缀匹配：当前路径必须是该项路径的直接子路径（以 "/" 分隔）
            // 例如：/home/library 匹配 /home，但不匹配 /home/lib
            // 注意：只匹配子路径，不匹配自身（已通过精确匹配处理）
            const prefixMatch = normalizedItemPath + '/';
            if (normalizedCurrent.startsWith(prefixMatch) && normalizedItemPath.length > bestMatchLength) {
                bestMatch = item;
                bestMatchLength = normalizedItemPath.length;
            }
        }
        
        return bestMatch?.id;
    };

    const currentActiveId = getActiveId();

    const handleItemClick = (item: SidebarItem) => {
        navigate(item.route);
    };

    return (
        <div className={styles.sidebar}>
            {items.map((item) => {
                const isActive = currentActiveId === item.id;
                return (
                    <div
                        key={item.id}
                        className={`${styles.sidebarItem} ${isActive ? styles.sidebarItemActive : ''}`}
                        onClick={() => handleItemClick(item)}
                    >
                        {item.icon && (
                            <img 
                                src={`${import.meta.env.BASE_URL}${item.icon.startsWith('/') ? item.icon.slice(1) : item.icon}`} 
                                alt={item.label} 
                            />
                        )}
                        <span>{item.label}</span>
                    </div>
                );
            })}
        </div>
    );
};

export default Sidebar;

