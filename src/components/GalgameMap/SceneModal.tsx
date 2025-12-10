// SubSceneDetailPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styles from './SceneModal.module.css';
import { MdOutlineArrowCircleLeft } from 'react-icons/md';

// NPC 类型定义
interface NPCData {
    id: string;
    name: string;
    image: string;
    position: 'left' | 'right';
}

interface SceneModalProps {
    // 从路由获取数据，也可以从props传递
    subsceneData?: {
        id: string;
        name: string;
        image: string;
        parentSceneName: string;
    };
    npcData?: NPCData[];
    onBack?: () => void;
}

const SceneModal: React.FC<SceneModalProps> = ({
    subsceneData,
    npcData = [],
    onBack
}) => {
    const navigate = useNavigate();
    const { sceneId, subsceneId } = useParams<{ sceneId: string; subsceneId: string }>();
    const [isLoading, setIsLoading] = useState(true);
    const [leftNPC, setLeftNPC] = useState<NPCData | null>(null);
    const [rightNPC, setRightNPC] = useState<NPCData | null>(null);

    // 初始化NPC数据
    useEffect(() => {
        // 最多显示两个NPC，一左一右
        const left = npcData.find(npc => npc.position === 'left');
        const right = npcData.find(npc => npc.position === 'right');
        
        setLeftNPC(left || null);
        setRightNPC(right || null);
        
        // 模拟加载
        setTimeout(() => {
            setIsLoading(false);
        }, 300);
        
        // 实际开发中这里应该从API获取数据
        console.log('加载子场景数据:', { sceneId, subsceneId });
    }, [npcData, sceneId, subsceneId]);

    // 处理返回
    const handleBack = () => {
        if (onBack) {
            onBack();
        } else {
            navigate(-1); // 返回上一页
        }
    };

    // 如果有数据传入，使用传入的数据
    const displayData = subsceneData || {
        id: subsceneId || 'unknown',
        name: '子场景',
        image: '',
        parentSceneName: '主场景'
    };

    if (isLoading) {
        return (
            <div className={styles.loadingContainer}>
                <div className={styles.loadingSpinner}></div>
                <div className={styles.loadingText}>加载中...</div>
            </div>
        );
    }

    return (
        <div 
            className={styles.container}
            style={{
                backgroundImage: displayData.image ? `url("${displayData.image}")` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
            }}
        >
            {/* 顶部标题 */}
            <div className={styles.titleBar}>
                <div className={styles.backButton} onClick={handleBack}>
                    <MdOutlineArrowCircleLeft size={24} />
                </div>
                <div className={styles.titleText}>
                    {displayData.name}
                </div>
                <div className={styles.rightPlaceholder}></div>
            </div>

            {/* 左侧NPC立绘 */}
            {leftNPC && (
                <div className={styles.leftNPC}>
                    <img 
                        src={leftNPC.image} 
                        alt={leftNPC.name}
                        className={styles.npcImage}
                    />
                </div>
            )}

            {/* 右侧NPC立绘 */}
            {rightNPC && (
                <div className={styles.rightNPC}>
                    <img 
                        src={rightNPC.image} 
                        alt={rightNPC.name}
                        className={styles.npcImage}
                    />
                </div>
            )}
        </div>
    );
};

export default SceneModal;