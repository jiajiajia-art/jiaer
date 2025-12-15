// SubSceneDetailPage.tsx
import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styles from './SceneModal.module.css';
import { MdOutlineArrowCircleLeft } from 'react-icons/md';
import { useMapGalgameStore } from '../../store/mapGalgameStore';
import type { AllGameData, NPC } from '../../api/worldInteraction/mapWorldData.type';

interface SceneModalProps {
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

const SceneModal: React.FC<SceneModalProps> = ({
    subsceneData,
    onBack,
    gameData,
    onNpcInteract
}) => {
    const navigate = useNavigate();
    const { subsceneId } = useParams<{ sceneId: string; subsceneId: string }>();
    const { eventData } = useMapGalgameStore();

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
                    backgroundImage: displayData.image ? `url("${displayData.image}")` : undefined,
                }}
            />
            
            {/* 内容层 */}
            <div className={styles.contentLayer}>
                {/* 顶部标题栏 */}
                <div className={styles.titleBar}>
                    <div className={styles.backButton} onClick={handleBack}>
                        <MdOutlineArrowCircleLeft size={24} />
                    </div>
                    <div className={styles.titleText}>
                        {displayData.name}
                    </div>
                    <div className={styles.rightPlaceholder}></div>
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

            </div>
        </div>
    );
};

export default SceneModal;