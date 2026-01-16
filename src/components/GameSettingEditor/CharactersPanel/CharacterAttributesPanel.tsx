import { useState, useMemo, useEffect, useImperativeHandle, forwardRef } from 'react';
import styles from './CharacterAttributesPanel.module.css';
import type { AttributeSetting } from '../../../api/worldInteraction/worldInteractionApi.type';
import { getCharacterAttributes, getAvailableAttributes } from './characterAttributeUtils';
import worldEditor from '../../../api/worldInteraction/worldEditor';
import ConfirmModal from '../../GoodsModal/ConfirmModal';
import { toast } from 'react-hot-toast';
import { MdArrowDropDown } from 'react-icons/md';

interface CharacterAttributesPanelProps {
    attributeSetting?: AttributeSetting;
    // NPC 属性：来自 npcSetting.npcs[].attributes
    npcAttributes?: Record<string, { displayName: string; value: number; formula: string }>;
    characterId: string;
    isPlayer: boolean;
    fileId: string;
    onHasUnsavedChanges?: (hasChanges: boolean) => void;
}

export interface CharacterAttributesPanelRef {
    saveAttributes: () => Promise<boolean>;
    hasChanges: boolean;
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
    isDeleted: boolean; // 标记是否被软删除
}

const CharacterAttributesPanel = forwardRef<CharacterAttributesPanelRef, CharacterAttributesPanelProps>(({
    attributeSetting,
    npcAttributes,
    characterId,
    isPlayer,
    fileId,
    onHasUnsavedChanges,
}, ref) => {
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
        return getCharacterAttributes(attributeSetting, characterId, isPlayer, npcAttributes);
    }, [attributeSetting, characterId, isPlayer, npcAttributes]);

    // 获取可添加的属性
    const baseAvailableAttributes = useMemo(() => {
        if (!attributeSetting) return [];
        return getAvailableAttributes(attributeSetting, characterId, isPlayer, npcAttributes);
    }, [attributeSetting, characterId, isPlayer, npcAttributes]);

    // 实际可添加的属性：基础列表 + 被软删除的属性（可以重新添加）
    const availableAttributes = useMemo(() => {
        const available = [...baseAvailableAttributes];
        
        // 将被软删除的属性也加入可添加列表
        if (attributeSetting) {
            const definitions = isPlayer
                ? attributeSetting.attributeDefinitions.player
                : attributeSetting.attributeDefinitions.npc;
            
            if (definitions) {
                localAttributes.forEach((attr, key) => {
                    if (attr.isDeleted && definitions[key]) {
                        // 检查是否已经在 available 中，避免重复
                        if (!available.some(a => a.key === key)) {
                            available.push({
                                key,
                                displayName: definitions[key].displayName,
                            });
                        }
                    }
                });
            }
        }
        
        return available;
    }, [baseAvailableAttributes, localAttributes, attributeSetting, isPlayer]);

    // 合并后端数据和本地修改
    const displayAttributes = useMemo(() => {
        const map = new Map<string, LocalAttributeItem>();
        
        // 先添加后端数据
        currentAttributes.forEach(attr => {
            const local = localAttributes.get(attr.key);
            // 已被标记删除的属性，不再展示（软删除）
            if (local?.isDeleted) {
                return;
            }
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
                isDeleted: false,
            });
        });

        // 再添加本地新添加的（但后端还没有的）
        localAttributes.forEach((attr, key) => {
            if (!map.has(key) && attr.isNew && !attr.isDeleted) {
                map.set(key, attr);
            }
        });

        return Array.from(map.values());
    }, [currentAttributes, localAttributes]);

    // 检查是否有未保存的更改（包括修改、新增、删除）
    useEffect(() => {
        const hasUnsavedChanges = Array.from(localAttributes.values()).some(
            attr => attr.isModified || attr.isNew || attr.isDeleted
        );
        setHasChanges(hasUnsavedChanges);
        if (onHasUnsavedChanges) {
            onHasUnsavedChanges(hasUnsavedChanges);
        }
    }, [localAttributes, onHasUnsavedChanges]);

    // 当属性设置变化时，同步本地状态
    // 只在后端数据真正变化时清除已保存的修改，保留未保存的新增和修改
    useEffect(() => {
        setLocalAttributes(prev => {
            const newMap = new Map();
            const currentKeys = new Set(currentAttributes.map(attr => attr.key));
            
            prev.forEach((attr, key) => {
                // 保留新添加但后端还没有的
                if (attr.isNew && !currentKeys.has(key)) {
                    newMap.set(key, attr);
                }
                // 如果后端已经有了这个属性，但本地有未保存的修改，保留修改
                else if (!attr.isNew && attr.isModified && currentKeys.has(key)) {
                    // 保留修改状态
                    newMap.set(key, attr);
                }
            });
            return newMap;
        });
    }, [currentAttributes]);

    // 切换角色时，清空本地修改，避免串号
    useEffect(() => {
        setLocalAttributes(new Map());
    }, [characterId]);

    const handleAddClick = () => {
        const currentKeys = new Set(displayAttributes.map(attr => attr.key));
        const initialSelection = new Set(
            availableAttributes
                .filter(attr => !currentKeys.has(attr.key))
                .map(attr => attr.key)
        );
        setSelectedKeys(initialSelection);
        setShowSelector(true);
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

    const handleConfirmAdd = async () => {
        if (selectedKeys.size === 0) {
            setShowSelector(false);
            return;
        }

        const selectedKeysArray = Array.from(selectedKeys);

        // 获取属性定义
        const definitions = isPlayer
            ? attributeSetting?.attributeDefinitions.player
            : attributeSetting?.attributeDefinitions.npc;

        if (!definitions) {
            toast.error('无法获取属性定义');
            return;
        }

        // 验证所有选中的属性都有定义
        const invalidKeys = selectedKeysArray.filter(key => !definitions[key]);
        if (invalidKeys.length > 0) {
            toast.error(`以下属性定义不存在: ${invalidKeys.join(', ')}`);
            return;
        }

        try {
            // 批量调用API添加属性（传递数组，player 和 npc 使用同一个接口）
            const requestData = {
                fileId,
                id: characterId,
                attributeNames: selectedKeysArray,
            };

            const response = await worldEditor.addNpcAttributeDefinitions(requestData);
            
            // 根据返回的 result 数组更新本地状态
            const resultArray = response.data?.data?.result;
            
            setLocalAttributes(prev => {
                const newMap = new Map(prev);
                
                selectedKeysArray.forEach(key => {
                    const definition = definitions[key];
                    if (!definition) return;
                    
                    // 从返回结果中查找对应的 state，如果没有则使用默认值
                    const resultItem = resultArray?.find(r => r.attributeName === key);
                    const value = resultItem?.state.value ?? definition.defaultValue;
                    const formula = resultItem?.state.formula ?? definition.formula ?? '';
                    
                    // 如果本地已有记录，更新它（可能是重新添加被删除的属性）
                    const existing = newMap.get(key);
                    if (existing) {
                        newMap.set(key, {
                            ...existing,
                            value,
                            formula,
                            isDeleted: false,
                            isModified: false,
                            isNew: false,
                        });
                    } else {
                        // 新建记录
                        newMap.set(key, {
                            key,
                            displayName: definition.displayName,
                            value,
                            defaultValue: definition.defaultValue,
                            maxValue: definition.maxValue,
                            unit: definition.unit,
                            formula,
                            isModified: false,
                            isNew: false,
                            isDeleted: false,
                        });
                    }
                });
                
                return newMap;
            });

            toast.success(`成功添加 ${selectedKeysArray.length} 个属性`);
            
            // 清空选择并关闭选择器
            setSelectedKeys(new Set());
            setShowSelector(false);
        } catch (error) {
            console.error('[CharacterAttributesPanel] 添加属性时发生错误:', error);
            toast.error('添加属性失败，请查看控制台日志');
            // 即使失败也关闭选择器
            setSelectedKeys(new Set());
            setShowSelector(false);
        }
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
            const requestData = {
                fileId,
                id: characterId,
                attributeName: attributeToDelete,
            };

            const response = await worldEditor.deleteNpcAttributeDefinitions(requestData);
            
            console.log('[CharacterAttributesPanel] 属性删除成功:', {
                attributeName: attributeToDelete,
                response,
            });

            toast.success('属性删除成功');
            // 软删除：标记为已删除，不触发整体数据刷新
            setLocalAttributes(prev => {
                const newMap = new Map(prev);
                const existing = newMap.get(attributeToDelete);
                if (existing) {
                    newMap.set(attributeToDelete, {
                        ...existing,
                        isDeleted: true,
                    });
                } else {
                    // 如果本地没有记录，从后端数据创建一个标记为删除的记录
                    const backendAttr = currentAttributes.find(a => a.key === attributeToDelete);
                    if (backendAttr) {
                        newMap.set(attributeToDelete, {
                            key: attributeToDelete,
                            displayName: backendAttr.displayName,
                            value: backendAttr.value,
                            defaultValue: backendAttr.defaultValue,
                            maxValue: backendAttr.maxValue,
                            unit: backendAttr.unit,
                            formula: backendAttr.formula || '',
                            isModified: false,
                            isNew: false,
                            isDeleted: true,
                        });
                    }
                }
                return newMap;
            });
            setDeleteModalOpen(false);
            setAttributeToDelete(null);
        } catch (error) {
            toast.error('删除属性失败，请查看控制台日志');
            setDeleteModalOpen(false);
            setAttributeToDelete(null);
        }
    };

    const handleCancelDelete = () => {
        setDeleteModalOpen(false);
        setAttributeToDelete(null);
    };

    // 批量更新属性（供外部调用，集成到主保存按钮）
    const saveAttributes = async (): Promise<boolean> => {
        if (!hasChanges) {
            return true;
        }

        try {
            const updateAttributes: Record<string, { value: number; formula: string }> = {};

            localAttributes.forEach((attr, key) => {
                // 只处理已存在属性的修改；新增属性在 handleConfirmAdd 中已经立即写入后端
                if (!attr.isNew && !attr.isDeleted && attr.isModified) {
                    updateAttributes[key] = {
                        value: attr.value,
                        formula: attr.formula,
                    };
                }
            });

            // 批量更新属性（player 和 npc 使用同一个接口）
            if (Object.keys(updateAttributes).length > 0) {
                const updateRequestData = {
                    id: characterId,
                    update: updateAttributes,
                };
                await worldEditor.updateNpcAttributeDefinitions(fileId, updateRequestData);
            }

            // 软更新：本地标记为已保存，保留最新值，去掉"已修改"高亮
            setLocalAttributes(prev => {
                const newMap = new Map(prev);
                Object.keys(updateAttributes).forEach(key => {
                    const existing = newMap.get(key);
                    if (existing) {
                        newMap.set(key, {
                            ...existing,
                            isModified: false,
                            value: updateAttributes[key].value,
                            formula: updateAttributes[key].formula,
                            isDeleted: false,
                        });
                    }
                });
                return newMap;
            });
            return true;
        } catch (error) {
            console.error('[CharacterAttributesPanel] 批量更新失败:', error);
            return false;
        }
    };

    // 暴露方法给父组件
    useImperativeHandle(ref, () => ({
        saveAttributes,
        hasChanges,
    }), [hasChanges, characterId, fileId, localAttributes]);

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
                        {isExpanded && !showSelector && (
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
                        <MdArrowDropDown size={30} style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                    </div>
                </div>
                {isExpanded && (
                    <div className={styles.attributeList}>
                        {/* 属性选择器 */}
                        {showSelector && (
                            <div className={styles.attributeSelector}>
                                <div className={styles.attributeSelectorHeader}>
                                    <div className={styles.attributeSelectorTitle}>
                                        <span>选择要添加的属性</span>
                                        {selectedKeys.size > 0 && (
                                            <span className={styles.attributeSelectorCount}>
                                                已选择 {selectedKeys.size} 项
                                            </span>
                                        )}
                                    </div>
                                    <div className={styles.attributeSelectorActions}>
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
                                            disabled={selectedKeys.size === 0}
                                        >
                                            清空
                                        </button>
                                    </div>
                                </div>
                                <div className={styles.attributeSelectorList}>
                                    {availableAttributes.length === 0 ? (
                                        <div className={styles.attributeSelectorEmpty}>
                                            <p>没有可添加的属性</p>
                                            <p className={styles.attributeSelectorEmptyHint}>
                                                请先在属性设置面板中定义属性
                                            </p>
                                        </div>
                                    ) : (
                                        availableAttributes.map((attr) => {
                                            const isAdded = displayAttributes.some(a => a.key === attr.key);
                                            const isSelected = selectedKeys.has(attr.key);
                                            const definition = definitions?.[attr.key];
                                            return (
                                                <label 
                                                    key={attr.key} 
                                                    className={`${styles.attributeSelectorItem} ${isSelected ? styles.attributeSelectorItemSelected : ''} ${isAdded ? styles.attributeSelectorItemDisabled : ''}`}
                                                >
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
                                                                <span>默认值: {definition.defaultValue}{definition.unit}</span>
                                                                {definition.formula && (
                                                                    <span className={styles.attributeSelectorItemFormula}>
                                                                        公式: {definition.formula}
                                                                    </span>
                                                                )}
                                                            </span>
                                                        )}
                                                    </div>
                                                </label>
                                            );
                                        })
                                    )}
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
                                        添加到列表 {selectedKeys.size > 0 && `(${selectedKeys.size})`}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* 属性列表 */}
                        {displayAttributes.length === 0 ? (
                            <p className={styles.mutedSmall}>
                                暂无属性。{availableAttributes.length > 0 ? '点击上方按钮添加属性。' : '请先在属性设置面板中定义属性。'}
                            </p>
                        ) : (
                            displayAttributes.map((attr) => {
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
});

CharacterAttributesPanel.displayName = 'CharacterAttributesPanel';

export default CharacterAttributesPanel;