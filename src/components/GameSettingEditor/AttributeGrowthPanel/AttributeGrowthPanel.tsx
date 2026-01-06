import React, { useMemo, useState, useEffect } from 'react';
import styles from './AttributeGrowthPanel.module.css';
import AttributeList from './AttributeList';
import AttributeDetailForm from './AttributeDetailForm';
import type { AttributeConfig, AttributeTarget } from './types';
import { MOCK_ATTRIBUTES } from './types';

const AttributeGrowthPanel: React.FC = () => {
    const [target, setTarget] = useState<AttributeTarget>('player');
    const [attributes] = useState<AttributeConfig[]>(MOCK_ATTRIBUTES);
    const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);
    const [activeId, setActiveId] = useState<string | null>(() => {
        const first = MOCK_ATTRIBUTES.find(a => a.target === 'player');
        return first ? first.id : null;
    });
    const [formState, setFormState] = useState<Partial<AttributeConfig> | null>(null);

    const filteredAttributes = useMemo(
        () => attributes.filter(attr => attr.target === target),
        [attributes, target],
    );

    const activeAttribute = useMemo(
        () => filteredAttributes.find(attr => attr.id === activeId) || null,
        [filteredAttributes, activeId],
    );

    // 当选中的属性或 tab 变化时，更新右侧表单
    useEffect(() => {
        if (activeAttribute) {
            setIsCreatingNew(false);
            setFormState(activeAttribute);
        } else {
            setFormState({
                target,
                key: '',
                name: '',
                displayName: '',
                description: '',
                defaultValue: 0,
                maxValue: 100,
                unit: '',
                required: false,
                visible: true,
            });
        }
    }, [activeAttribute, target]);

    // 切换 tab 时，如果当前没有该类型的选中项，自动选中第一个
    useEffect(() => {
        if (!filteredAttributes.length) {
            setActiveId(null);
            return;
        }
        // 正在创建新属性时，不自动选中列表项
        if (isCreatingNew) {
            return;
        }
        if (!activeId || !filteredAttributes.some(a => a.id === activeId)) {
            setActiveId(filteredAttributes[0].id);
        }
    }, [filteredAttributes, activeId, isCreatingNew]);

    const handleCreateNew = () => {
        setActiveId(null);
        setIsCreatingNew(true);
        setFormState({
            target,
            key: '',
            name: '',
            displayName: '',
            description: '',
            defaultValue: 0,
            maxValue: 100,
            unit: '',
            required: false,
            visible: true,
        });
    };

    return (
        <div className={styles.panelRoot}>
            <div className={styles.header}>
                <p className={styles.eyebrow}>STEP 6</p>
                <h2 className={styles.title}>属性 · 养成培养插件</h2>
                <p className={styles.subtitle}>
                    配置玩家 / NPC 的养成属性与公式，支持多属性成长与展示控制，样式保持与创作段一致。
                </p>
            </div>

            <div className={styles.layout}>
                {/* 左侧：属性列表 */}
                <div className={`${styles.card} ${styles.leftCard}`}>
                    <div className={styles.leftHeader}>
                        <h3 className={styles.leftTitle}>属性列表</h3>
                        <button className={styles.addBtn} type="button" onClick={handleCreateNew}>
                            + 添加属性
                        </button>
                    </div>
                    <div className={styles.leftTabsRow}>
                        <div className={styles.leftTabs}>
                            <button
                                type="button"
                                className={`${styles.leftTab} ${target === 'player' ? styles.leftTabActive : ''}`}
                                onClick={() => {
                                    setTarget('player');
                                    setIsCreatingNew(false);
                                }}
                            >
                                玩家属性
                            </button>
                            <button
                                type="button"
                                className={`${styles.leftTab} ${target === 'npc' ? styles.leftTabActive : ''}`}
                                onClick={() => {
                                    setTarget('npc');
                                    setIsCreatingNew(false);
                                }}
                            >
                                NPC 属性
                            </button>
                        </div>
                    </div>

                    <AttributeList
                        attributes={filteredAttributes}
                        activeId={activeId}
                        onSelect={(id) => {
                            setIsCreatingNew(false);
                            setActiveId(id);
                        }}
                        onDelete={(id) => {
                            // TODO: 实现删除逻辑
                            console.log('Delete attribute:', id);
                        }}
                    />
                </div>

                {/* 右侧：属性设置表单 */}
                <div className={styles.card}>
                    <AttributeDetailForm
                        formState={formState}
                        onChange={(updates) => {
                            setFormState(prev => (prev ? { ...prev, ...updates } : null));
                        }}
                        onSave={() => {
                            // TODO: 实现保存逻辑
                            console.log('Save attribute:', formState);
                        }}
                    />
                </div>
            </div>
        </div>
    );
};

export default AttributeGrowthPanel;


