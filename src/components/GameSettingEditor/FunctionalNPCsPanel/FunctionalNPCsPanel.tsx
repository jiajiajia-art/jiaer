import React, { useState, useEffect, useRef, useCallback, useImperativeHandle } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './FunctionalNPCsPanel.module.css';
import FunctionalNPCList from './FunctionalNPCList';
import FunctionalNPCDetail from './FunctionalNPCDetail';
import ConfirmModal from '../../CommonModal/ConfirmModal';
import SaveConfirmModal from '../../CommonModal/SaveConfirmModal';
import { toast } from 'react-hot-toast';
import type { AbilityNodeSetting, AbilityNode } from '../../../api/worldInteraction/worldInteractionApi.type';
import worldEditor from '../../../api/worldInteraction/worldEditor';
import { CHARACTER_GENERATION_COST } from '../../../utils/constants';
import { useAuthStore } from '../../../store/useAuthStore';
import { auth } from '../../../api/account/authApi';

interface FunctionalNPCsPanelProps {
    fileId?: string | null;
    mode?: string;
    onDataChange?: () => void;
    abilityNodeSetting?: AbilityNodeSetting;
    onBeforePanelChange?: () => Promise<boolean>; // 返回 false 表示阻止切换
}

export interface FunctionalNPCsPanelRef {
    checkBeforeLeave: () => Promise<boolean> | boolean;
}

const FunctionalNPCsPanel = React.forwardRef<FunctionalNPCsPanelRef, FunctionalNPCsPanelProps>(({
    fileId,
    onDataChange,
    abilityNodeSetting,
    onBeforePanelChange,
}, ref) => {
    const { t } = useTranslation();
    const [abilityNodes, setAbilityNodes] = useState<AbilityNode[]>([]);
    const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [nodeToDelete, setNodeToDelete] = useState<string | null>(null);
    const [isNewNode, setIsNewNode] = useState(false);
    const [creatingNode, setCreatingNode] = useState<AbilityNode | null>(null);
    const [isGeneratingAllImages, setIsGeneratingAllImages] = useState(false);
    const [allImagesCostModalOpen, setAllImagesCostModalOpen] = useState(false);
    const [allImagesCostPoints, setAllImagesCostPoints] = useState<number | null>(null);
    const [isLoadingAllImagesCost, setIsLoadingAllImagesCost] = useState(false);
    const { user, updateUser } = useAuthStore();
    const userPoints = user?.user?.points ?? 0;
    
    // 未保存修改相关状态
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [saveConfirmModalOpen, setSaveConfirmModalOpen] = useState(false);
    const [pendingAction, setPendingAction] = useState<{
        type: 'switchNode' | 'switchPanel' | 'close';
        targetNodeId?: string | null;
        targetPanelId?: string;
    } | null>(null);
    const [isBlockingSwitch, setIsBlockingSwitch] = useState(false);
    const detailRef = useRef<{ save: () => Promise<void>; checkOnlyImageChanged: () => boolean } | null>(null);

    const refreshUserPoints = async () => {
        if (!updateUser) return;
        try {
            const resp = await auth.getUserInfo();
            const latestUser = resp.data?.data;
            if (latestUser && typeof latestUser.points === 'number') {
                updateUser({ points: latestUser.points });
            }
        } catch (error) {
            console.error('刷新用户积分失败:', error);
        }
    };

    // 直接使用后端数据格式
    useEffect(() => {
        if (abilityNodeSetting?.abilityNodes) {
            setAbilityNodes(abilityNodeSetting.abilityNodes);
            // 如果有节点，默认选中第一个（只在初始化时）
            if (abilityNodeSetting.abilityNodes.length > 0 && !activeNodeId && !isNewNode) {
                setActiveNodeId(abilityNodeSetting.abilityNodes[0].node_id);
            }
        } else {
            // 如果没有数据，清空列表
            setAbilityNodes([]);
            setActiveNodeId(null);
        }
    }, [abilityNodeSetting]);

    // 使用 ref 来存储最新的状态值，避免闭包问题
    const hasUnsavedChangesRef = useRef(hasUnsavedChanges);
    const isBlockingSwitchRef = useRef(isBlockingSwitch);
    
    useEffect(() => {
        hasUnsavedChangesRef.current = hasUnsavedChanges;
    }, [hasUnsavedChanges]);
    
    useEffect(() => {
        isBlockingSwitchRef.current = isBlockingSwitch;
    }, [isBlockingSwitch]);
    
    // 执行待处理的操作
    const executePendingAction = useCallback(() => {
        if (!pendingAction) return;

        if (pendingAction.type === 'switchNode') {
            setActiveNodeId(pendingAction.targetNodeId || null);
            setIsNewNode(false);
            setCreatingNode(null);
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
    const checkBeforeSwitch = useCallback(async (action: { type: 'switchNode' | 'switchPanel' | 'close'; targetNodeId?: string | null; targetPanelId?: string }) => {
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
                        if (action.type === 'switchNode') {
                            setActiveNodeId(action.targetNodeId || null);
                            setIsNewNode(false);
                            setCreatingNode(null);
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
    useImperativeHandle(ref, () => ({
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

    // 创建新的功能性NPC
    const handleCreateNode = async () => {
        const canSwitch = await checkBeforeSwitch({ type: 'switchNode', targetNodeId: null });
        if (!canSwitch) {
            return;
        }
        // 创建新节点（如果自动保存成功，checkBeforeSwitch 已经处理了切换，这里仍然需要创建新节点）
        const newNode: AbilityNode = {
            node_id: `node-${Date.now()}`,
            authorNote: '', // NPC名称（所有类型都需要）
            type: 'illustration',
            imagePath: '',
            imagePrompt: '',
            actions: [{ id: `opt-${Date.now()}`, name: '', description: '' }],
            // name 字段只在按钮型时需要，立绘型不需要
        };
        setCreatingNode(newNode);
        setActiveNodeId(null);
        setIsNewNode(true);
    };

    // 删除功能性NPC
    const handleDeleteClick = (nodeId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setNodeToDelete(nodeId);
        setDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!nodeToDelete) return;
        if (!fileId) {
            return;
        }

        try {
            const resp = await worldEditor.deleteFunctionalNpc(fileId, nodeToDelete);
            if (resp.data?.success === false) {
                toast.error(resp.data.message || '删除失败，请稍后重试');
                return;
            }

            setAbilityNodes(prev => prev.filter(node => node.node_id !== nodeToDelete));
            if (activeNodeId === nodeToDelete) {
                const remainingNodes = abilityNodes.filter(node => node.node_id !== nodeToDelete);
                setActiveNodeId(remainingNodes.length > 0 ? remainingNodes[0].node_id : null);
            }
            toast.success('删除成功');
            setDeleteModalOpen(false);
            setNodeToDelete(null);
        } catch (error: any) {
            console.error('删除功能性NPC失败:', error);
            toast.error('删除失败，请检查网络连接');
        }
    };

    const handleCancelDelete = () => {
        setDeleteModalOpen(false);
        setNodeToDelete(null);
    };

    const activeNode = abilityNodes.find(node => node.node_id === activeNodeId);
    const displayNode = creatingNode || activeNode || null;

    const handleSave = async (updatedNode: AbilityNode) => {
        if (!fileId) {
            return;
        }
        try {
            // 子组件已经调用了 API，这里只更新本地状态
            if (isNewNode) {
                setAbilityNodes(prev => {
                    const exists = prev.some(node => node.node_id === updatedNode.node_id);
                    if (exists) {
                        return prev.map(node => (node.node_id === updatedNode.node_id ? updatedNode : node));
                    } else {
                        return [...prev, updatedNode];
                    }
                });
                setActiveNodeId(updatedNode.node_id);
                setCreatingNode(null);
                setIsNewNode(false);
                toast.success('已创建功能配置');
            } else {
                // 更新现有节点
                setAbilityNodes(prev =>
                    prev.map(node => (node.node_id === updatedNode.node_id ? updatedNode : node))
                );
                toast.success('已保存功能配置');
            }

            // 触发数据刷新回调
            if (onDataChange) {
                onDataChange();
            }
        } catch (error: any) {
            console.error('更新功能性NPC状态失败:', error);
            toast.error('更新失败，请检查网络连接');
        }
    };

    // 打开一键生成全部图片的积分确认弹窗
    const openAllImagesCostModal = async () => {
        if (!fileId) {
            toast.error('缺少必要数据，无法生成');
            return;
        }
        try {
            setIsLoadingAllImagesCost(true);
            const response = await worldEditor.calculateAbilityNodePoints(fileId);
            if (response.data?.success) {
                const points = response.data.points;
                setAllImagesCostPoints(points);
                setAllImagesCostModalOpen(true);
            } else {
                toast.error(response.data?.message || '获取积分消耗失败');
            }
        } catch (error: any) {
            console.error('获取功能性NPC生图积分消耗失败:', error);
            toast.error('获取积分消耗失败，请稍后重试');
        } finally {
            setIsLoadingAllImagesCost(false);
        }
    };

    // 确认生成所有图片
    const handleConfirmGenerateAllImages = async () => {
        if (!fileId) {
            toast.error('缺少必要数据，无法生成');
            setAllImagesCostModalOpen(false);
            return;
        }
        if (allImagesCostPoints != null && userPoints < allImagesCostPoints) {
            toast.error('积分不足');
            return;
        }
        setAllImagesCostModalOpen(false);
        setIsGeneratingAllImages(true);
        try {
            const response = await worldEditor.generateAllAbilityNodeImages(fileId);
            if (response.data.success) {
                toast.success('所有图片生成成功');
                await refreshUserPoints();
                if (onDataChange) {
                    onDataChange();
                }
            } else {
                toast.error(response.data?.message || '生成图片失败');
            }
        } catch (error: any) {
            console.error('生成所有图片失败:', error);
            toast.error('生成图片失败：' + (error.message || '请检查网络连接'));
        } finally {
            setIsGeneratingAllImages(false);
        }
    };

    return (
        <div className={styles.panelContent}>
            <div className={styles.panelHeader}>
                <div>
                    <p className={styles.eyebrow}>{t('gameEditor.step6')}</p>
                    <h2>剧情事件插件</h2>
                    <p className={styles.subtitle}>
                        功能性NPC管理：创建和管理场景中的功能性NPC
                    </p>
                </div>
                <button
                    className={`${styles.ghost} ${styles.generateButton}`}
                    onClick={openAllImagesCostModal}
                    disabled={isGeneratingAllImages || isLoadingAllImagesCost}
                >
                    <img
                        src={`${import.meta.env.BASE_URL}data/assets/金币1.png`}
                        alt=""
                        className={styles.priceIcon}
                    />
                    <div className={styles.buttonTextContainer}>
                        <span className={styles.buttonMainText}>
                            {isGeneratingAllImages ? '生成中...' : '一键生成所有功能性NPC图片'}
                        </span>
                        <span className={styles.buttonSubText}>{CHARACTER_GENERATION_COST}积分/张</span>
                    </div>
                </button>
            </div>

            <div className={styles.npcLayout}>
                {/* 左侧：功能性NPC列表 */}
                <FunctionalNPCList
                    abilityNodes={abilityNodes}
                    activeNodeId={activeNodeId}
                    onNodeClick={async (id) => {
                        const canSwitch = await checkBeforeSwitch({ type: 'switchNode', targetNodeId: id });
                        if (!canSwitch) {
                            return;
                        }
                        // 切换节点（如果自动保存成功，checkBeforeSwitch 已经处理了切换，这里仍然需要更新状态）
                        setActiveNodeId(id);
                        setIsNewNode(false);
                        setCreatingNode(null);
                    }}
                    onDeleteClick={handleDeleteClick}
                    onCreateClick={handleCreateNode}
                />

                {/* 右侧：详情菜单 */}
                <FunctionalNPCDetail
                    ref={detailRef}
                    node={displayNode}
                    onSave={handleSave}
                    fileId={fileId}
                    isNewNode={isNewNode}
                    onHasUnsavedChanges={setHasUnsavedChanges}
                />
            </div>

            <ConfirmModal
                isOpen={deleteModalOpen}
                onConfirm={handleConfirmDelete}
                onCancel={handleCancelDelete}
                title="删除功能性NPC"
                message={nodeToDelete ? `确定要删除功能性NPC "${abilityNodes.find(n => n.node_id === nodeToDelete)?.authorNote || '未命名NPC'}" 吗？删除后不可恢复。` : '确定要删除此功能性NPC吗？删除后不可恢复。'}
                confirmButtonText="确认删除"
                cancelButtonText="取消"
            />

            {/* 一键生成所有图片积分提示 */}
            <ConfirmModal
                isOpen={allImagesCostModalOpen}
                onConfirm={handleConfirmGenerateAllImages}
                onCancel={() => setAllImagesCostModalOpen(false)}
                title="积分扣除确认"
                message={
                    allImagesCostPoints != null
                        ? `本次一键生成功能性NPC图片将扣除 ${allImagesCostPoints} 积分（当前积分 ${userPoints}${allImagesCostPoints > userPoints ? '，积分不足' : ''}），是否继续？`
                        : `将扣除一定积分（当前积分 ${userPoints}），是否继续？`
                }
                confirmButtonText="确认生成"
                cancelButtonText="取消"
            />

            {/* 一键生成全部图片加载遮罩 */}
            {isGeneratingAllImages && (
                <div className={styles.plusLoadingOverlay}>
                    <div className={styles.plusLoadingSpinner}></div>
                    <div className={styles.plusLoadingText}>正在生成功能性NPC图片...</div>
                </div>
            )}

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
                            // 保存失败时不关闭弹窗，不执行待处理操作，保持表单数据
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
        </div>
    );
});

FunctionalNPCsPanel.displayName = 'FunctionalNPCsPanel';

export default FunctionalNPCsPanel;
