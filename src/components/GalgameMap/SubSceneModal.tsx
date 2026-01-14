// SubSceneDetailPage.tsx
import React, { useMemo, useState, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styles from './SubSceneModal.module.css';
import { useMapGalgameStore } from '../../store/mapGalgameStore';
import type { AllGameData, SubScene } from '../../api/worldInteraction/mapWorldData.type';
import type { AbilityNode } from '../../api/worldInteraction/worldInteractionApi.type';
import { getImageUrl } from '../../utils/constants';
import EventDisplayModal from './Plugin/EventDisplayModal';
import { useGameStore } from '../../store/gameStore';
import InteractWithNpc from './InteractWithNpc';

const DEFAULT_SCENE_IMAGE = `${import.meta.env.BASE_URL}data/assets/创作界面切图/defaultScene.png`;
const DEFAULT_NPC_IMAGE = `${import.meta.env.BASE_URL}data/assets/创作界面切图/defaultNpc.png`;

interface SubSceneModalProps {
    subsceneData?: {
        id: string;
        name: string;
        image: string;
        parentSceneName: string;
    };
    onBack?: () => void;
    gameData?: AllGameData;
    onNpcInteract?: () => void;
    onUpdateAttributes?: () => Promise<void>;
}

const SubSceneModal: React.FC<SubSceneModalProps> = ({
    subsceneData,
    onBack,
    gameData,
    onNpcInteract,
    onUpdateAttributes,
}) => {
    const navigate = useNavigate();
    const { subsceneId } = useParams<{ sceneId: string; subsceneId: string }>();
    const { eventData } = useMapGalgameStore();
    const [selectedAbilityNode, setSelectedAbilityNode] = useState<AbilityNode | null>(null);
    const [isEventModalOpen, setIsEventModalOpen] = useState(false);
    const [isInteractionActive, setIsInteractionActive] = useState(false);
    const [pendingAction, setPendingAction] = useState<{ nodeId: string; actionId: string } | null>(null); // 待处理的操作
    const { sessionId } = useGameStore();
    const selectedAbilityNodeRef = useRef<AbilityNode | null>(null);
    
    // 同步 selectedAbilityNode 到 ref
    React.useEffect(() => {
        selectedAbilityNodeRef.current = selectedAbilityNode;
    }, [selectedAbilityNode]);

    const handleBack = () => {
        if (onBack) {
            onBack();
        } else {
            navigate(-1);
        }
    };

    // 如果有数据传入，使用传入的数据
    const displayData = subsceneData || {
        id: subsceneId || 'unknown',
        name: '子场景',
        image: '',
        parentSceneName: '主场景'
    };

    // 获取当前子场景的完整信息（包括 abilityNodes）
    const currentSubScene: SubScene | null = useMemo(() => {
        if (!gameData?.sceneSetting?.scenes) return null;
        
        for (const scene of gameData.sceneSetting.scenes) {
            const subscene = scene.subscenes?.find(sub => sub.id === displayData.id);
            if (subscene) {
                return subscene;
            }
        }
        return null;
    }, [gameData, displayData.id]);

    const isTargetSubscene = eventData?.subscene?.id === displayData.id;

    // 获取与当前子场景相关的NPC，优先使用事件数据中的NPC（因为一般场景都没有固定的NPC，NPC来自事件分发）
    const getRelatedNpc = useMemo(() => {
        // 优先使用事件数据中的NPC（因为一般场景都没有固定的NPC，NPC来自事件分发）
        if (eventData?.npc && isTargetSubscene) {
            // 尝试从 gameData 中获取完整的NPC信息（包含图片等）
            let npc = null;
            if (gameData?.npcSetting?.npcs) {
                npc = gameData.npcSetting.npcs.find(n => n.id === eventData.npc.id);
            }
            
            // 如果找不到，使用事件数据中的NPC信息
            if (!npc) {
                npc = eventData.npc;
            }
            
            // 尝试从子场景的 npcs_slots 中获取位置信息
            let position: [number, number] = [0.5, 0.5];
            let zoom = 1;
            if (currentSubScene?.npcs_slots && currentSubScene.npcs_slots.length > 0) {
                const firstSlot = currentSubScene.npcs_slots[0];
                if (firstSlot.position) {
                    position = firstSlot.position;
                    zoom = firstSlot.zoom ?? 1;
                }
            }
            return {
                npc,
                position,
                zoom,
            };
        }
        
        // 兜底：如果事件数据中没有NPC，尝试从子场景配置中获取（虽然一般不会有）
        if (currentSubScene && gameData?.npcSetting?.npcs) {
            // 如果有 npcs_slots，使用第一个的位置和缩放信息
            if (currentSubScene.npcs_slots && currentSubScene.npcs_slots.length > 0) {
                const firstSlot = currentSubScene.npcs_slots[0];
                const npcId = currentSubScene.npcs?.[0];
                
                if (npcId && firstSlot.position) {
                    const npc = gameData.npcSetting.npcs.find(n => n.id === npcId);
                    if (npc) {
                        return {
                            npc,
                            position: firstSlot.position,
                            zoom: firstSlot.zoom ?? 1,
                        };
                    }
                }
            }
        }
        
        return null;
    }, [currentSubScene, gameData?.npcSetting?.npcs, eventData, displayData.id, isTargetSubscene]);

    // 处理功能性NPC点击
    const handleFunctionalNpcClick = (abilityNode: AbilityNode) => {
        setSelectedAbilityNode(abilityNode);
        setIsEventModalOpen(true);
    };

    // 处理事件弹窗关闭
    const handleEventModalClose = () => {
        setIsEventModalOpen(false);
        setSelectedAbilityNode(null);
    };

    // 处理选项点击 - 设置待处理操作，让 InteractWithNpc 自己处理流式响应
    const handleOptionClick = useCallback((action: { id: string; name: string; description: string }) => {
        // 使用 ref 获取最新的 selectedAbilityNode，避免闭包问题
        const currentAbilityNode = selectedAbilityNodeRef.current;
        
        if (!currentAbilityNode || !sessionId) {
            return;
        }
        
        // 关闭事件弹窗
        setIsEventModalOpen(false);
        
        // 设置待处理的操作，让 InteractWithNpc 自己处理流式响应
        setPendingAction({
            nodeId: currentAbilityNode.node_id,
            actionId: action.id
        });
        setIsInteractionActive(true);
    }, [sessionId, onUpdateAttributes]);
    
    // 处理关闭交互
    const handleCloseInteraction = useCallback(() => {
        setIsInteractionActive(false);
        setPendingAction(null);
        // 重置 selectedAbilityNode，以便下次可以重新打开
        setSelectedAbilityNode(null);
    }, []);

    // 获取功能性NPC列表
    const functionalNPCs = useMemo(() => {
        if (!currentSubScene?.abilityNodes?.length || !gameData?.abilityNodeSetting?.abilityNodes) {
            return [];
        }

        return currentSubScene.abilityNodes
            .map((nodeId: string): AbilityNode | null => {
                const abilityNode = gameData.abilityNodeSetting!.abilityNodes.find(
                    (node: AbilityNode) => node.node_id === nodeId
                );
                return abilityNode && abilityNode.position && abilityNode.position.length === 2
                    ? abilityNode
                    : null;
            })
            .filter((node): node is AbilityNode => node !== null);
    }, [currentSubScene, gameData?.abilityNodeSetting]);


    return (
        <div className={styles.container}>
            {/* 背景层 */}
            <div 
                className={styles.backgroundLayer}
                style={{
                    backgroundImage: displayData.image ? `url("${displayData.image}")` : DEFAULT_SCENE_IMAGE,
                }}
            />
            
            {/* 内容层 */}
            <div className={styles.contentLayer}>
                {/* 顶部标题栏 */}
                <div className={styles.titleBar}>
                    <div className={styles.titleText} onClick={handleBack}>
                        {displayData.name}
                    </div>
                </div>

                {/* NPC层 - 只显示第一个NPC，使用 npcs_slots 中的位置和缩放信息 */}
                {isTargetSubscene && getRelatedNpc && (
                    <div className={styles.npcLayer}>
                        <div 
                            className={styles.npcContainer}
                            style={{
                                position: 'absolute',
                                left: `${getRelatedNpc!.position[0] * 100}%`,
                                top: `${getRelatedNpc!.position[1] * 100}%`,
                                transform: `translate(-50%, -50%) scale(${getRelatedNpc!.zoom})`,
                                transformOrigin: 'center center',
                                cursor: 'pointer',
                            }}
                            onClick={() => onNpcInteract?.()}
                        >
                            <img 
                                src={getRelatedNpc!.npc.images?.base || ''} 
                                alt={getRelatedNpc!.npc.name}
                                className={styles.npcImage}
                                onError={(e) => {
                                    (e.target as HTMLImageElement).src = DEFAULT_NPC_IMAGE;
                                }}
                            />
                            <img 
                                src={`${import.meta.env.BASE_URL}/data/assets/任务.png`} 
                                alt="任务" 
                                className={styles.eventLocation} 
                            />
                        </div>
                    </div>
                )}

                {/* 功能性NPC层 - 根据位置、缩放、层级、颜色渲染 */}
                {functionalNPCs.length > 0 && (
                    <div className={styles.functionalNPCLayer}>
                        {functionalNPCs.map((abilityNode) => {
                            if (!abilityNode.position || abilityNode.position.length !== 2) {
                                return null;
                            }

                            const [x, y] = abilityNode.position;
                            const scale = abilityNode.scale ?? 1;
                            const layer = abilityNode.layer ?? 0;
                            const isButton = abilityNode.type === 'button';
                            const isIllustration = abilityNode.type === 'illustration';

                            return (
                                <div
                                    key={abilityNode.node_id}
                                    className={styles.functionalNPCContainer}
                                    style={{
                                        position: 'absolute',
                                        left: `${x * 100}%`,
                                        top: `${y * 100}%`,
                                        transform: `translate(-50%, -50%) scale(${scale})`,
                                        transformOrigin: 'center center',
                                        zIndex: layer,
                                        cursor: 'pointer',
                                    }}
                                    onClick={() => handleFunctionalNpcClick(abilityNode)}
                                >
                                    {isButton && abilityNode.name ? (
                                        // 按钮型NPC：显示文字
                                        <div
                                            className={styles.functionalNPCButton}
                                            style={{
                                                backgroundColor: abilityNode.color || '#E03D4B',
                                                padding: '8px 16px',
                                                borderRadius: '8px',
                                                color: 'white',
                                                fontSize: '14px',
                                                fontWeight: 600,
                                                whiteSpace: 'nowrap',
                                                cursor: 'pointer',
                                                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                                            }}
                                        >
                                            {abilityNode.name}
                                        </div>
                                    ) : isIllustration && abilityNode.imagePath ? (
                                        // 立绘型NPC：显示图片
                                        <img
                                            src={getImageUrl(abilityNode.imagePath)}
                                            alt={abilityNode.authorNote || '功能性NPC'}
                                            className={styles.functionalNPCImage}
                                            style={{
                                                width: '100px',
                                                height: '150px',
                                                objectFit: 'contain',
                                                filter: 'drop-shadow(0 10px 30px rgba(0, 0, 0, 0.7))',
                                            }}
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).src = DEFAULT_NPC_IMAGE;
                                            }}
                                        />
                                    ) : null}
                                </div>
                            );
                        })}
                    </div>
                )}

            </div>

            {/* 功能性NPC事件弹窗 */}
            <EventDisplayModal
                isOpen={isEventModalOpen}
                abilityNode={selectedAbilityNode}
                onClose={handleEventModalClose}
                onOptionClick={(action) => handleOptionClick(action)}
            />
            
            {/* 交互页面 - 复用 InteractWithNpc */}
            {isInteractionActive && (
                <InteractWithNpc
                    onClose={handleCloseInteraction}
                    gameData={gameData || null}
                    worldInteractionHistory={null}
                    pendingAction={pendingAction || undefined}
                    skipAutoInit={true}
                    currentSubsceneId={currentSubScene?.id || displayData.id}
                    onUpdateAttributes={onUpdateAttributes}
                />
            )}
            
        </div>
    );
};

export default SubSceneModal;