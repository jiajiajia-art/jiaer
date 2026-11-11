import React from 'react';
import styles from './FunctionalNPCList.module.css';
import sharedStyles from './shared.module.css';
import { RiDeleteBin5Line } from 'react-icons/ri';
import type { AbilityNode } from '../../../api/worldInteraction/worldInteractionApi.type';
import { getImageUrl } from '../../../utils/constants';
import { addImageTimestamp } from '../../../utils/imageCache';

interface FunctionalNPCListProps {
    abilityNodes: AbilityNode[];
    activeNodeId: string | null;
    onNodeClick: (nodeId: string) => void;
    onDeleteClick: (nodeId: string, e: React.MouseEvent) => void;
    onCreateClick: () => void;
}

const FunctionalNPCList: React.FC<FunctionalNPCListProps> = ({
    abilityNodes,
    activeNodeId,
    onNodeClick,
    onDeleteClick,
    onCreateClick,
}) => {
    const DEFAULT_NPC_IMAGE = `${import.meta.env.BASE_URL}data/assets/创作界面切图/defaultNpc.png`;

    return (
        <div className={styles.npcList}>
            <div className={styles.npcListHeader}>
                <h3>功能性NPC</h3>
                <button className={sharedStyles.ghostSmall} onClick={onCreateClick}>
                    + 创建
                </button>
            </div>
            <div className={styles.npcListContent}>
                {abilityNodes.length === 0 ? (
                    <div className={styles.emptyState}>
                        <p>暂无功能性NPC</p>
                        <p className={styles.emptyHint}>点击"创建"添加新的功能性NPC</p>
                    </div>
                ) : (
                    abilityNodes.map((node) => {
                        const isActive = activeNodeId === node.node_id;
                        // 按钮型NPC如果没有文字，不显示图片
                        const shouldShowImage = node.type === 'illustration' 
                            ? !!node.imagePath 
                            : (node.type === 'button' && node.name ? !!node.imagePath : false);
                        
                        return (
                            <div
                                key={node.node_id}
                                className={`${styles.npcCard} ${isActive ? styles.npcCardActive : ''}`}
                                onClick={() => onNodeClick(node.node_id)}
                            >
                                {shouldShowImage && (
                                    <div className={styles.npcCardThumbnail}>
                                        <img
                                            src={node.imagePath ? addImageTimestamp(getImageUrl(node.imagePath)) : DEFAULT_NPC_IMAGE}
                                            alt={node.authorNote || '功能性NPC'}
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).src = DEFAULT_NPC_IMAGE;
                                            }}
                                        />
                                    </div>
                                )}
                                <div className={styles.npcCardInfo}>
                                    <div className={styles.npcCardName}>{node.authorNote || '未命名NPC'}</div>
                                    <div className={styles.npcCardType}>
                                        {node.type === 'illustration' ? '立绘型' : node.type === 'button' ? '按钮型' : node.type}
                                    </div>
                                </div>
                                <button
                                    className={styles.npcCardDelete}
                                    onClick={(e) => onDeleteClick(node.node_id, e)}
                                    aria-label="删除"
                                >
                                    <RiDeleteBin5Line size={18} />
                                </button>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default FunctionalNPCList;