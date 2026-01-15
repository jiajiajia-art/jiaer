import React, { useState, useEffect, useRef, useCallback } from 'react';
import styles from './ObjectsPanel.module.css';
import ObjectsList from './ObjectsList';
import ObjectDetail from './ObjectDetail';
import ConfirmModal from '../../GoodsModal/ConfirmModal';
import SaveConfirmModal from '../../GoodsModal/SaveConfirmModal';
import { toast } from 'react-hot-toast';
import type { ObjectItem } from '../../../api/worldInteraction/objectsData.type';
import { objectsData } from '../../../api/worldInteraction/objectsData';

interface ObjectsPanelProps {
    fileId?: string | null;
    mode?: string;
    onDataChange?: () => void;
    objects?: ObjectItem[];
    onBeforePanelChange?: () => Promise<boolean>;
}

export interface ObjectsPanelRef {
    checkBeforeLeave: () => Promise<boolean> | boolean;
}

const ObjectsPanel = React.forwardRef<ObjectsPanelRef, ObjectsPanelProps>(({
    fileId,
    onDataChange,
    objects: initialObjects = [],
    onBeforePanelChange,
}, ref) => {
    const [objects, setObjects] = useState<ObjectItem[]>(initialObjects);
    const [activeObjectId, setActiveObjectId] = useState<string | null>(null);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [objectToDelete, setObjectToDelete] = useState<string | null>(null);
    const [isNewObject, setIsNewObject] = useState(false);
    const [creatingObject, setCreatingObject] = useState<ObjectItem | null>(null);
    
    // 未保存修改相关状态
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [saveConfirmModalOpen, setSaveConfirmModalOpen] = useState(false);
    const [pendingAction, setPendingAction] = useState<{
        type: 'switchObject' | 'switchPanel' | 'close';
        targetObjectId?: string | null;
        targetPanelId?: string;
    } | null>(null);
    const [isBlockingSwitch, setIsBlockingSwitch] = useState(false);
    const detailRef = useRef<{ save: () => Promise<void>; checkOnlyImageChanged: () => boolean } | null>(null);
    
    // 一键生成相关状态
    const [isGeneratingAll, setIsGeneratingAll] = useState(false);
    const [generateAllModalOpen, setGenerateAllModalOpen] = useState(false);
    const [requiredPoints, setRequiredPoints] = useState(0);

    // 使用 ref 来存储最新的状态值，避免闭包问题
    const hasUnsavedChangesRef = useRef(hasUnsavedChanges);
    const isBlockingSwitchRef = useRef(isBlockingSwitch);
    
    useEffect(() => {
        hasUnsavedChangesRef.current = hasUnsavedChanges;
    }, [hasUnsavedChanges]);
    
    useEffect(() => {
        isBlockingSwitchRef.current = isBlockingSwitch;
    }, [isBlockingSwitch]);

    const getObjects = async () => {
        if (!fileId) return;
        try{
        const resp = await objectsData.getAllObjects(fileId);
            if (resp.data?.success === false) {
                console.error('获取物品失败:', resp.data);
                return;
            }
            setObjects(resp.data.items);
        } catch (error: any) {
            console.error('获取物品失败:', error);
        }
    }

    useEffect(() => {
        getObjects();
    }, [fileId]);

    // 初始化时，如果有物品，默认选中第一个
    useEffect(() => {
        if (objects.length > 0 && !activeObjectId && !isNewObject) {
            setActiveObjectId(objects[0].item_id);
        } else if (objects.length === 0) {
            setActiveObjectId(null);
        }
    }, [objects, activeObjectId, isNewObject]);

    // 执行待处理的操作
    const executePendingAction = useCallback(() => {
        if (!pendingAction) return;

        if (pendingAction.type === 'switchObject') {
            setActiveObjectId(pendingAction.targetObjectId || null);
            setIsNewObject(false);
            setCreatingObject(null);
        } else if (pendingAction.type === 'switchPanel') {
            if (onBeforePanelChange) {
                onBeforePanelChange().then((canSwitch) => {
                    if (canSwitch && pendingAction.targetPanelId) {
                        setPendingAction(null);
                    }
                });
            }
        } else if (pendingAction.type === 'close') {
            setPendingAction(null);
        }

        setPendingAction(null);
    }, [pendingAction, onBeforePanelChange]);

    // 检查是否可以切换（如果有未保存修改，显示确认弹窗）
    const checkBeforeSwitch = useCallback(async (action: { type: 'switchObject' | 'switchPanel' | 'close'; targetObjectId?: string | null; targetPanelId?: string }) => {
        if (hasUnsavedChanges) {
            // 检查是否只修改了图片，如果是则自动保存
            if (detailRef.current?.checkOnlyImageChanged && detailRef.current.checkOnlyImageChanged()) {
                try {
                    if (detailRef.current?.save) {
                        await detailRef.current.save();
                        // 保存成功，等待状态更新（onSave 回调会更新本地数据）
                        // 使用 setTimeout 确保状态更新完成
                        await new Promise(resolve => setTimeout(resolve, 100));
                        // 保存成功后直接执行切换操作
                        if (action.type === 'switchObject') {
                            setActiveObjectId(action.targetObjectId || null);
                            setIsNewObject(false);
                            setCreatingObject(null);
                        } else if (action.type === 'switchPanel') {
                            if (onBeforePanelChange) {
                                await onBeforePanelChange();
                            }
                        }
                        return true;
                    }
                } catch (error) {
                    // 自动保存失败，显示确认弹窗
                    console.error('自动保存图片失败:', error);
                    toast.error('自动保存失败，请手动保存');
                }
            }
            
            // 不是只修改图片，或者自动保存失败，显示确认弹窗
            setPendingAction(action);
            setSaveConfirmModalOpen(true);
            setIsBlockingSwitch(true);
            return false;
        }
        return true;
    }, [hasUnsavedChanges, onBeforePanelChange]);

    // 暴露给父组件的方法，用于在切换面板前检查
    React.useImperativeHandle(ref, () => ({
        checkBeforeLeave: async () => {
            const hasChanges = hasUnsavedChangesRef.current;
            const isBlocking = isBlockingSwitchRef.current;
            
            if (hasChanges && !isBlocking) {
                // 检查是否只修改了图片，如果是则自动保存
                if (detailRef.current?.checkOnlyImageChanged && detailRef.current.checkOnlyImageChanged()) {
                    try {
                        if (detailRef.current?.save) {
                            await detailRef.current.save();
                            // 保存成功，等待状态更新（onSave 回调会更新本地数据）
                            await new Promise(resolve => setTimeout(resolve, 100));
                            // 自动保存成功，允许切换
                            return true;
                        }
                    } catch (error) {
                        // 自动保存失败，显示确认弹窗
                        console.error('自动保存图片失败:', error);
                        toast.error('自动保存失败，请手动保存');
                    }
                }
                
                // 不是只修改图片，或者自动保存失败，显示确认弹窗
                setPendingAction({ type: 'switchPanel' });
                setSaveConfirmModalOpen(true);
                setIsBlockingSwitch(true);
                return false;
            }
            
            if (isBlocking) {
                return false;
            }
            
            return true;
        },
    }), []);

    // 创建新的物品
    const handleCreateObject = async () => {
        const canSwitch = await checkBeforeSwitch({ type: 'switchObject', targetObjectId: null });
        if (!canSwitch) {
            return;
        }
        // 创建新物品（如果自动保存成功，checkBeforeSwitch 已经处理了切换，这里仍然需要创建新物品）
        const newObject: ObjectItem = {
            item_id: `item-${Date.now()}`,
            name: '新建物品',
            icon: '',
            category: 'consumable',
            stackable: false,
            description: '',
            functionalDescription: '',
            acquisition: {
                source: 'ability_node',
                condition: '',
            },

            otherNotes: '',
        };
        setCreatingObject(newObject);
        setActiveObjectId(null);
        setIsNewObject(true);
    };

    // 删除物品
    const handleDeleteClick = (objectId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setObjectToDelete(objectId);
        setDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!objectToDelete) return;
        if (!fileId) {
            return;
        }

        try {
            const resp = await objectsData.deleteObject(fileId, objectToDelete);
            if (resp.data?.success === false) {
                toast.error(resp.data.message || '删除失败，请稍后重试');
                return;
            }

            setObjects(prev => prev.filter(obj => obj.item_id !== objectToDelete));
            if (activeObjectId === objectToDelete) {
                const remainingObjects = objects.filter(obj => obj.item_id !== objectToDelete);
                setActiveObjectId(remainingObjects.length > 0 ? remainingObjects[0].item_id : null);
            }
            toast.success('删除成功');
            setDeleteModalOpen(false);
            setObjectToDelete(null);

        } catch (error: any) {
            console.error('删除物品失败:', error);
            toast.error('删除失败，请检查网络连接');
        }
    };

    const handleCancelDelete = () => {
        setDeleteModalOpen(false);
        setObjectToDelete(null);
    };

    // 一键生成所有图片
    const handleGenerateAllClick = async () => {
        if (!fileId) {
            toast.error('缺少必要数据');
            return;
        }

        try {
            const response = await objectsData.calculateObjectPoints(fileId);
            if (response.data?.success) {
                setRequiredPoints(response.data.points || 0);
                setGenerateAllModalOpen(true);
            } else {
                toast.error('计算积分失败');
            }
        } catch (error: any) {
            console.error('计算积分失败:', error);
            toast.error('计算积分失败：' + (error.message || '请检查网络连接'));
        }
    };

    const handleConfirmGenerateAll = async () => {
        if (!fileId) {
            toast.error('缺少必要数据');
            return;
        }

        setIsGeneratingAll(true);
        setGenerateAllModalOpen(false);

        try {
            const response = await objectsData.generateAllObjectImages(fileId);
            if (response.data?.success) {
                toast.success('所有物品图片生成成功');
                await getObjects(); // 刷新物品列表
            } else {
                toast.error('生成失败：' + (response.data?.message || '未知错误'));
            }
        } catch (error: any) {
            console.error('生成所有图片失败:', error);
            toast.error('生成失败：' + (error.message || '请检查网络连接'));
        } finally {
            setIsGeneratingAll(false);
        }
    };

    const handleCancelGenerateAll = () => {
        setGenerateAllModalOpen(false);
    };

    const activeObject = objects.find(obj => obj.item_id === activeObjectId);
    const displayObject = creatingObject || activeObject || null;

    const handleSave = async (updatedObject: ObjectItem) => {
        if (!fileId) {
            return;
        }
        try {
            // ObjectDetail 已经规范化了对象数据（icon 是字符串格式）
            // 这里只需要创建新对象引用，确保 React 检测到变化并重新渲染
            const normalizedObject: ObjectItem = { ...updatedObject };

            if (isNewObject) {
                setObjects(prev => {
                    const exists = prev.some(obj => obj.item_id === normalizedObject.item_id);
                    if (exists) {
                        // 如果已存在，更新它（创建新数组和新对象引用）
                        return prev.map(obj => 
                            obj.item_id === normalizedObject.item_id 
                                ? normalizedObject 
                                : obj
                        );
                    } else {
                        // 添加新物品（创建新数组）
                        return [...prev, normalizedObject];
                    }
                });
                setActiveObjectId(normalizedObject.item_id);
                setCreatingObject(null);
                setIsNewObject(false);
            } else {
                // 更新现有物品（创建新数组和新对象引用，确保 React 检测到变化）
                setObjects(prev =>
                    prev.map(obj => 
                        obj.item_id === normalizedObject.item_id 
                            ? normalizedObject 
                            : obj
                    )
                );
            }

            // 触发数据刷新回调
            if (onDataChange) {
                onDataChange();
            }
        } catch (error: any) {
            console.error('更新物品状态失败:', error);
            toast.error('更新失败，请检查网络连接');
        }
    };

    return (
        <div className={styles.panelContent}>
            <div className={styles.panelHeader}>
                <div>
                    <p className={styles.eyebrow}>Step 8</p>
                    <h2>物品编辑</h2>
                    <p className={styles.subtitle}>
                        管理游戏中所有物品：创建、编辑和配置物品属性
                    </p>
                </div>
                <button
                    className={`${styles.ghost} ${styles.generateButton}`}
                    onClick={handleGenerateAllClick}
                    disabled={isGeneratingAll || objects.length === 0}
                >
                    <img
                        src={`${import.meta.env.BASE_URL}data/assets/金币1.png`}
                        alt=""
                        className={styles.priceIcon}
                    />
                    <div className={styles.buttonTextContainer}>
                        <span className={styles.buttonMainText}>
                            {isGeneratingAll ? '生成中...' : '一键生成所有物品图片'}
                        </span>
                        <span className={styles.buttonSubText}>10积分/张</span>
                    </div>
                </button>
            </div>

            <div className={styles.objectsLayout}>
                {/* 左侧：物品列表 */}
                <ObjectsList
                    objects={objects}
                    activeObjectId={activeObjectId}
                    onObjectClick={async (id) => {
                        const canSwitch = await checkBeforeSwitch({ type: 'switchObject', targetObjectId: id });
                        if (!canSwitch) {
                            return;
                        }
                        // 切换物品（如果自动保存成功，checkBeforeSwitch 已经处理了切换，这里仍然需要更新状态）
                        setActiveObjectId(id);
                        setIsNewObject(false);
                        setCreatingObject(null);
                    }}
                    onDeleteClick={handleDeleteClick}
                    onCreateClick={handleCreateObject}
                />

                {/* 右侧：详情菜单 */}
                <ObjectDetail
                    ref={detailRef}
                    object={displayObject}
                    onSave={handleSave}
                    fileId={fileId}
                    isNewObject={isNewObject}
                    onHasUnsavedChanges={setHasUnsavedChanges}
                />
            </div>

            <ConfirmModal
                isOpen={deleteModalOpen}
                onConfirm={handleConfirmDelete}
                onCancel={handleCancelDelete}
                title="删除物品"
                message={objectToDelete ? `确定要删除物品 "${objects.find(o => o.item_id === objectToDelete)?.name || '未命名物品'}" 吗？删除后不可恢复。` : '确定要删除此物品吗？删除后不可恢复。'}
                confirmButtonText="确认删除"
                cancelButtonText="取消"
            />

            {/* 保存确认弹窗 */}
            <SaveConfirmModal
                isOpen={saveConfirmModalOpen}
                onSave={async () => {
                    if (detailRef.current?.save) {
                        try {
                            await detailRef.current.save();
                            setSaveConfirmModalOpen(false);
                            setIsBlockingSwitch(false);
                            executePendingAction();
                        } catch (error) {
                            toast.error('保存失败，请重试');
                        }
                    } else {
                        setSaveConfirmModalOpen(false);
                        setIsBlockingSwitch(false);
                        executePendingAction();
                    }
                }}
                onDiscard={() => {
                    setSaveConfirmModalOpen(false);
                    setHasUnsavedChanges(false);
                    setIsBlockingSwitch(false);
                    executePendingAction();
                }}
                onCancel={() => {
                    setSaveConfirmModalOpen(false);
                    setPendingAction(null);
                    setIsBlockingSwitch(false);
                }}
                title="未保存的修改"
                message="您有未保存的修改，是否要保存？"
                saveButtonText="保存"
                discardButtonText="不保存"
            />

            {/* 一键生成所有图片确认弹窗 */}
            <ConfirmModal
                isOpen={generateAllModalOpen}
                onConfirm={handleConfirmGenerateAll}
                onCancel={handleCancelGenerateAll}
                title="一键生成所有物品图片"
                message={`本次将为所有物品生成图片，共需扣除 ${requiredPoints} 积分，是否继续？`}
                confirmButtonText="确认生成"
                cancelButtonText="取消"
            />

            {/* 一键生成全部图片加载遮罩 */}
            {isGeneratingAll && (
                <div className={styles.plusLoadingOverlay}>
                    <div className={styles.plusLoadingSpinner}></div>
                    <div className={styles.plusLoadingText}>正在生成物品图片...</div>
                </div>
            )}
        </div>
    );
});

ObjectsPanel.displayName = 'ObjectsPanel';

export default ObjectsPanel;

