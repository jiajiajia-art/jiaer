// SubSceneDetailPage.tsx
import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styles from './SubSceneModal.module.css';
import { useMapGalgameStore } from '../../store/mapGalgameStore';
import type { AllGameData, NPC, SubScene } from '../../api/worldInteraction/mapWorldData.type';
import type { AbilityNode } from '../../api/worldInteraction/worldInteractionApi.type';
import { getImageUrl } from '../../utils/constants';
import EventDisplayModal from './EventDisplayModal';

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
}

const SubSceneModal: React.FC<SubSceneModalProps> = ({
    subsceneData,
    onBack,
    gameData,
    onNpcInteract,
}) => {
    const navigate = useNavigate();
    const { subsceneId } = useParams<{ sceneId: string; subsceneId: string }>();
    const { eventData } = useMapGalgameStore();
    const [selectedAbilityNode, setSelectedAbilityNode] = useState<AbilityNode | null>(null);
    const [isEventModalOpen, setIsEventModalOpen] = useState(false);

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

    // 获取与当前子场景相关的NPC
    // 这里可以扩展逻辑，比如从eventData获取，或者根据场景配置获取
    const getRelatedNpcs = (): NPC[] => {
        const npcs: NPC[] = [];
        
        // 如果有eventData，先添加事件相关的NPC
        if (eventData?.npc?.id && gameData?.npcSetting?.npcs) {
            const eventNpc = gameData.npcSetting.npcs.find(npc => npc.id === eventData.npc?.id);
            if (eventNpc) {
                npcs.push(eventNpc);
            }
        }
        
        return npcs;
    };

    const relatedNpcs = getRelatedNpcs();
    const isTargetSubscene = eventData?.subscene?.id === displayData.id;

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

    // 处理选项点击
    const handleOptionClick = (_actionIndex: number, action: { id: string; name: string; description: string }) => {
        console.log('点击了选项:', action, '来自功能性NPC:', selectedAbilityNode?.node_id);
        // TODO: 这里可以添加具体的选项处理逻辑
        // 例如：调用API、更新状态等
    };

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

    // 计算NPC的位置布局
    const getNpcPositionStyle = (index: number, total: number) => {
        if (total === 1) {
            // 只有一个NPC：居中
            return {
                right: '50%',
                justifyContent: 'center' as const
            };
        } else if (total === 2) {
            // 两个NPC：左右分布
            return {
                left: index === 0 ? '20%' : 'auto',
                right: index === 1 ? '20%' : 'auto',
                justifyContent: index === 0 ? 'flex-start' as const : 'flex-end' as const
            };
        } else {
            // 三个或更多NPC：平均分布
            const positions = ['25%', '50%', '75%'];
            return {
                left: `${positions[index]}`,
                transform: 'translateX(-50%)',
                justifyContent: 'center' as const
            };
        }
    };

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

                {/* NPC层 - 悬浮在背景之上 */}
                {isTargetSubscene && relatedNpcs.length > 0 && (
                    <div className={styles.npcLayer}>
                        {relatedNpcs.map((npc, index) => (
                            <div 
                                key={npc.id}
                                className={styles.npcContainer}
                                style={getNpcPositionStyle(index, relatedNpcs.length)}
                                onClick={() => onNpcInteract?.()}
                            >
                                <img 
                                    src={npc.images?.base || ''} 
                                    alt={npc.name}
                                    className={styles.npcImage}
                                />
                                <img src={`${import.meta.env.BASE_URL}/data/assets/任务.png`} alt="任务" className={styles.eventLocation} />
                            </div>
                        ))}
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
                                                maxWidth: '200px',
                                                maxHeight: '300px',
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
                onOptionClick={handleOptionClick}
            />
            
        </div>
    );
};

export default SubSceneModal;