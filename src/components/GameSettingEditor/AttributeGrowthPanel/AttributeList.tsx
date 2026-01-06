import React from 'react';
import styles from './AttributeList.module.css';
import type { AttributeConfig } from './types';

interface AttributeListProps {
    attributes: AttributeConfig[];
    activeId: string | null;
    onSelect: (id: string) => void;
    onDelete?: (id: string) => void;
}

const AttributeList: React.FC<AttributeListProps> = ({ attributes, activeId, onSelect, onDelete }) => {
    if (!attributes.length) {
        return (
            <div className={styles.leftList}>
                <div className={styles.emptyState}>
                    <div className={styles.emptyStateTitle}>暂无属性</div>
                    <div className={styles.emptyStateDesc}>点击右上角「+ 添加属性」开始配置一条新的养成属性。</div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.leftList}>
            {attributes.map((attr) => {
                const isActive = activeId === attr.id;
                const requiredTag = attr.required ? '必修' : '选修';
                const targetLabel = attr.target === 'player' ? '玩家' : 'NPC';

                return (
                    <div
                        key={attr.id}
                        className={`${styles.attrItem} ${isActive ? styles.attrItemActive : ''}`}
                        onClick={() => onSelect(attr.id)}
                    >
                        <div className={styles.attrMain}>
                            <div className={styles.attrNameRow}>
                                <span>{attr.name}</span>
                                <span className={styles.attrTag}>{targetLabel}</span>
                                {attr.visible && (
                                    <span className={`${styles.attrTag} ${styles.attrTagDisplay}`}>显示</span>
                                )}
                            </div>
                            <div className={styles.attrDesc}>{attr.description}</div>
                            <div className={styles.attrKey}>
                                Key: {attr.key} · {requiredTag}
                            </div>
                        </div>
                        <div className={styles.attrMeta}>
                            <span className={styles.pill}>
                                {attr.defaultValue}
                                {attr.unit}
                            </span>
                            <span>
                                上限 {attr.maxValue}
                                {attr.unit}
                            </span>
                        </div>
                        {onDelete && (
                            <button
                                type="button"
                                className={styles.dangerGhost}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete(attr.id);
                                }}
                            >
                                删除
                            </button>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default AttributeList;


