import React, { useState, useMemo, useEffect } from 'react';
import styles from './CharacterAttributesPanel.module.css';
import type { AttributeSetting } from '../../../api/worldInteraction/worldInteractionApi.type';
import { getCharacterAttributes, getAvailableAttributes } from './characterAttributeUtils';
import worldEditor from '../../../api/worldInteraction/worldEditor';
import ConfirmModal from '../../GoodsModal/ConfirmModal';
import { toast } from 'react-hot-toast';
import { MdArrowDropDown } from 'react-icons/md';

interface CharacterAttributesPanelProps {
    attributeSetting?: AttributeSetting;
    characterId: string;
    isPlayer: boolean;
    fileId: string;
    onDataChange?: () => void;
}

interface LocalAttributeItem {
    key: string;
    displayName: string;
    value: number;
    defaultValue: number;
    maxValue: number;
    unit: string;
    formula: string;
    isModified: boolean; // 标记是否被修改
    isNew: boolean; // 标记是否是新添加的
}

const CharacterAttributesPanel: React.FC<CharacterAttributesPanelProps> = ({
    attributeSetting,
    characterId,
    isPlayer,
    fileId,
    onDataChange,
}) => {
    const [isExpanded, setIsExpanded] = useState<boolean>(false);
    const [showSelector, setShowSelector] = useState<boolean>(false);
    const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
    const [localAttributes, setLocalAttributes] = useState<Map<string, LocalAttributeItem>>(new Map());
    const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);
    const [attributeToDelete, setAttributeToDelete] = useState<string | null>(null);
    const [hasChanges, setHasChanges] = useState<boolean>(false);

    // 获取当前角色的属性
    const currentAttributes = useMemo(() => {
        if (!attributeSetting) return [];
        return getCharacterAttributes(attributeSetting, characterId, isPlayer);
    }, [attributeSetting, characterId, isPlayer]);

    // 获取可添加的属性
    const availableAttributes = useMemo(() => {
        if (!attributeSetting) return [];
        return getAvailableAttributes(attributeSetting, characterId, isPlayer);
    }, [attributeSetting, characterId, isPlayer]);

    // 合并后端数据和本地修改
    const displayAttributes = useMemo(() => {
        const map = new Map<string, LocalAttributeItem>();
        
        // 先添加后端数据
        currentAttributes.forEach(attr => {
            const local = localAttributes.get(attr.key);
            map.set(attr.key, {
                key: attr.key,
                displayName: attr.displayName,
                value: local?.value ?? attr.value,
                defaultValue: attr.defaultValue,
                maxValue: attr.maxValue,
                unit: attr.unit,
                formula: local?.formula ?? attr.formula ?? '',
                isModified: local?.isModified ?? false,
                isNew: false,
            });
        });

        // 再添加本地新添加的（但后端还没有的）
        localAttributes.forEach((attr, key) => {
            if (!map.has(key) && attr.isNew) {
                map.set(key, attr);
            }
        });

        return Array.from(map.values());
    }, [currentAttributes, localAttributes]);

    // 检查是否有未保存的更改
    useEffect(() => {
        const hasUnsavedChanges = Array.from(localAttributes.values()).some(
            attr => attr.isModified || attr.isNew
        );
        setHasChanges(hasUnsavedChanges);
    }, [localAttributes]);

    // 当属性设置变化时，同步本地状态
    useEffect(() => {
        // 清除已存在的属性（因为后端数据更新了）
        setLocalAttributes(prev => {
            const newMap = new Map();
            prev.forEach((attr, key) => {
                if (attr.isNew) {
                    // 保留新添加但后端还没有的
                    newMap.set(key, attr);
                }
            });
            return newMap;
        });
    }, [currentAttributes]);

    const handleAddClick = () => {
        if (availableAttributes.length > 0) {
            const currentKeys = new Set(displayAttributes.map(attr => attr.key));
            const initialSelection = new Set(
                availableAttributes
                    .filter(attr => !currentKeys.has(attr.key))
                    .map(attr => attr.key)
            );
            setSelectedKeys(initialSelection);
            setShowSelector(true);
        }
    };

    const handleCheckboxChange = (key: string, checked: boolean) => {
        setSelectedKeys(prev => {
            const newSet = new Set(prev);
            if (checked) {
                newSet.add(key);
            } else {
                newSet.delete(key);
            }
            return newSet;
        });
    };

    const handleConfirmAdd = () => {
        if (selectedKeys.size === 0) {
            setShowSelector(false);
            return;
        }

        // 获取属性定义
        const definitions = isPlayer
            ? attributeSetting?.attributeDefinitions.player
            : attributeSetting?.attributeDefinitions.npc;

        if (!definitions) {
            toast.error('无法获取属性定义');
            return;
        }

        // 添加到本地状态
        setLocalAttributes(prev => {
            const newMap = new Map(prev);
            selectedKeys.forEach(key => {
                const definition = definitions[key];
                if (definition) {
                    newMap.set(key, {
                        key,
                        displayName: definition.displayName,
                        value: definition.defaultValue,
                        defaultValue: definition.defaultValue,
                        maxValue: definition.maxValue,
                        unit: definition.unit,
                        formula: definition.formula || '',
                        isModified: false,
                        isNew: true,
                    });
                }
            });
            return newMap;
        });

        setSelectedKeys(new Set());
        setShowSelector(false);
        toast.success(`已添加 ${selectedKeys.size} 个属性`);
    };

    const handleCancelAdd = () => {
        setShowSelector(false);
        setSelectedKeys(new Set());
    };

    const handleValueChange = (key: string, value: number) => {
        setLocalAttributes(prev => {
            const newMap = new Map(prev);
            const existing = newMap.get(key);
            if (existing) {
                newMap.set(key, {
                    ...existing,
                    value,
                    isModified: true,
                });
            } else {
                // 如果是后端已有但本地没有记录的，创建一个记录
                const attr = displayAttributes.find(a => a.key === key);
                if (attr) {
                    newMap.set(key, {
                        ...attr,
                        value,
                        isModified: true,
                    });
                }
            }
            return newMap;
        });
    };

    const handleFormulaChange = (key: string, formula: string) => {
        setLocalAttributes(prev => {
            const newMap = new Map(prev);
            const existing = newMap.get(key);
            if (existing) {
                newMap.set(key, {
                    ...existing,
                    formula,
                    isModified: true,
                });
            } else {
                const attr = displayAttributes.find(a => a.key === key);
                if (attr) {
                    newMap.set(key, {
                        ...attr,
                        formula,
                        isModified: true,
                    });
                }
            }
            return newMap;
        });
    };

    const handleDeleteClick = (key: string) => {
        setAttributeToDelete(key);
        setDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!attributeToDelete) {
            setDeleteModalOpen(false);
            return;
        }

        const attr = displayAttributes.find(a => a.key === attributeToDelete);
        if (!attr) {
            setDeleteModalOpen(false);
            setAttributeToDelete(null);
            return;
        }

        // 如果是新添加的，直接从本地状态删除
        if (attr.isNew) {
            setLocalAttributes(prev => {
                const newMap = new Map(prev);
                newMap.delete(attributeToDelete);
                return newMap;
            });
            setDeleteModalOpen(false);
            setAttributeToDelete(null);
            toast.success('属性已移除');
            return;
        }

        // 否则调用API删除
        try {
            if (isPlayer) {
                // 玩家属性删除（如果需要的话）
                toast.error('玩家属性暂不支持删除');
            } else {
                await worldEditor.deleteNpcAttributeDefinitions({
                    fileId,
                    npcId: characterId,
                    attributeName: attributeToDelete,
                });
            }
            toast.success('属性删除成功');
            setDeleteModalOpen(false);
            setAttributeToDelete(null);
            onDataChange?.();
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

    const handleBatchUpdate = async () => {
        if (!hasChanges) return;

        try {
            const newAttributes: Array<{ key: string; value: number; formula: string }> = [];
            const updateAttributes: Record<string, { value: number; formula: string }> = {};

            localAttributes.forEach((attr, key) => {
                if (attr.isNew) {
                    // 新添加的需要调用添加API
                    newAttributes.push({
                        key,
                        value: attr.value,
                        formula: attr.formula,
                    });
                } else if (attr.isModified) {
                    // 修改的需要调用更新API
                    updateAttributes[key] = {
                        value: attr.value,
                        formula: attr.formula,
                    };
                }
            });

            // 批量添加新属性
            if (newAttributes.length > 0 && !isPlayer) {
                for (const attr of newAttributes) {
                    await worldEditor.addNpcAttributeDefinitions({
                        fileId,
                        npcId: characterId,
                        attributeName: attr.key,
                        value: attr.value,
                        formula: attr.formula,
                    });
                }
            }

            // 批量更新属性
            if (Object.keys(updateAttributes).length > 0) {
                await worldEditor.updateNpcAttributeDefinitions(fileId, {
                    id: characterId,
                    update: updateAttributes,
                });
            }

            toast.success('属性更新成功');
            setLocalAttributes(new Map());
            onDataChange?.();
        } catch (error) {
            console.error('批量更新失败:', error);
            toast.error('批量更新失败，请稍后重试');
        }
    };

    const definitions = isPlayer
        ? attributeSetting?.attributeDefinitions.player
        : attributeSetting?.attributeDefinitions.npc;

    return (
        <>
            <div className={styles.detailBlock}>
                <div
                    className={styles.collapsibleHeader}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <strong>角色属性</strong>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {isExpanded && !showSelector && availableAttributes.length > 0 && (
                            <button
                                className={styles.primaryButton}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleAddClick();
                                }}
                            >
                                + 添加属性
                            </button>
                        )}
                        {isExpanded && hasChanges && (
                            <button
                                className={styles.saveButton}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleBatchUpdate();
                                }}
                            >
                                保存更改
                            </button>
                        )}
                        <MdArrowDropDown size={30} style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                    </div>
                </div>
                {isExpanded && (
                    <div className={styles.attributeList}>
                        {/* 属性选择器 */}
                        {showSelector && (
                            <div className={styles.attributeSelector}>
                                <div className={styles.attributeSelectorHeader}>
                                    <span>选择要添加的属性</span>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                            className={styles.ghostTiny}
                                            onClick={() => {
                                                const currentKeys = new Set(displayAttributes.map(a => a.key));
                                                setSelectedKeys(new Set(
                                                    availableAttributes
                                                        .filter(a => !currentKeys.has(a.key))
                                                        .map(a => a.key)
                                                ));
                                            }}
                                            type="button"
                                        >
                                            全选未添加
                                        </button>
                                        <button
                                            className={styles.ghostTiny}
                                            onClick={() => setSelectedKeys(new Set())}
                                            type="button"
                                        >
                                            清空
                                        </button>
                                    </div>
                                </div>
                                <div className={styles.attributeSelectorList}>
                                    {availableAttributes.map((attr) => {
                                        const isAdded = displayAttributes.some(a => a.key === attr.key);
                                        const isSelected = selectedKeys.has(attr.key);
                                        const definition = definitions?.[attr.key];
                                        return (
                                            <label key={attr.key} className={styles.attributeSelectorItem}>
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={(e) => handleCheckboxChange(attr.key, e.target.checked)}
                                                    disabled={isAdded}
                                                />
                                                <div className={styles.attributeSelectorItemContent}>
                                                    <span className={styles.attributeSelectorItemName}>
                                                        {attr.displayName}
                                                        {isAdded && <span className={styles.attributeSelectorItemBadge}>已添加</span>}
                                                    </span>
                                                    {definition && (
                                                        <span className={styles.attributeSelectorItemMeta}>
                                                            默认: {definition.defaultValue}{definition.unit}
                                                            {definition.formula && (
                                                                <span className={styles.attributeSelectorItemFormula}>
                                                                    {definition.formula}
                                                                </span>
                                                            )}
                                                        </span>
                                                    )}
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>
                                <div className={styles.attributeSelectorFooter}>
                                    <button
                                        className={styles.ghostSmall}
                                        onClick={handleCancelAdd}
                                        type="button"
                                    >
                                        取消
                                    </button>
                                    <button
                                        className={styles.primaryButton}
                                        onClick={handleConfirmAdd}
                                        disabled={selectedKeys.size === 0}
                                        type="button"
                                    >
                                        添加 {selectedKeys.size > 0 && `(${selectedKeys.size})`}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* 属性列表 */}
                        {displayAttributes.length === 0 && !showSelector ? (
                            <p className={styles.mutedSmall}>
                                暂无属性。{availableAttributes.length > 0 ? '点击上方按钮添加属性。' : '请先在属性设置面板中定义属性。'}
                            </p>
                        ) : (
                            !showSelector && displayAttributes.map((attr) => {
                                const isModified = attr.isModified || attr.isNew;
                                return (
                                    <div key={attr.key} className={`${styles.attributeRow} ${isModified ? styles.attributeRowModified : ''}`}>
                                        <div className={styles.attributeRowHeader}>
                                            <span>
                                                {attr.displayName}
                                                {attr.isNew && <span className={styles.newBadge}>新</span>}
                                                {attr.isModified && !attr.isNew && <span className={styles.modifiedBadge}>已修改</span>}
                                            </span>
                                            <button
                                                className={styles.ghostTiny}
                                                onClick={() => handleDeleteClick(attr.key)}
                                                type="button"
                                            >
                                                删除
                                            </button>
                                        </div>
                                        <div className={styles.attributeRowFields}>
                                            <div className={styles.attributeRowField}>
                                                <label>
                                                    <span>属性值</span>
                                                    <div className={styles.attributeRowFieldInput}>
                                                        <input
                                                            type="number"
                                                            value={attr.value}
                                                            onChange={(e) => {
                                                                const newValue = Number(e.target.value);
                                                                if (!isNaN(newValue)) {
                                                                    handleValueChange(attr.key, newValue);
                                                                }
                                                            }}
                                                            min={0}
                                                            max={attr.maxValue}
                                                        />
                                                        <span className={styles.attributeRowUnit}>
                                                            / {attr.maxValue} {attr.unit}
                                                        </span>
                                                    </div>
                                                </label>
                                            </div>
                                            <div className={styles.attributeRowField}>
                                                <label>
                                                    <span>计算公式</span>
                                                    <input
                                                        type="text"
                                                        value={attr.formula}
                                                        onChange={(e) => handleFormulaChange(attr.key, e.target.value)}
                                                        placeholder="输入公式..."
                                                    />
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
            </div>

            {/* 删除确认弹窗 */}
            <ConfirmModal
                isOpen={deleteModalOpen}
                onConfirm={handleConfirmDelete}
                onCancel={handleCancelDelete}
                title="删除属性"
                message={`确定要删除属性「${displayAttributes.find(a => a.key === attributeToDelete)?.displayName}」吗？删除后不可恢复。`}
                confirmButtonText="确认删除"
                cancelButtonText="取消"
            />
        </>
    );
};

export default CharacterAttributesPanel;