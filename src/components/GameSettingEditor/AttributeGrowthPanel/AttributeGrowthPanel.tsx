import React, { useMemo, useState, useEffect } from 'react';
import styles from './AttributeGrowthPanel.module.css';
import AttributeList from './AttributeList';
import AttributeDetailForm from './AttributeDetailForm';
import type { AttributeConfig, AttributeTarget } from './types';
import type { AttributeSetting } from '../../../api/worldInteraction/worldInteractionApi.type';
import { convertAttributeSettingToConfigs } from './attributeDataUtils';
import worldEditor from '../../../api/worldInteraction/worldEditor';
import ConfirmModal from '../../GoodsModal/ConfirmModal';
import { toast } from 'react-hot-toast';
import { useGameStore } from '../../../store/gameStore';

interface AttributeGrowthPanelProps {
    attributeSetting?: AttributeSetting;
    onDataChange?: () => void;
}

const AttributeGrowthPanel: React.FC<AttributeGrowthPanelProps> = ({ attributeSetting, onDataChange }) => {
    const { fileId } = useGameStore();
    const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);
    const [attributeToDelete, setAttributeToDelete] = useState<AttributeConfig | null>(null);
    const [target, setTarget] = useState<AttributeTarget>('player');
    // 本地删除的属性ID集合（用于立即从UI中移除，避免等待后端刷新）
    const [deletedAttributeIds, setDeletedAttributeIds] = useState<Set<string>>(new Set());
    
    // 将 AttributeSetting 转换为 AttributeConfig[] 格式，并过滤已删除的
    const attributes = useMemo(() => {
        if (!attributeSetting) {
            return [];
        }
        const allAttributes = convertAttributeSettingToConfigs(attributeSetting);
        // 过滤掉已删除的属性
        return allAttributes.filter(attr => !deletedAttributeIds.has(attr.id));
    }, [attributeSetting, deletedAttributeIds]);
    const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [formState, setFormState] = useState<Partial<AttributeConfig> | null>(null);

    // 初始化 activeId
    useEffect(() => {
        if (attributes.length > 0 && !activeId) {
            const playerAttributes = attributes.filter(a => a.target === 'player');
            if (playerAttributes.length > 0) {
                setActiveId(playerAttributes[0].id);
            } else if (attributes.length > 0) {
                setActiveId(attributes[0].id);
            }
        }
    }, [attributes, activeId]);

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
        // 如果正在创建新属性，不更新表单（避免覆盖用户正在输入的内容）
        if (isCreatingNew) {
            return;
        }
        
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
    }, [activeAttribute, target, isCreatingNew]);

    // 当 attributeSetting prop 变化时（从后端刷新），清空本地删除记录
    useEffect(() => {
        setDeletedAttributeIds(new Set());
    }, [attributeSetting]);

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

    const handleSave = async () => {
        if (!fileId || !formState) {
            toast.error('缺少必要数据');
            return;
        }

        // 验证必填字段
        if (!formState.key || !formState.displayName || !formState.target) {
            toast.error('请填写所有必填字段');
            return;
        }

        try {
            const attributes = {
                key: formState.key,
                displayName: formState.displayName,
                description: formState.description || '',
                defaultValue: formState.defaultValue || 0,
                maxValue: formState.maxValue || 100,
                unit: formState.unit || '',
                visible: formState.visible ?? true,
                formula: formState.formula || '',
            };

            await worldEditor.addAttributeDefinitions(fileId, {
                type: formState.target,
                attributes: attributes,
            });

            toast.success('属性添加成功');
            setIsCreatingNew(false);
            setFormState(null);
            onDataChange?.();
        } catch (error) {
            console.error('保存属性失败:', error);
            toast.error('保存属性失败，请稍后重试');
        }
    };

    const handleDeleteClick = (id: string) => {
        const attr = attributes.find(a => a.id === id);
        if (attr) {
            setAttributeToDelete(attr);
            setDeleteModalOpen(true);
        }
    };

    const handleConfirmDelete = async () => {
        if (!fileId || !attributeToDelete) {
            setDeleteModalOpen(false);
            setAttributeToDelete(null);
            return;
        }

        try {
            await worldEditor.deleteAttributeDefinitions({
                fileId,
                type: attributeToDelete.target,
                attributeName: attributeToDelete.key,
            });

            // 立即从UI中移除该属性（乐观更新）
            setDeletedAttributeIds(prev => new Set(prev).add(attributeToDelete.id));
            
            // 如果删除的是当前选中的属性，清空选中状态
            if (activeId === attributeToDelete.id) {
                setActiveId(null);
                setFormState(null);
            }
            
            setDeleteModalOpen(false);
            setAttributeToDelete(null);
            toast.success('属性删除成功');
        } catch (error) {
            console.error('删除属性失败:', error);
            toast.error('删除属性失败，请稍后重试');
            setDeleteModalOpen(false);
            setAttributeToDelete(null);
        }
    };

    const handleCancelDelete = () => {
        setDeleteModalOpen(false);
        setAttributeToDelete(null);
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
                        onDelete={handleDeleteClick}
                    />
                </div>

                {/* 右侧：属性设置表单 */}
                <div className={styles.card}>
                    <AttributeDetailForm
                        formState={formState}
                        onChange={(updates) => {
                            setFormState(prev => (prev ? { ...prev, ...updates } : null));
                        }}
                        onSave={handleSave}
                    />
                </div>
            </div>

            {/* 删除确认弹窗 */}
            <ConfirmModal
                isOpen={deleteModalOpen}
                onConfirm={handleConfirmDelete}
                onCancel={handleCancelDelete}
                title="删除属性"
                message={`确定要删除属性「${attributeToDelete?.displayName || attributeToDelete?.name}」吗？删除后不可恢复。`}
                confirmButtonText="确认删除"
                cancelButtonText="取消"
            />
        </div>
    );
};

export default AttributeGrowthPanel;


